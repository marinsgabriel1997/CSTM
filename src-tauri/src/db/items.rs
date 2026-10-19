//! Operações sobre vários itens da árvore (pastas e textos) e do histórico do clipboard:
//! lixeira; cópia e arrumação só valem para pastas e textos.

use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::folders::is_self_or_descendant;
use super::{DbError, NOW, Ordered, Result, clipboard, ensure_changed, next_sort_order};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Folder,
    Snippet,
    /// Item do histórico do clipboard: só tem lixeira, sem pasta nem ordem manual.
    Clip,
}

impl Kind {
    /// Tabela e colunas de pai/ordem manual; o histórico não tem, então é recusado.
    fn ordered(self) -> Result<Ordered> {
        match self {
            Self::Folder => Ok(Ordered::Folders),
            Self::Snippet => Ok(Ordered::Snippets),
            Self::Clip => Err(DbError::HistoryItem),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ItemRef {
    pub kind: Kind,
    pub id: i64,
}

/// Item na lixeira, com o lugar de onde saiu.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashItem {
    pub kind: Kind,
    pub id: i64,
    pub name: String,
    /// Pastas onde o item estava, da raiz até o pai; vazio para a raiz.
    pub path: Vec<String>,
    pub deleted_at: String,
    /// Subpastas e textos que voltam junto com uma pasta (zero para textos).
    pub folders: i64,
    pub snippets: i64,
}

fn ensure_exists(conn: &Connection, kind: Kind, id: i64) -> Result<()> {
    let exists: bool = conn.query_row(
        &format!(
            "SELECT EXISTS(SELECT 1 FROM {} WHERE id = ?1)",
            kind.ordered()?.table()
        ),
        [id],
        |row| row.get(0),
    )?;
    if exists {
        Ok(())
    } else {
        Err(DbError::NotFound)
    }
}

fn is_live_folder(conn: &Connection, id: i64) -> Result<bool> {
    Ok(conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM live_folders WHERE id = ?1)",
        [id],
        |row| row.get(0),
    )?)
}

