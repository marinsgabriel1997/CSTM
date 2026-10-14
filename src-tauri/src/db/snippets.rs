//! Textos reutilizáveis (snippets), na raiz (`folder_id` = `None`) ou em uma pasta.

use rusqlite::{Connection, OptionalExtension, Row};
use serde::Serialize;

use super::folders::ensure_folder_exists;
use super::{
    DbError, LIVE_SNIPPET, NOW, Ordered, Result, ensure_changed, next_sort_order, reorder, required,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snippet {
    pub id: i64,
    pub folder_id: Option<i64>,
    pub title: String,
    pub content: String,
    pub favorite: bool,
    pub use_count: i64,
    pub last_used_at: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

// Qualificadas porque a busca junta `snippets_fts`, que também tem `title` e `content`.
const COLUMNS: &str = "snippets.id, snippets.folder_id, snippets.title, snippets.content, \
    snippets.favorite, snippets.use_count, snippets.last_used_at, snippets.sort_order, \
    snippets.created_at, snippets.updated_at";

fn from_row(row: &Row) -> rusqlite::Result<Snippet> {
    Ok(Snippet {
        id: row.get(0)?,
        folder_id: row.get(1)?,
        title: row.get(2)?,
        content: row.get(3)?,
        favorite: row.get(4)?,
        use_count: row.get(5)?,
        last_used_at: row.get(6)?,
        sort_order: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn query_list(conn: &Connection, sql: &str, params: impl rusqlite::Params) -> Result<Vec<Snippet>> {
    let snippets = conn
        .prepare(sql)?
        .query_map(params, from_row)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(snippets)
}

pub fn get_snippet(conn: &Connection, id: i64) -> Result<Snippet> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM snippets WHERE id = ?1"),
        [id],
        from_row,
    )
    .optional()?
    .ok_or(DbError::NotFound)
}

// As listagens e a busca deixam de fora os textos na lixeira (`LIVE_SNIPPET`).

/// Textos de uma pasta (ou da raiz), na ordem manual.
pub fn list_snippets(conn: &Connection, folder_id: Option<i64>) -> Result<Vec<Snippet>> {
    query_list(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM snippets WHERE folder_id IS ?1 AND {LIVE_SNIPPET}
             ORDER BY sort_order, id"
        ),
        [folder_id],
    )
}

/// Todos os textos, agrupados por pasta (raiz primeiro) e na ordem manual de cada uma.
pub fn list_all_snippets(conn: &Connection) -> Result<Vec<Snippet>> {
    query_list(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM snippets WHERE {LIVE_SNIPPET}
             ORDER BY folder_id IS NOT NULL, folder_id, sort_order, id"
        ),
        [],
    )
}

/// Favoritos de todas as pastas, por título sem diferenciar maiúsculas (ASCII).
pub fn list_favorites(conn: &Connection) -> Result<Vec<Snippet>> {
    query_list(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM snippets WHERE favorite = 1 AND {LIVE_SNIPPET}
             ORDER BY title COLLATE NOCASE, id"
        ),
        [],
    )
}

/// Busca em título e conteúdo; todos os termos são exigidos e cada um corresponde
/// por prefixo. Resultados mais relevantes primeiro, com peso maior para o título.
pub fn search_snippets(conn: &Connection, query: &str) -> Result<Vec<Snippet>> {
    let Some(query) = fts_query(query) else {
        return Ok(Vec::new());
    };
    query_list(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM snippets_fts JOIN snippets ON snippets.id = snippets_fts.rowid
             WHERE snippets_fts MATCH ?1 AND {LIVE_SNIPPET}
             ORDER BY bm25(snippets_fts, 10.0, 1.0), snippets.id"
        ),
        [query],
    )
}

/// Converte a entrada do usuário em uma consulta FTS5 segura: cada termo vira uma
/// frase entre aspas com prefixo, de modo que operadores e símbolos da sintaxe FTS5
/// sejam tratados como texto. Termos sem letras ou dígitos são descartados.
fn fts_query(input: &str) -> Option<String> {
    let terms: Vec<String> = input
        .split_whitespace()
        .filter(|term| term.chars().any(char::is_alphanumeric))
        .map(|term| format!("\"{}\"*", term.replace('"', "\"\"")))
        .collect();
    (!terms.is_empty()).then(|| terms.join(" "))
}

