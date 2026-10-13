//! Pastas, organizadas em árvore por `parent_id` (`None` = raiz).

use rusqlite::{Connection, OptionalExtension, Row};

use super::{DbError, NOW, Ordered, Result, next_sort_order, reorder, required};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Folder {
    pub id: i64,
    pub parent_id: Option<i64>,
    pub name: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

const COLUMNS: &str = "id, parent_id, name, sort_order, created_at, updated_at";

fn from_row(row: &Row) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get(0)?,
        parent_id: row.get(1)?,
        name: row.get(2)?,
        sort_order: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

pub fn get_folder(conn: &Connection, id: i64) -> Result<Folder> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM folders WHERE id = ?1"),
        [id],
        from_row,
    )
    .optional()?
    .ok_or(DbError::NotFound)
}

/// Todas as pastas, na ordem manual de cada grupo de irmãos; a árvore é montada por quem consome.
pub fn list_folders(conn: &Connection) -> Result<Vec<Folder>> {
    let folders = conn
        .prepare(&format!(
            "SELECT {COLUMNS} FROM folders ORDER BY sort_order, id"
        ))?
        .query_map([], from_row)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(folders)
}

pub fn create_folder(conn: &Connection, parent_id: Option<i64>, name: &str) -> Result<Folder> {
    let name = required(name, "nome")?;
    if let Some(parent_id) = parent_id {
        ensure_folder_exists(conn, parent_id)?;
    }
    let sort_order = next_sort_order(conn, Ordered::Folders, parent_id)?;
    conn.execute(
        "INSERT INTO folders (parent_id, name, sort_order) VALUES (?1, ?2, ?3)",
        (parent_id, name, sort_order),
    )?;
    get_folder(conn, conn.last_insert_rowid())
}

pub fn rename_folder(conn: &Connection, id: i64, name: &str) -> Result<Folder> {
    let name = required(name, "nome")?;
    let changed = conn.execute(
        &format!("UPDATE folders SET name = ?1, updated_at = {NOW} WHERE id = ?2"),
        (name, id),
    )?;
    if changed == 0 {
        return Err(DbError::NotFound);
    }
    get_folder(conn, id)
}

/// Exclui a pasta com suas subpastas e textos (cascata do esquema).
pub fn delete_folder(conn: &Connection, id: i64) -> Result<()> {
    match conn.execute("DELETE FROM folders WHERE id = ?1", [id])? {
        0 => Err(DbError::NotFound),
        _ => Ok(()),
    }
}

/// Move a pasta para `parent_id` na `position` entre os novos irmãos.
pub fn move_folder(
    conn: &mut Connection,
    id: i64,
    parent_id: Option<i64>,
    position: usize,
) -> Result<()> {
    let tx = conn.transaction()?;
    ensure_folder_exists(&tx, id)?;
    if let Some(parent_id) = parent_id {
        ensure_folder_exists(&tx, parent_id)?;
        if is_self_or_descendant(&tx, parent_id, id)? {
            return Err(DbError::FolderCycle);
        }
    }
    tx.execute(
        &format!("UPDATE folders SET parent_id = ?1, updated_at = {NOW} WHERE id = ?2"),
        (parent_id, id),
    )?;
    reorder(&tx, Ordered::Folders, id, parent_id, position)?;
    tx.commit()?;
    Ok(())
}

pub(super) fn ensure_folder_exists(conn: &Connection, id: i64) -> Result<()> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM folders WHERE id = ?1)",
        [id],
        |row| row.get(0),
    )?;
    if exists {
        Ok(())
    } else {
        Err(DbError::NotFound)
    }
}