/// Pasta e nome atuais do item.
fn parent_and_name(conn: &Connection, item: ItemRef) -> Result<(Option<i64>, String)> {
    let kind = item.kind.ordered()?;
    conn.query_row(
        &format!(
            "SELECT {}, {} FROM {} WHERE id = ?1",
            kind.parent_column(),
            kind.name_column(),
            kind.table()
        ),
        [item.id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()?
    .ok_or(DbError::NotFound)
}

/// Move os itens para a lixeira, todos com a mesma data. Itens que já estavam nela mantêm a
/// data da exclusão.
pub fn trash(conn: &mut Connection, items: &[ItemRef]) -> Result<()> {
    let tx = conn.transaction()?;
    let now: String = tx.query_row(&format!("SELECT {NOW}"), [], |row| row.get(0))?;
    for item in items {
        if item.kind == Kind::Clip {
            clipboard::trash_item(&tx, item.id, &now)?;
            continue;
        }
        ensure_changed(tx.execute(
            &format!(
                "UPDATE {} SET deleted_at = COALESCE(deleted_at, ?1) WHERE id = ?2",
                item.kind.ordered()?.table()
            ),
            (&now, item.id),
        )?)?;
    }
    tx.commit()?;
    Ok(())
}

/// Tira os itens da lixeira e os coloca no fim do grupo, na pasta de origem; se ela também
/// estiver na lixeira, na raiz. Todos saem da lixeira antes de escolher o lugar, para que
/// um item restaurado junto com a sua pasta volte para dentro dela. Itens do histórico só
/// saem da lixeira: mantêm a posição e voltam ao lugar que tinham na ordem.
pub fn restore(conn: &mut Connection, items: &[ItemRef]) -> Result<()> {
    let tx = conn.transaction()?;
    for item in items {
        if item.kind == Kind::Clip {
            clipboard::restore_item(&tx, item.id)?;
            continue;
        }
        ensure_changed(tx.execute(
            &format!(
                "UPDATE {} SET deleted_at = NULL WHERE id = ?1",
                item.kind.ordered()?.table()
            ),
            [item.id],
        )?)?;
    }
    for &item in items.iter().filter(|item| item.kind != Kind::Clip) {
        let kind = item.kind.ordered()?;
        let parent = match parent_and_name(&tx, item)?.0 {
            Some(id) if is_live_folder(&tx, id)? => Some(id),
            _ => None,
        };
        let sort_order = next_sort_order(&tx, kind, parent)?;
        tx.execute(
            &format!(
                "UPDATE {} SET {} = ?1, sort_order = ?2 WHERE id = ?3",
                kind.table(),
                kind.parent_column()
            ),
            (parent, sort_order, item.id),
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Exclui os itens definitivamente, com todo o conteúdo das pastas. Itens que já não existem
/// (por exemplo, dentro de uma pasta excluída no mesmo pedido) são ignorados.
pub fn delete(conn: &mut Connection, items: &[ItemRef]) -> Result<()> {
    let tx = conn.transaction()?;
    for item in items {
        if item.kind == Kind::Clip {
            clipboard::delete_item(&tx, item.id)?;
            continue;
        }
        tx.execute(
            &format!("DELETE FROM {} WHERE id = ?1", item.kind.ordered()?.table()),
            [item.id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Exclui definitivamente tudo o que está na lixeira.
pub fn empty_trash(conn: &mut Connection) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM folders WHERE deleted_at IS NOT NULL", [])?;
    tx.execute("DELETE FROM snippets WHERE deleted_at IS NOT NULL", [])?;
    clipboard::empty_trash(&tx)?;
    tx.commit()?;
    Ok(())
}

/// Itens na lixeira, dos excluídos mais recentemente para os mais antigos; os excluídos juntos,
/// pastas, textos e itens do histórico, nessa ordem.
pub fn list_trash(conn: &Connection) -> Result<Vec<TrashItem>> {
    let mut items = Vec::new();
    for kind in [Kind::Folder, Kind::Snippet] {
        let ordered = kind.ordered()?;
        let rows = conn
            .prepare(&format!(
                "SELECT id, {}, {}, deleted_at FROM {} WHERE deleted_at IS NOT NULL",
                ordered.parent_column(),
                ordered.name_column(),
                ordered.table()
            ))?
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, Option<i64>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        for (id, parent, name, deleted_at) in rows {
            let (folders, snippets) = match kind {
                Kind::Folder => contents(conn, id)?,
                Kind::Snippet | Kind::Clip => (0, 0),
            };
            items.push(TrashItem {
                kind,
                id,
                name,
                path: path(conn, parent)?,
                deleted_at,
                folders,
                snippets,
            });
        }
    }
    for (item, deleted_at) in clipboard::list_trashed(conn)? {
        items.push(TrashItem {
            kind: Kind::Clip,
            id: item.id,
            name: item.title,
            path: Vec::new(),
            deleted_at,
            folders: 0,
            snippets: 0,
        });
    }
    items.sort_by(|a, b| {
        b.deleted_at
            .cmp(&a.deleted_at)
            .then(a.kind.cmp(&b.kind))
            .then(a.id.cmp(&b.id))
    });
    Ok(items)
}

/// Nomes das pastas da raiz até `folder`, inclusive.
fn path(conn: &Connection, folder: Option<i64>) -> Result<Vec<String>> {
    let mut names = Vec::new();
    let mut current = folder;
    while let Some(id) = current {
        let (parent, name) = parent_and_name(
            conn,
            ItemRef {
                kind: Kind::Folder,
                id,
            },
        )?;
        names.push(name);
        current = parent;
    }
    names.reverse();
    Ok(names)
}

/// Subpastas e textos abaixo da pasta que não foram para a lixeira por conta própria.
fn contents(conn: &Connection, id: i64) -> Result<(i64, i64)> {
    Ok(conn.query_row(
        "WITH RECURSIVE inside(id) AS (
             SELECT ?1
             UNION ALL
             SELECT f.id FROM folders f JOIN inside ON f.parent_id = inside.id
             WHERE f.deleted_at IS NULL
         )
         SELECT (SELECT count(*) - 1 FROM inside),
                (SELECT count(*) FROM snippets
                 WHERE deleted_at IS NULL AND folder_id IN (SELECT id FROM inside))",
        [id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?)
}

/// Copia os itens para o fim do grupo em `parent`, com todo o conteúdo das pastas, e devolve
/// as cópias na mesma ordem. Na mesma pasta do original, a cópia recebe " - Cópia" no nome,
/// como no Explorer. As cópias começam sem favorito e sem uso.
pub fn copy(conn: &mut Connection, items: &[ItemRef], parent: Option<i64>) -> Result<Vec<ItemRef>> {
    if items.iter().any(|item| item.kind == Kind::Clip) {
        return Err(DbError::HistoryItem);
    }
    let tx = conn.transaction()?;
    if let Some(parent) = parent {
        ensure_exists(&tx, Kind::Folder, parent)?;
    }
    let mut copies = Vec::with_capacity(items.len());
    for &item in items {
        if let (Kind::Folder, Some(parent)) = (item.kind, parent)
            && is_self_or_descendant(&tx, parent, item.id)?
        {
            return Err(DbError::CopyIntoItself);
        }
        let (origin, name) = parent_and_name(&tx, item)?;
        let name = if origin == parent {
            copy_name(&tx, item.kind, parent, &name)?
        } else {
            name
        };
        let id = match item.kind {
            Kind::Folder => copy_folder(&tx, item.id, parent, &name)?,
            Kind::Snippet => copy_snippet(&tx, item.id, parent, &name)?,
            Kind::Clip => return Err(DbError::HistoryItem),
        };
        copies.push(ItemRef {
            kind: item.kind,
            id,
        });
    }
    tx.commit()?;
    Ok(copies)
}

/// "Nome - Cópia", ou "Nome - Cópia (2)", "(3)"… quando o grupo já tem um item do mesmo tipo
/// com esse nome (sem diferenciar maiúsculas).
fn copy_name(conn: &Connection, kind: Kind, parent: Option<i64>, name: &str) -> Result<String> {
    let ordered = kind.ordered()?;
    let taken = conn
        .prepare(&format!(
            "SELECT {} FROM {} WHERE {} IS ?1 AND deleted_at IS NULL",
            ordered.name_column(),
            ordered.table(),
            ordered.parent_column()
        ))?
        .query_map([parent], |row| row.get::<_, String>(0))?
        .map(|name| name.map(|name| name.to_lowercase()))
        .collect::<rusqlite::Result<HashSet<_>>>()?;
    let base = format!("{name} - Cópia");
    let mut candidate = base.clone();
    let mut number = 2;
    while taken.contains(&candidate.to_lowercase()) {
        candidate = format!("{base} ({number})");
        number += 1;
    }
    Ok(candidate)
}

/// Ids e nomes dos itens de um tipo dentro da pasta, fora da lixeira e na ordem manual.
fn children(conn: &Connection, kind: Kind, folder: i64) -> Result<Vec<(i64, String)>> {
    let ordered = kind.ordered()?;
    let children = conn
        .prepare(&format!(
            "SELECT id, {} FROM {} WHERE {} = ?1 AND deleted_at IS NULL ORDER BY sort_order, id",
            ordered.name_column(),
            ordered.table(),
            ordered.parent_column()
        ))?
        .query_map([folder], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(children)
}

fn copy_folder(conn: &Connection, id: i64, parent: Option<i64>, name: &str) -> Result<i64> {
    let sort_order = next_sort_order(conn, Ordered::Folders, parent)?;
    conn.execute(
        "INSERT INTO folders (parent_id, name, sort_order) VALUES (?1, ?2, ?3)",
        (parent, name, sort_order),
    )?;
    let copy = conn.last_insert_rowid();
    for (child, name) in children(conn, Kind::Folder, id)? {
        copy_folder(conn, child, Some(copy), &name)?;
    }
    for (snippet, title) in children(conn, Kind::Snippet, id)? {
        copy_snippet(conn, snippet, Some(copy), &title)?;
    }
    Ok(copy)
}

fn copy_snippet(conn: &Connection, id: i64, parent: Option<i64>, title: &str) -> Result<i64> {
    let sort_order = next_sort_order(conn, Ordered::Snippets, parent)?;
    ensure_changed(conn.execute(
        "INSERT INTO snippets (folder_id, title, content, sort_order)
         SELECT ?1, ?2, content, ?3 FROM snippets WHERE id = ?4",
        (parent, title, sort_order, id),
    )?)?;
    Ok(conn.last_insert_rowid())
}

/// Coloca as pastas `folder_ids` e os textos `snippet_ids` em `parent`, nessa ordem, movendo
/// os que estão em outro lugar. Os demais itens do grupo fora da lixeira ficam depois deles,
/// na ordem em que estavam.
pub fn arrange(
    conn: &mut Connection,
    parent: Option<i64>,
    folder_ids: &[i64],
    snippet_ids: &[i64],
) -> Result<()> {
    let tx = conn.transaction()?;
    if let Some(parent) = parent {
        ensure_exists(&tx, Kind::Folder, parent)?;
        for &id in folder_ids {
            if is_self_or_descendant(&tx, parent, id)? {
                return Err(DbError::FolderCycle);
            }
        }
    }
    place(&tx, Kind::Folder, parent, folder_ids)?;
    place(&tx, Kind::Snippet, parent, snippet_ids)?;
    tx.commit()?;
    Ok(())
}

fn place(conn: &Connection, kind: Kind, parent: Option<i64>, ids: &[i64]) -> Result<()> {
    let ordered = kind.ordered()?;
    let (table, column) = (ordered.table(), ordered.parent_column());
    for &id in ids {
        ensure_exists(conn, kind, id)?;
        conn.execute(
            &format!(
                "UPDATE {table} SET {column} = ?1, updated_at = {NOW} WHERE id = ?2 AND {column} IS NOT ?1"
            ),
            (parent, id),
        )?;
    }
    let rest = conn
        .prepare(&format!(
            "SELECT id FROM {table} WHERE {column} IS ?1 AND deleted_at IS NULL ORDER BY sort_order, id"
        ))?
        .query_map([parent], |row| row.get::<_, i64>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let rest = rest.into_iter().filter(|id| !ids.contains(id));
    let mut update = conn.prepare(&format!("UPDATE {table} SET sort_order = ?1 WHERE id = ?2"))?;
    for (sort_order, id) in ids.iter().copied().chain(rest).enumerate() {
        update.execute((sort_order as i64, id))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clipboard::{Content, TextContent};
    use crate::db::folders::{create_folder, list_folders};
    use crate::db::open_in_memory;
    use crate::db::snippets::{
        Snippet, create_snippet, get_snippet, list_all_snippets, list_favorites, list_snippets,
        move_snippet, record_use, search_snippets, set_favorite,
    };

    fn folder(id: i64) -> ItemRef {
        ItemRef {
            kind: Kind::Folder,
            id,
        }
    }

    fn snippet(id: i64) -> ItemRef {
        ItemRef {
            kind: Kind::Snippet,
            id,
        }
    }

    /// Árvore fora da lixeira, uma linha por item, com a profundidade como recuo.
    fn tree(conn: &Connection) -> Vec<String> {
        fn walk(conn: &Connection, parent: Option<i64>, depth: usize, lines: &mut Vec<String>) {
            for f in list_folders(conn).unwrap() {
                if f.parent_id == parent {
                    lines.push(format!("{}{}/", "  ".repeat(depth), f.name));
                    walk(conn, Some(f.id), depth + 1, lines);
                }
            }
            for s in list_snippets(conn, parent).unwrap() {
                lines.push(format!("{}{}", "  ".repeat(depth), s.title));
            }
        }
        let mut lines = Vec::new();
        walk(conn, None, 0, &mut lines);
        lines
    }

    fn titles(snippets: Vec<Snippet>) -> Vec<String> {
        snippets.into_iter().map(|s| s.title).collect()
    }

    #[test]
    fn trash_hides_items_and_their_contents_everywhere() {
        let mut conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        let emails = create_folder(&conn, Some(work.id), "E-mails").unwrap();
        let reply = create_snippet(&conn, Some(emails.id), "Resposta", "texto").unwrap();
        set_favorite(&conn, reply.id, true).unwrap();
        let phone = create_snippet(&conn, None, "Telefone", "texto").unwrap();
        create_snippet(&conn, None, "Agenda", "texto").unwrap();

        trash(&mut conn, &[folder(work.id), snippet(phone.id)]).unwrap();

        assert_eq!(tree(&conn), ["Agenda"]);
        assert_eq!(titles(list_all_snippets(&conn).unwrap()), ["Agenda"]);
        assert!(list_favorites(&conn).unwrap().is_empty());
        assert_eq!(
            titles(search_snippets(&conn, "texto", None).unwrap()),
            ["Agenda"]
        );
        // O item continua acessível pelo id, para ser restaurado.
        assert!(get_snippet(&conn, reply.id).is_ok());
        assert!(matches!(
            trash(&mut conn, &[snippet(42)]),
            Err(DbError::NotFound)
        ));
    }

    #[test]
    fn restore_returns_to_the_end_of_the_original_folder() {
        let mut conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        let a = create_snippet(&conn, Some(work.id), "A", "a").unwrap();
        create_snippet(&conn, Some(work.id), "B", "b").unwrap();
        create_snippet(&conn, Some(work.id), "C", "c").unwrap();

        trash(&mut conn, &[snippet(a.id)]).unwrap();
        restore(&mut conn, &[snippet(a.id)]).unwrap();

        assert_eq!(tree(&conn), ["Trabalho/", "  B", "  C", "  A"]);
        assert!(list_trash(&conn).unwrap().is_empty());
    }

    #[test]
    fn restore_goes_to_the_root_when_the_folder_is_in_the_trash() {
        let mut conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        let note = create_snippet(&conn, Some(work.id), "Nota", "n").unwrap();
        let sub = create_folder(&conn, Some(work.id), "Sub").unwrap();
        create_snippet(&conn, Some(sub.id), "Dentro", "d").unwrap();

        trash(&mut conn, &[snippet(note.id)]).unwrap();
        trash(&mut conn, &[folder(work.id)]).unwrap();
        restore(&mut conn, &[snippet(note.id)]).unwrap();
        assert_eq!(tree(&conn), ["Nota"]);

        // A pasta volta com o conteúdo que não foi excluído por conta própria.
        restore(&mut conn, &[folder(work.id)]).unwrap();
        assert_eq!(tree(&conn), ["Trabalho/", "  Sub/", "    Dentro", "Nota"]);
    }

    #[test]
    fn restoring_a_folder_and_its_item_together_keeps_the_item_inside() {
        let mut conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        let note = create_snippet(&conn, Some(work.id), "Nota", "n").unwrap();

        trash(&mut conn, &[snippet(note.id)]).unwrap();
        trash(&mut conn, &[folder(work.id)]).unwrap();
        restore(&mut conn, &[snippet(note.id), folder(work.id)]).unwrap();

        assert_eq!(tree(&conn), ["Trabalho/", "  Nota"]);
    }

    #[test]
    fn list_trash_shows_origin_contents_and_most_recent_first() {
        let mut conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        let clients = create_folder(&conn, Some(work.id), "Clientes").unwrap();
        let old = create_snippet(&conn, Some(clients.id), "Proposta antiga", "p").unwrap();
        let drafts = create_folder(&conn, None, "Rascunhos").unwrap();
        let sub = create_folder(&conn, Some(drafts.id), "Sub").unwrap();
        create_snippet(&conn, Some(drafts.id), "Um", "1").unwrap();
        create_snippet(&conn, Some(sub.id), "Dois", "2").unwrap();
        let gone = create_snippet(&conn, Some(sub.id), "Já excluído", "3").unwrap();

        trash(
            &mut conn,
            &[snippet(gone.id), snippet(old.id), folder(drafts.id)],
        )
        .unwrap();
        for (table, id, at) in [
            ("snippets", old.id, "2026-10-14T09:12:00.000Z"),
            ("folders", drafts.id, "2026-10-13T18:40:00.000Z"),
            ("snippets", gone.id, "2026-10-02T11:05:00.000Z"),
        ] {
            conn.execute(
                &format!("UPDATE {table} SET deleted_at = ?1 WHERE id = ?2"),
                (at, id),
            )
            .unwrap();
        }

        let trash = list_trash(&conn).unwrap();
        let summary: Vec<_> = trash
            .iter()
            .map(|item| {
                (
                    item.kind,
                    item.name.as_str(),
                    item.path.join(" › "),
                    item.folders,
                    item.snippets,
                )
            })
            .collect();
        assert_eq!(
            summary,
            [
                (
                    Kind::Snippet,
                    "Proposta antiga",
                    "Trabalho › Clientes".to_string(),
                    0,
                    0
                ),
                (Kind::Folder, "Rascunhos", String::new(), 1, 2),
                (
                    Kind::Snippet,
                    "Já excluído",
                    "Rascunhos › Sub".to_string(),
                    0,
                    0
                ),
            ]
        );
        assert_eq!(trash[0].deleted_at, "2026-10-14T09:12:00.000Z");
    }

    #[test]
    fn delete_and_empty_remove_permanently_with_contents() {
        let mut conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        let inside = create_snippet(&conn, Some(work.id), "Dentro", "texto").unwrap();
        let loose = create_snippet(&conn, None, "Solto", "texto").unwrap();
        let kept = create_snippet(&conn, None, "Mantido", "texto").unwrap();
        let trashed = create_snippet(&conn, None, "Na lixeira", "texto").unwrap();
        trash(&mut conn, &[snippet(trashed.id)]).unwrap();

        // A pasta leva o conteúdo; o texto de dentro, pedido de novo, é ignorado.
        delete(
            &mut conn,
            &[folder(work.id), snippet(inside.id), snippet(loose.id)],
        )
        .unwrap();
        assert_eq!(tree(&conn), ["Mantido"]);
        assert_eq!(list_trash(&conn).unwrap().len(), 1);

        empty_trash(&mut conn).unwrap();
        assert!(list_trash(&conn).unwrap().is_empty());
        assert!(get_snippet(&conn, trashed.id).is_err());
        assert!(get_snippet(&conn, kept.id).is_ok());
        let total: i64 = conn
            .query_row("SELECT count(*) FROM snippets", [], |row| row.get(0))
            .unwrap();
        assert_eq!(total, 1);
        conn.execute(
            "INSERT INTO snippets_fts(snippets_fts) VALUES ('integrity-check')",
            [],
        )
        .unwrap();
    }

    #[test]
    fn copy_in_the_same_folder_names_the_copy_like_the_explorer() {
        let mut conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        let sign = create_snippet(&conn, Some(work.id), "Assinatura", "Att.").unwrap();
        set_favorite(&conn, sign.id, true).unwrap();
        record_use(&conn, sign.id).unwrap();

        let first = copy(&mut conn, &[snippet(sign.id)], Some(work.id)).unwrap();
        copy(&mut conn, &[snippet(sign.id)], Some(work.id)).unwrap();
        copy(&mut conn, &[snippet(sign.id)], None).unwrap();

        assert_eq!(
            tree(&conn),
            [
                "Trabalho/",
                "  Assinatura",
                "  Assinatura - Cópia",
                "  Assinatura - Cópia (2)",
                "Assinatura"
            ]
        );
        let copied = get_snippet(&conn, first[0].id).unwrap();
        assert_eq!(copied.content, "Att.");
        assert!(!copied.favorite);
        assert_eq!((copied.use_count, copied.last_used_at), (0, None));
    }

    #[test]
    fn copy_of_a_folder_takes_its_contents_outside_the_trash() {
        let mut conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        let emails = create_folder(&conn, Some(work.id), "E-mails").unwrap();
        create_snippet(&conn, Some(emails.id), "Resposta", "r").unwrap();
        create_snippet(&conn, Some(work.id), "Nota", "n").unwrap();
        let gone = create_snippet(&conn, Some(work.id), "Excluída", "x").unwrap();
        trash(&mut conn, &[snippet(gone.id)]).unwrap();
        let other = create_folder(&conn, None, "Outra").unwrap();

        let copies = copy(&mut conn, &[folder(work.id)], Some(other.id)).unwrap();

        assert_eq!(copies.len(), 1);
        assert_eq!(copies[0].kind, Kind::Folder);
        assert_eq!(
            tree(&conn),
            [
                "Trabalho/",
                "  E-mails/",
                "    Resposta",
                "  Nota",
                "Outra/",
                "  Trabalho/",
                "    E-mails/",
                "      Resposta",
                "    Nota",
            ]
        );
    }

    #[test]
    fn copy_rejects_a_folder_inside_itself_and_missing_items() {
        let mut conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        let sub = create_folder(&conn, Some(work.id), "Sub").unwrap();

        for target in [work.id, sub.id] {
            assert!(matches!(
                copy(&mut conn, &[folder(work.id)], Some(target)),
                Err(DbError::CopyIntoItself)
            ));
        }
        assert!(matches!(
            copy(&mut conn, &[snippet(42)], None),
            Err(DbError::NotFound)
        ));
        assert!(matches!(
            copy(&mut conn, &[folder(sub.id)], Some(42)),
            Err(DbError::NotFound)
        ));
        assert_eq!(tree(&conn), ["Trabalho/", "  Sub/"]);
    }

    #[test]
    fn arrange_moves_and_orders_keeping_the_others_after() {
        let mut conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        let a = create_folder(&conn, None, "A").unwrap();
        let x = create_snippet(&conn, Some(work.id), "X", "x").unwrap();
        let y = create_snippet(&conn, Some(work.id), "Y", "y").unwrap();
        let z = create_snippet(&conn, None, "Z", "z").unwrap();
        create_snippet(&conn, None, "W", "w").unwrap();

        arrange(&mut conn, Some(work.id), &[a.id], &[z.id, y.id]).unwrap();
        assert_eq!(tree(&conn), ["Trabalho/", "  A/", "  Z", "  Y", "  X", "W"]);

        // Desfazer: devolve cada item ao grupo de origem, na ordem anterior.
        arrange(&mut conn, None, &[work.id, a.id], &[z.id]).unwrap();
        arrange(&mut conn, Some(work.id), &[], &[x.id, y.id]).unwrap();
        assert_eq!(tree(&conn), ["Trabalho/", "  X", "  Y", "A/", "Z", "W"]);
    }

    #[test]
    fn arrange_rejects_cycles_and_missing_items() {
        let mut conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        let sub = create_folder(&conn, Some(work.id), "Sub").unwrap();

        assert!(matches!(
            arrange(&mut conn, Some(sub.id), &[work.id], &[]),
            Err(DbError::FolderCycle)
        ));
        assert!(matches!(
            arrange(&mut conn, None, &[], &[42]),
            Err(DbError::NotFound)
        ));
        assert!(matches!(
            arrange(&mut conn, Some(42), &[], &[]),
            Err(DbError::NotFound)
        ));
        assert_eq!(tree(&conn), ["Trabalho/", "  Sub/"]);
    }

    #[test]
    fn positions_ignore_items_in_the_trash() {
        let mut conn = open_in_memory().unwrap();
        let a = create_snippet(&conn, None, "A", "a").unwrap();
        create_snippet(&conn, None, "B", "b").unwrap();
        let c = create_snippet(&conn, None, "C", "c").unwrap();
        trash(&mut conn, &[snippet(a.id)]).unwrap();

        // Posição 0 entre os itens visíveis (B, C), sem contar o que está na lixeira.
        move_snippet(&mut conn, c.id, None, 0).unwrap();
        assert_eq!(tree(&conn), ["C", "B"]);
    }

    fn clip(id: i64) -> ItemRef {
        ItemRef {
            kind: Kind::Clip,
            id,
        }
    }

    fn record_text(conn: &mut Connection, text: &str) -> i64 {
        clipboard::record(conn, &Content::Text(TextContent::plain(text))).unwrap()
    }

    #[test]
    fn clips_are_trashed_with_the_same_date_and_listed() {
        let mut conn = open_in_memory().unwrap();
        let note = create_snippet(&conn, None, "Nota", "n").unwrap();
        let first = record_text(
            &mut conn,
            "primeira linha
resto",
        );
        let second = record_text(&mut conn, "segundo");
        record_text(&mut conn, "fica");

        trash(&mut conn, &[clip(first), snippet(note.id), clip(second)]).unwrap();

        assert_eq!(clipboard::list(&conn).unwrap().len(), 1);
        let items = list_trash(&conn).unwrap();
        let summary: Vec<_> = items
            .iter()
            .map(|item| (item.kind, item.name.as_str(), item.id))
            .collect();
        // Mesma data: texto antes dos itens do histórico, e estes por id, como os demais.
        assert_eq!(
            summary,
            [
                (Kind::Snippet, "Nota", note.id),
                (Kind::Clip, "primeira linha", first),
                (Kind::Clip, "segundo", second),
            ]
        );
        assert!(
            items
                .iter()
                .all(|item| item.deleted_at == items[0].deleted_at)
        );
        assert!(items[1].path.is_empty());
        assert_eq!((items[1].folders, items[1].snippets), (0, 0));
        assert!(matches!(
            trash(&mut conn, &[clip(999)]),
            Err(DbError::NotFound)
        ));
    }

    #[test]
    fn clips_are_restored_deleted_and_emptied() {
        let mut conn = open_in_memory().unwrap();
        let a = record_text(&mut conn, "a");
        let b = record_text(&mut conn, "b");
        let c = record_text(&mut conn, "c");
        trash(&mut conn, &[clip(a), clip(b), clip(c)]).unwrap();

        restore(&mut conn, &[clip(a)]).unwrap();
        assert_eq!(clipboard::list(&conn).unwrap()[0].id, a);

        delete(&mut conn, &[clip(b)]).unwrap();
        assert_eq!(list_trash(&conn).unwrap().len(), 1);

        empty_trash(&mut conn).unwrap();
        assert!(list_trash(&conn).unwrap().is_empty());
        // Só o que estava na lixeira é apagado.
        assert_eq!(clipboard::list(&conn).unwrap().len(), 1);
    }

    #[test]
    fn clips_cannot_be_copied_or_arranged() {
        let mut conn = open_in_memory().unwrap();
        let id = record_text(&mut conn, "a");
        let note = create_snippet(&conn, None, "Nota", "n").unwrap();

        assert!(matches!(
            copy(&mut conn, &[snippet(note.id), clip(id)], None),
            Err(DbError::HistoryItem)
        ));
        // Nada foi copiado antes da recusa.
        assert_eq!(tree(&conn), ["Nota"]);
        assert!(matches!(Kind::Clip.ordered(), Err(DbError::HistoryItem)));
        assert_eq!(
            DbError::HistoryItem.to_string(),
            "itens do histórico não podem ser copiados, movidos nem exportados"
        );
        assert_eq!(
            serde_json::to_string(&clip(id)).unwrap(),
            format!(r#"{{"kind":"clip","id":{id}}}"#)
        );
    }
}
