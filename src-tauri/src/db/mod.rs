//! Persistência SQLite: conexão, migrações e operações de pastas, textos, configurações e
//! histórico do clipboard.

use std::fmt;
use std::path::Path;

use rusqlite::Connection;
use rusqlite_migration::{M, Migrations};

pub mod clipboard;
pub mod folders;
pub mod items;
pub mod settings;
pub mod snippets;

/// Migrações aplicadas em ordem. Uma migração publicada não deve ser alterada;
/// mudanças de esquema entram como novas migrações no fim da lista.
fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("migrations/0001_initial.sql")),
        M::up(include_str!("migrations/0002_settings.sql")),
        M::up(include_str!("migrations/0003_trash.sql")),
        M::up(include_str!("migrations/0004_clipboard_history.sql")),
        M::up(include_str!("migrations/0005_clipboard_trash.sql")),
    ])
}

#[derive(Debug)]
pub enum DbError {
    Sqlite(rusqlite::Error),
    Migration(rusqlite_migration::Error),
    EmptyField(&'static str),
    NotFound,
    FolderCycle,
    CopyIntoItself,
    /// Itens do histórico não têm pasta nem ordem manual e não saem do clipboard.
    HistoryItem,
    /// Só textos do histórico podem ser editados.
    NotText,
}

pub type Result<T> = std::result::Result<T, DbError>;

impl fmt::Display for DbError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Sqlite(error) => write!(f, "erro do SQLite: {error}"),
            Self::Migration(error) => write!(f, "erro ao migrar o banco: {error}"),
            Self::EmptyField(field) => write!(f, "o campo {field} não pode ficar vazio"),
            Self::NotFound => write!(f, "registro não encontrado"),
            Self::FolderCycle => write!(
                f,
                "uma pasta não pode ser movida para dentro de si mesma ou de uma subpasta"
            ),
            Self::HistoryItem => write!(
                f,
                "itens do histórico não podem ser copiados, movidos nem exportados"
            ),
            Self::NotText => write!(f, "só itens de texto do histórico podem ser editados"),
            Self::CopyIntoItself => write!(
                f,
                "uma pasta não pode ser copiada para dentro de si mesma ou de uma subpasta"
            ),
        }
    }
}

impl std::error::Error for DbError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Sqlite(error) => Some(error),
            Self::Migration(error) => Some(error),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for DbError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sqlite(error)
    }
}

impl From<rusqlite_migration::Error> for DbError {
    fn from(error: rusqlite_migration::Error) -> Self {
        Self::Migration(error)
    }
}

/// Abre (ou cria) o banco em `path` e aplica as migrações pendentes.
pub fn open(path: &Path) -> Result<Connection> {
    let mut conn = Connection::open(path)?;
    init(&mut conn)?;
    Ok(conn)
}

#[cfg(test)]
pub(crate) fn open_in_memory() -> Result<Connection> {
    let mut conn = Connection::open_in_memory()?;
    init(&mut conn)?;
    Ok(conn)
}

fn init(conn: &mut Connection) -> Result<()> {
    // Desativadas por padrão no SQLite; necessárias para as exclusões em cascata.
    conn.pragma_update(None, "foreign_keys", true)?;
    migrations().to_latest(conn)?;
    Ok(())
}

/// Expressão SQL do instante atual no formato gravado em `created_at`/`updated_at`.
pub(crate) const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/// Condição dos textos fora da lixeira: nem o texto nem uma pasta acima dele foi excluído.
pub(crate) const LIVE_SNIPPET: &str = "snippets.deleted_at IS NULL     AND (snippets.folder_id IS NULL OR snippets.folder_id IN (SELECT id FROM live_folders))";

/// Retorna `value` sem os espaços das bordas, ou erro se ficar vazio.
fn required<'a>(value: &'a str, field: &'static str) -> Result<&'a str> {
    let value = value.trim();
    if value.is_empty() {
        Err(DbError::EmptyField(field))
    } else {
        Ok(value)
    }
}

/// Erro de registro não encontrado quando uma alteração não atingiu nenhuma linha.
fn ensure_changed(changed: usize) -> Result<()> {
    if changed == 0 {
        Err(DbError::NotFound)
    } else {
        Ok(())
    }
}

/// Tabelas com ordenação manual entre irmãos (itens com o mesmo pai).
#[derive(Clone, Copy)]
enum Ordered {
    Folders,
    Snippets,
}

impl Ordered {
    fn table(self) -> &'static str {
        match self {
            Self::Folders => "folders",
            Self::Snippets => "snippets",
        }
    }

    /// Coluna com o nome exibido do item.
    fn name_column(self) -> &'static str {
        match self {
            Self::Folders => "name",
            Self::Snippets => "title",
        }
    }

    fn parent_column(self) -> &'static str {
        match self {
            Self::Folders => "parent_id",
            Self::Snippets => "folder_id",
        }
    }
}