/// Indica se `folder` é `ancestor` ou está abaixo dele na árvore.
fn is_self_or_descendant(conn: &Connection, folder: i64, ancestor: i64) -> Result<bool> {
    Ok(conn.query_row(
        "WITH RECURSIVE ancestors(id, parent_id) AS (
             SELECT id, parent_id FROM folders WHERE id = ?1
             UNION ALL
             SELECT f.id, f.parent_id FROM folders f JOIN ancestors a ON f.id = a.parent_id
         )
         SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = ?2)",
        (folder, ancestor),
        |row| row.get(0),
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    fn names_in(conn: &Connection, parent_id: Option<i64>) -> Vec<String> {
        list_folders(conn)
            .unwrap()
            .into_iter()
            .filter(|folder| folder.parent_id == parent_id)
            .map(|folder| folder.name)
            .collect()
    }

    #[test]
    fn create_appends_to_the_end_of_its_parent() {
        let conn = open_in_memory().unwrap();
        let work = create_folder(&conn, None, "Trabalho").unwrap();
        create_folder(&conn, None, "Pessoal").unwrap();
        let emails = create_folder(&conn, Some(work.id), "E-mails").unwrap();

        assert_eq!(work.sort_order, 0);
        assert_eq!(emails.sort_order, 0);
        assert_eq!(emails.parent_id, Some(work.id));
        assert_eq!(names_in(&conn, None), ["Trabalho", "Pessoal"]);
    }

    #[test]
    fn create_trims_and_requires_name() {
        let conn = open_in_memory().unwrap();
        assert_eq!(
            create_folder(&conn, None, "  Trabalho ").unwrap().name,
            "Trabalho"
        );
        assert!(matches!(
            create_folder(&conn, None, "   "),
            Err(DbError::EmptyField("nome"))
        ));
    }

    #[test]
    fn create_rejects_missing_parent() {
        let conn = open_in_memory().unwrap();
        assert!(matches!(
            create_folder(&conn, Some(42), "Órfã"),
            Err(DbError::NotFound)
        ));
    }

    #[test]
    fn rename_changes_name() {
        let conn = open_in_memory().unwrap();
        let folder = create_folder(&conn, None, "Trabalho").unwrap();
        assert_eq!(
            rename_folder(&conn, folder.id, "Empresa").unwrap().name,
            "Empresa"
        );
        assert!(matches!(
            rename_folder(&conn, folder.id, ""),
            Err(DbError::EmptyField("nome"))
        ));
        assert!(matches!(
            rename_folder(&conn, 42, "Outra"),
            Err(DbError::NotFound)
        ));
    }

    #[test]
    fn move_reorders_siblings() {
        let mut conn = open_in_memory().unwrap();
        create_folder(&conn, None, "A").unwrap();
        create_folder(&conn, None, "B").unwrap();
        let c = create_folder(&conn, None, "C").unwrap();

        move_folder(&mut conn, c.id, None, 0).unwrap();
        assert_eq!(names_in(&conn, None), ["C", "A", "B"]);

        move_folder(&mut conn, c.id, None, 1).unwrap();
        assert_eq!(names_in(&conn, None), ["A", "C", "B"]);
    }

    #[test]
    fn move_changes_parent_and_clamps_position() {
        let mut conn = open_in_memory().unwrap();
        let a = create_folder(&conn, None, "A").unwrap();
        create_folder(&conn, Some(a.id), "A1").unwrap();
        let b = create_folder(&conn, None, "B").unwrap();

        move_folder(&mut conn, b.id, Some(a.id), 99).unwrap();
        assert_eq!(names_in(&conn, Some(a.id)), ["A1", "B"]);
        assert_eq!(names_in(&conn, None), ["A"]);

        move_folder(&mut conn, b.id, None, 0).unwrap();
        assert_eq!(names_in(&conn, None), ["B", "A"]);
    }

    #[test]
    fn move_rejects_cycles_and_missing_folders() {
        let mut conn = open_in_memory().unwrap();
        let a = create_folder(&conn, None, "A").unwrap();
        let b = create_folder(&conn, Some(a.id), "B").unwrap();
        let c = create_folder(&conn, Some(b.id), "C").unwrap();

        for target in [a.id, b.id, c.id] {
            assert!(matches!(
                move_folder(&mut conn, a.id, Some(target), 0),
                Err(DbError::FolderCycle)
            ));
        }
        assert!(matches!(
            move_folder(&mut conn, 42, None, 0),
            Err(DbError::NotFound)
        ));
        assert!(matches!(
            move_folder(&mut conn, a.id, Some(42), 0),
            Err(DbError::NotFound)
        ));
        assert_eq!(get_folder(&conn, a.id).unwrap().parent_id, None);
    }

    #[test]
    fn delete_cascades_to_subfolders_and_snippets() {
        let conn = open_in_memory().unwrap();
        let a = create_folder(&conn, None, "A").unwrap();
        let b = create_folder(&conn, Some(a.id), "B").unwrap();
        let other = create_folder(&conn, None, "Outra").unwrap();
        conn.execute(
            "INSERT INTO snippets (folder_id, title, content) VALUES (?1, 'T', 'C')",
            [b.id],
        )
        .unwrap();

        delete_folder(&conn, a.id).unwrap();

        assert_eq!(list_folders(&conn).unwrap(), [other]);
        let snippets: i64 = conn
            .query_row("SELECT count(*) FROM snippets", [], |row| row.get(0))
            .unwrap();
        assert_eq!(snippets, 0);
        assert!(matches!(delete_folder(&conn, a.id), Err(DbError::NotFound)));
    }
}