pub fn create_snippet(
    conn: &Connection,
    folder_id: Option<i64>,
    title: &str,
    content: &str,
) -> Result<Snippet> {
    let title = required(title, "título")?;
    required(content, "conteúdo")?;
    if let Some(folder_id) = folder_id {
        ensure_folder_exists(conn, folder_id)?;
    }
    let sort_order = next_sort_order(conn, Ordered::Snippets, folder_id)?;
    conn.execute(
        "INSERT INTO snippets (folder_id, title, content, sort_order) VALUES (?1, ?2, ?3, ?4)",
        (folder_id, title, content, sort_order),
    )?;
    get_snippet(conn, conn.last_insert_rowid())
}

pub fn update_snippet(conn: &Connection, id: i64, title: &str, content: &str) -> Result<Snippet> {
    let title = required(title, "título")?;
    required(content, "conteúdo")?;
    ensure_changed(conn.execute(
        &format!("UPDATE snippets SET title = ?1, content = ?2, updated_at = {NOW} WHERE id = ?3"),
        (title, content, id),
    )?)?;
    get_snippet(conn, id)
}

pub fn set_favorite(conn: &Connection, id: i64, favorite: bool) -> Result<Snippet> {
    ensure_changed(conn.execute(
        &format!("UPDATE snippets SET favorite = ?1, updated_at = {NOW} WHERE id = ?2"),
        (favorite, id),
    )?)?;
    get_snippet(conn, id)
}

pub fn delete_snippet(conn: &Connection, id: i64) -> Result<()> {
    ensure_changed(conn.execute("DELETE FROM snippets WHERE id = ?1", [id])?)
}

/// Move o texto para `folder_id` na `position` entre os textos da pasta de destino.
pub fn move_snippet(
    conn: &mut Connection,
    id: i64,
    folder_id: Option<i64>,
    position: usize,
) -> Result<()> {
    let tx = conn.transaction()?;
    if let Some(folder_id) = folder_id {
        ensure_folder_exists(&tx, folder_id)?;
    }
    ensure_changed(tx.execute(
        &format!("UPDATE snippets SET folder_id = ?1, updated_at = {NOW} WHERE id = ?2"),
        (folder_id, id),
    )?)?;
    reorder(&tx, Ordered::Snippets, id, folder_id, position)?;
    tx.commit()?;
    Ok(())
}

/// Registra uma colagem do texto. Não altera `updated_at`, reservado a edições.
pub fn record_use(conn: &Connection, id: i64) -> Result<()> {
    ensure_changed(conn.execute(
        &format!(
            "UPDATE snippets SET use_count = use_count + 1, last_used_at = {NOW} WHERE id = ?1"
        ),
        [id],
    )?)
}

/// Uso e datas de um texto restaurado de um backup.
pub struct Restored<'a> {
    pub favorite: bool,
    pub use_count: i64,
    pub last_used_at: Option<&'a str>,
    /// `None` mantém o instante da criação.
    pub created_at: Option<&'a str>,
    /// `None` mantém o instante da criação.
    pub updated_at: Option<&'a str>,
}