/// Posição de um novo item no fim da lista de irmãos.
fn next_sort_order(conn: &Connection, kind: Ordered, parent: Option<i64>) -> Result<i64> {
    let sql = format!(
        "SELECT COALESCE(MAX(sort_order) + 1, 0) FROM {} WHERE {} IS ?1",
        kind.table(),
        kind.parent_column()
    );
    Ok(conn.query_row(&sql, [parent], |row| row.get(0))?)
}

/// Coloca o item `id`, já atribuído a `parent`, na `position` entre seus irmãos fora da
/// lixeira e renumera a ordem do grupo a partir de 0. Posições além do fim vão para o fim.
/// Os irmãos na lixeira não contam: ao serem restaurados, voltam para o fim do grupo.
fn reorder(
    conn: &Connection,
    kind: Ordered,
    id: i64,
    parent: Option<i64>,
    position: usize,
) -> Result<()> {
    let sql = format!(
        "SELECT id FROM {} WHERE {} IS ?1 AND id <> ?2 AND deleted_at IS NULL ORDER BY sort_order, id",
        kind.table(),
        kind.parent_column()
    );
    let mut ids = conn
        .prepare(&sql)?
        .query_map((parent, id), |row| row.get::<_, i64>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    ids.insert(position.min(ids.len()), id);

    let sql = format!("UPDATE {} SET sort_order = ?1 WHERE id = ?2", kind.table());
    let mut update = conn.prepare(&sql)?;
    for (sort_order, id) in ids.iter().enumerate() {
        update.execute((sort_order as i64, id))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_valid() {
        migrations().validate().unwrap();
    }

    #[test]
    fn open_enables_foreign_keys() {
        let conn = open_in_memory().unwrap();
        let enabled: bool = conn
            .pragma_query_value(None, "foreign_keys", |row| row.get(0))
            .unwrap();
        assert!(enabled);
    }

    #[test]
    fn full_text_search_is_available() {
        let conn = open_in_memory().unwrap();
        conn.execute(
            "INSERT INTO snippets (title, content) VALUES ('Saudação', 'Olá')",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM snippets_fts WHERE snippets_fts MATCH 'saudacao'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn trash_migration_keeps_existing_items_visible() {
        let mut conn = Connection::open_in_memory().unwrap();
        // Banco como estava antes da lixeira (migrações 0001 e 0002), com dados.
        Migrations::new(vec![
            M::up(include_str!("migrations/0001_initial.sql")),
            M::up(include_str!("migrations/0002_settings.sql")),
        ])
        .to_latest(&mut conn)
        .unwrap();
        conn.execute("INSERT INTO folders (name) VALUES ('Trabalho')", [])
            .unwrap();
        conn.execute(
            "INSERT INTO snippets (folder_id, title, content) VALUES (1, 'Nota', 'texto')",
            [],
        )
        .unwrap();

        init(&mut conn).unwrap();

        assert_eq!(folders::list_folders(&conn).unwrap().len(), 1);
        assert_eq!(snippets::list_all_snippets(&conn).unwrap().len(), 1);
    }

    #[test]
    fn clipboard_trash_migration_keeps_history_items() {
        let mut conn = Connection::open_in_memory().unwrap();
        // Banco como estava antes da lixeira do histórico (migrações 0001 a 0004).
        Migrations::new(vec![
            M::up(include_str!("migrations/0001_initial.sql")),
            M::up(include_str!("migrations/0002_settings.sql")),
            M::up(include_str!("migrations/0003_trash.sql")),
            M::up(include_str!("migrations/0004_clipboard_history.sql")),
        ])
        .to_latest(&mut conn)
        .unwrap();
        conn.execute(
            "INSERT INTO clipboard_items (kind, text, position) VALUES ('text', 'copiado', 0)",
            [],
        )
        .unwrap();

        init(&mut conn).unwrap();

        let deleted: Vec<Option<String>> = conn
            .prepare("SELECT deleted_at FROM clipboard_items")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert_eq!(deleted, [None]);
        assert_eq!(clipboard::list(&conn).unwrap().len(), 1);
    }

    #[test]
    fn reopening_preserves_data() {
        let path = std::env::temp_dir().join(format!("cstm-test-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&path);

        open(&path)
            .unwrap()
            .execute("INSERT INTO folders (name) VALUES ('Trabalho')", [])
            .unwrap();
        let count: i64 = open(&path)
            .unwrap()
            .query_row("SELECT count(*) FROM folders", [], |row| row.get(0))
            .unwrap();

        std::fs::remove_file(&path).unwrap();
        assert_eq!(count, 1);
    }
}