/// Grava no texto o favorito, o uso e as datas de um backup.
pub fn restore(conn: &Connection, id: i64, restored: &Restored) -> Result<()> {
    ensure_changed(conn.execute(
        "UPDATE snippets SET favorite = ?1, use_count = ?2, last_used_at = ?3,
             created_at = COALESCE(?4, created_at), updated_at = COALESCE(?5, updated_at)
         WHERE id = ?6",
        (
            restored.favorite,
            restored.use_count,
            restored.last_used_at,
            restored.created_at,
            restored.updated_at,
            id,
        ),
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::folders::create_folder;
    use crate::db::items::{self, ItemRef, Kind};
    use crate::db::open_in_memory;

    fn titles(snippets: Vec<Snippet>) -> Vec<String> {
        snippets.into_iter().map(|snippet| snippet.title).collect()
    }

    fn search_titles(conn: &Connection, query: &str) -> Vec<String> {
        titles(search_snippets(conn, query).unwrap())
    }

    /// Falha se o índice FTS divergir da tabela `snippets`.
    fn assert_fts_in_sync(conn: &Connection) {
        conn.execute(
            "INSERT INTO snippets_fts(snippets_fts) VALUES ('integrity-check')",
            [],
        )
        .unwrap();
    }

    #[test]
    fn create_appends_to_the_end_of_its_folder() {
        let conn = open_in_memory().unwrap();
        let folder = create_folder(&conn, None, "Trabalho").unwrap();
        let first = create_snippet(&conn, None, "Um", "1").unwrap();
        create_snippet(&conn, None, "Dois", "2").unwrap();
        let inside = create_snippet(&conn, Some(folder.id), "Três", "3").unwrap();

        assert_eq!(first.sort_order, 0);
        assert_eq!(inside.sort_order, 0);
        assert_eq!(inside.folder_id, Some(folder.id));
        assert!(!first.favorite);
        assert_eq!(first.use_count, 0);
        assert_eq!(first.last_used_at, None);
        assert_eq!(titles(list_snippets(&conn, None).unwrap()), ["Um", "Dois"]);
        assert_eq!(
            titles(list_snippets(&conn, Some(folder.id)).unwrap()),
            ["Três"]
        );
    }

    #[test]
    fn list_all_groups_by_folder_in_manual_order() {
        let mut conn = open_in_memory().unwrap();
        let folder = create_folder(&conn, None, "Trabalho").unwrap();
        create_snippet(&conn, Some(folder.id), "Dentro", "d").unwrap();
        let second = create_snippet(&conn, None, "Segundo", "2").unwrap();
        create_snippet(&conn, None, "Primeiro", "1").unwrap();
        move_snippet(&mut conn, second.id, None, 1).unwrap();

        assert_eq!(
            titles(list_all_snippets(&conn).unwrap()),
            ["Primeiro", "Segundo", "Dentro"]
        );
    }

    #[test]
    fn create_validates_fields_and_keeps_content_as_is() {
        let conn = open_in_memory().unwrap();
        let snippet = create_snippet(&conn, None, "  Assinatura ", "\n  Att.,\n").unwrap();
        assert_eq!(snippet.title, "Assinatura");
        assert_eq!(snippet.content, "\n  Att.,\n");

        assert!(matches!(
            create_snippet(&conn, None, " ", "texto"),
            Err(DbError::EmptyField("título"))
        ));
        assert!(matches!(
            create_snippet(&conn, None, "Título", " \n "),
            Err(DbError::EmptyField("conteúdo"))
        ));
        assert!(matches!(
            create_snippet(&conn, Some(42), "Título", "texto"),
            Err(DbError::NotFound)
        ));
    }

    #[test]
    fn update_changes_title_and_content() {
        let conn = open_in_memory().unwrap();
        let snippet = create_snippet(&conn, None, "Antigo", "a").unwrap();
        let updated = update_snippet(&conn, snippet.id, "Novo", "b").unwrap();
        assert_eq!(
            (updated.title.as_str(), updated.content.as_str()),
            ("Novo", "b")
        );

        assert!(matches!(
            update_snippet(&conn, snippet.id, "", "b"),
            Err(DbError::EmptyField("título"))
        ));
        assert!(matches!(
            update_snippet(&conn, 42, "Novo", "b"),
            Err(DbError::NotFound)
        ));
    }

    #[test]
    fn delete_removes_snippet() {
        let conn = open_in_memory().unwrap();
        let snippet = create_snippet(&conn, None, "Título", "texto").unwrap();
        delete_snippet(&conn, snippet.id).unwrap();
        assert!(matches!(
            get_snippet(&conn, snippet.id),
            Err(DbError::NotFound)
        ));
        assert!(matches!(
            delete_snippet(&conn, snippet.id),
            Err(DbError::NotFound)
        ));
    }

    #[test]
    fn favorites_are_listed_by_title_across_folders() {
        let conn = open_in_memory().unwrap();
        let folder = create_folder(&conn, None, "Trabalho").unwrap();
        let beta = create_snippet(&conn, None, "beta", "b").unwrap();
        let alfa = create_snippet(&conn, Some(folder.id), "Alfa", "a").unwrap();
        create_snippet(&conn, None, "Gama", "g").unwrap();

        assert!(set_favorite(&conn, beta.id, true).unwrap().favorite);
        set_favorite(&conn, alfa.id, true).unwrap();
        assert_eq!(titles(list_favorites(&conn).unwrap()), ["Alfa", "beta"]);

        assert!(!set_favorite(&conn, beta.id, false).unwrap().favorite);
        assert_eq!(titles(list_favorites(&conn).unwrap()), ["Alfa"]);
        assert!(matches!(
            set_favorite(&conn, 42, true),
            Err(DbError::NotFound)
        ));
    }

    #[test]
    fn move_reorders_and_changes_folder() {
        let mut conn = open_in_memory().unwrap();
        let folder = create_folder(&conn, None, "Trabalho").unwrap();
        create_snippet(&conn, None, "A", "a").unwrap();
        let b = create_snippet(&conn, None, "B", "b").unwrap();
        let c = create_snippet(&conn, None, "C", "c").unwrap();
        create_snippet(&conn, Some(folder.id), "D", "d").unwrap();

        move_snippet(&mut conn, c.id, None, 0).unwrap();
        assert_eq!(titles(list_snippets(&conn, None).unwrap()), ["C", "A", "B"]);

        move_snippet(&mut conn, b.id, Some(folder.id), 0).unwrap();
        assert_eq!(titles(list_snippets(&conn, None).unwrap()), ["C", "A"]);
        assert_eq!(
            titles(list_snippets(&conn, Some(folder.id)).unwrap()),
            ["B", "D"]
        );

        move_snippet(&mut conn, c.id, Some(folder.id), 99).unwrap();
        assert_eq!(
            titles(list_snippets(&conn, Some(folder.id)).unwrap()),
            ["B", "D", "C"]
        );

        assert!(matches!(
            move_snippet(&mut conn, 42, None, 0),
            Err(DbError::NotFound)
        ));
        assert!(matches!(
            move_snippet(&mut conn, b.id, Some(42), 0),
            Err(DbError::NotFound)
        ));
    }

    #[test]
    fn search_matches_prefixes_ignoring_case_and_accents() {
        let conn = open_in_memory().unwrap();
        create_snippet(&conn, None, "Saudação formal", "Prezado senhor").unwrap();
        create_snippet(&conn, None, "Despedida", "Atenciosamente").unwrap();

        for query in ["sau", "saudacao", "SAUDAÇÃO", "  prez  "] {
            assert_eq!(search_titles(&conn, query), ["Saudação formal"], "{query}");
        }
        assert_eq!(search_titles(&conn, "aten"), ["Despedida"]);
    }

    #[test]
    fn search_requires_all_terms() {
        let conn = open_in_memory().unwrap();
        create_snippet(&conn, None, "Reunião", "Pauta da semana").unwrap();
        create_snippet(&conn, None, "Reunião cancelada", "Sem pauta").unwrap();

        assert_eq!(
            search_titles(&conn, "reuniao cancel"),
            ["Reunião cancelada"]
        );
        assert!(search_titles(&conn, "reuniao inexistente").is_empty());
    }

    #[test]
    fn search_ranks_title_matches_first() {
        let conn = open_in_memory().unwrap();
        create_snippet(&conn, None, "Convite", "Convido para a reunião de amanhã").unwrap();
        create_snippet(&conn, None, "Reunião", "Segue o link").unwrap();

        assert_eq!(search_titles(&conn, "reuniao"), ["Reunião", "Convite"]);
    }

    #[test]
    fn search_treats_syntax_characters_as_text() {
        let conn = open_in_memory().unwrap();
        create_snippet(&conn, None, "Cotação", "Valor: \"R$ 10\" (sem frete)").unwrap();

        for query in [
            "\"", "*", "(", "AND", "OR NOT", "-x", "título:", "^", "a\"b",
        ] {
            search_snippets(&conn, query).unwrap();
        }
        assert_eq!(search_titles(&conn, "(sem"), ["Cotação"]);
        assert_eq!(search_titles(&conn, "\"r$"), ["Cotação"]);
    }

    #[test]
    fn search_without_terms_returns_nothing() {
        let conn = open_in_memory().unwrap();
        create_snippet(&conn, None, "Título", "texto").unwrap();

        for query in ["", "   ", "* - \""] {
            assert!(search_titles(&conn, query).is_empty(), "{query:?}");
        }
    }

    #[test]
    fn search_index_follows_edits_and_deletions() {
        let mut conn = open_in_memory().unwrap();
        let folder = create_folder(&conn, None, "Trabalho").unwrap();
        let edited = create_snippet(&conn, None, "Antigo", "texto").unwrap();
        let deleted = create_snippet(&conn, None, "Removido", "texto").unwrap();
        create_snippet(&conn, Some(folder.id), "Em pasta", "texto").unwrap();

        update_snippet(&conn, edited.id, "Novo", "texto").unwrap();
        assert!(search_titles(&conn, "antigo").is_empty());
        assert_eq!(search_titles(&conn, "novo"), ["Novo"]);

        delete_snippet(&conn, deleted.id).unwrap();
        items::delete(
            &mut conn,
            &[ItemRef {
                kind: Kind::Folder,
                id: folder.id,
            }],
        )
        .unwrap();
        assert_eq!(search_titles(&conn, "texto"), ["Novo"]);
        assert_fts_in_sync(&conn);
    }

    #[test]
    fn record_use_counts_without_touching_updated_at() {
        let conn = open_in_memory().unwrap();
        let snippet = create_snippet(&conn, None, "Título", "texto").unwrap();

        record_use(&conn, snippet.id).unwrap();
        record_use(&conn, snippet.id).unwrap();

        let used = get_snippet(&conn, snippet.id).unwrap();
        assert_eq!(used.use_count, 2);
        assert!(used.last_used_at.is_some());
        assert_eq!(used.updated_at, snippet.updated_at);
        assert!(matches!(record_use(&conn, 42), Err(DbError::NotFound)));
    }
}
