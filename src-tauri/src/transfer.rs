//! Importação e exportação de textos: pastas com arquivos `.txt` e backup JSON completo.
//! Recebe caminhos já escolhidos; os seletores de arquivo ficam em `commands`.

use std::collections::{HashMap, HashSet};
use std::fmt;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::db::folders::{self, Folder};
use crate::db::snippets::{self, Restored, Snippet};
use crate::db::{self, DbError};

const BACKUP_FORMAT: &str = "cstm";
const BACKUP_VERSION: u64 = 1;

/// Pasta exportada em `.txt` quando a biblioteca inteira é exportada.
const LIBRARY_DIR: &str = "CSTM";

/// Título de um `.txt` cujo nome não tem letras.
const UNTITLED: &str = "Sem título";

/// Limite de caracteres dos nomes gravados no disco, com folga para o caminho completo.
const MAX_NAME_CHARS: usize = 100;

/// Item da árvore exportada ou importada, na ordem manual.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum Item {
    Folder {
        name: String,
        #[serde(default)]
        items: Vec<Item>,
    },
    Snippet(SnippetItem),
}

/// Texto com o uso e as datas; vindos de um `.txt`, ficam com os valores padrão.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
struct SnippetItem {
    title: String,
    content: String,
    #[serde(default)]
    favorite: bool,
    #[serde(default)]
    use_count: u32,
    #[serde(default)]
    last_used_at: Option<String>,
    #[serde(default)]
    created_at: Option<String>,
    #[serde(default)]
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Backup {
    format: String,
    version: u64,
    exported_at: String,
    items: Vec<Item>,
}

/// Motivo de um arquivo não ter sido importado.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SkipReason {
    NotTxt,
    Empty,
    NotUtf8,
    Link,
    Unreadable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Skipped {
    /// Caminho relativo à pasta escolhida, ou o nome do arquivo.
    pub path: String,
    pub reason: SkipReason,
}

/// Resultado de uma importação ou exportação.
#[derive(Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub folders: usize,
    pub snippets: usize,
    pub skipped: Vec<Skipped>,
    /// Pasta ou arquivo criado pela exportação.
    pub path: Option<String>,
}

#[derive(Debug)]
pub enum TransferError {
    Db(DbError),
    Io { path: PathBuf, error: io::Error },
    NotBackup,
    NewerBackup,
    InvalidBackup(String),
}

pub type Result<T> = std::result::Result<T, TransferError>;

impl fmt::Display for TransferError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Db(error) => error.fmt(f),
            Self::Io { path, error } => {
                write!(f, "não foi possível acessar {}: {error}", path.display())
            }
            Self::NotBackup => write!(f, "o arquivo não é um backup do CSTM"),
            Self::NewerBackup => write!(f, "o backup é de uma versão mais nova do CSTM"),
            Self::InvalidBackup(detail) => write!(f, "o backup tem dados inválidos ({detail})"),
        }
    }
}

impl std::error::Error for TransferError {}

impl From<DbError> for TransferError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for TransferError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(error.into())
    }
}

fn io_error(path: &Path) -> impl FnOnce(io::Error) -> TransferError + '_ {
    move |error| TransferError::Io {
        path: path.to_path_buf(),
        error,
    }
}

// ---------- Importação ----------

/// Cria um texto por arquivo `.txt` na pasta `folder_id` (`None` = raiz).
pub fn import_txt_files(
    conn: &mut Connection,
    folder_id: Option<i64>,
    paths: &[PathBuf],
) -> Result<Summary> {
    let mut paths = paths.to_vec();
    paths.sort_by_key(|path| sort_key(&display_name(path)));
    let mut skipped = Vec::new();
    let items = paths
        .iter()
        .filter_map(|path| read_file(path, display_name(path), &mut skipped))
        .collect::<Vec<_>>();
    import_items(conn, folder_id, &items, skipped)
}

/// Importa a pasta `dir` com subpastas e textos. Com `include_root`, a própria pasta
/// é criada em `folder_id`; sem ele, apenas o seu conteúdo.
pub fn import_folder(
    conn: &mut Connection,
    folder_id: Option<i64>,
    dir: &Path,
    include_root: bool,
) -> Result<Summary> {
    let mut skipped = Vec::new();
    let items = read_dir(dir, dir, &mut skipped).map_err(io_error(dir))?;
    let items = if include_root {
        vec![Item::Folder {
            name: display_name(dir),
            items,
        }]
    } else {
        items
    };
    import_items(conn, folder_id, &items, skipped)
}

/// Recria em `folder_id` os itens de um backup JSON, com favoritos, ordem, uso e datas.
pub fn import_json(conn: &mut Connection, folder_id: Option<i64>, file: &Path) -> Result<Summary> {
    let bytes = fs::read(file).map_err(io_error(file))?;
    let backup = parse_backup(&bytes)?;
    import_items(conn, folder_id, &backup.items, Vec::new())
}

fn parse_backup(bytes: &[u8]) -> Result<Backup> {
    let value: Value = serde_json::from_slice(bytes).map_err(|_| TransferError::NotBackup)?;
    if value.get("format").and_then(Value::as_str) != Some(BACKUP_FORMAT) {
        return Err(TransferError::NotBackup);
    }
    match value.get("version").and_then(Value::as_u64) {
        Some(BACKUP_VERSION) => {}
        Some(version) if version > BACKUP_VERSION => return Err(TransferError::NewerBackup),
        _ => return Err(TransferError::InvalidBackup("versão".into())),
    }
    serde_json::from_value(value).map_err(|error| TransferError::InvalidBackup(error.to_string()))
}

/// Grava os itens numa única transação: em qualquer erro, nada fica no banco.
fn import_items(
    conn: &mut Connection,
    folder_id: Option<i64>,
    items: &[Item],
    skipped: Vec<Skipped>,
) -> Result<Summary> {
    let tx = conn.transaction()?;
    if let Some(folder_id) = folder_id {
        folders::get_folder(&tx, folder_id)?;
    }
    let mut summary = Summary {
        skipped,
        ..Summary::default()
    };
    insert(&tx, folder_id, items, &mut summary)?;
    tx.commit()?;
    Ok(summary)
}

fn insert(
    conn: &Connection,
    parent: Option<i64>,
    items: &[Item],
    summary: &mut Summary,
) -> Result<()> {
    for item in items {
        match item {
            Item::Folder { name, items } => {
                let folder = folders::create_folder(conn, parent, name)?;
                summary.folders += 1;
                insert(conn, Some(folder.id), items, summary)?;
            }
            Item::Snippet(snippet) => {
                let created =
                    snippets::create_snippet(conn, parent, &snippet.title, &snippet.content)?;
                if *snippet != SnippetItem::with_text(&snippet.title, &snippet.content) {
                    snippets::restore(
                        conn,
                        created.id,
                        &Restored {
                            favorite: snippet.favorite,
                            use_count: i64::from(snippet.use_count),
                            last_used_at: snippet.last_used_at.as_deref(),
                            created_at: snippet.created_at.as_deref(),
                            updated_at: snippet.updated_at.as_deref(),
                        },
                    )?;
                }
                summary.snippets += 1;
            }
        }
    }
    Ok(())
}

impl SnippetItem {
    fn with_text(title: &str, content: &str) -> Self {
        Self {
            title: title.into(),
            content: content.into(),
            ..Self::default()
        }
    }
}

/// Itens de `dir`, com os arquivos ignorados acumulados em `skipped` (caminhos relativos a `base`).
fn read_dir(dir: &Path, base: &Path, skipped: &mut Vec<Skipped>) -> io::Result<Vec<Item>> {
    let mut entries = fs::read_dir(dir)?.collect::<io::Result<Vec<_>>>()?;
    entries.sort_by_key(|entry| sort_key(&entry.file_name().to_string_lossy()));

    let mut items = Vec::new();
    for entry in entries {
        let path = entry.path();
        let shown = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .display()
            .to_string();
        let skip = |skipped: &mut Vec<Skipped>, reason| {
            skipped.push(Skipped {
                path: shown.clone(),
                reason,
            })
        };
        let Ok(file_type) = entry.file_type() else {
            skip(skipped, SkipReason::Unreadable);
            continue;
        };
        if file_type.is_symlink() {
            skip(skipped, SkipReason::Link);
        } else if file_type.is_dir() {
            match read_dir(&path, base, skipped) {
                Ok(children) => items.push(Item::Folder {
                    name: display_name(&path),
                    items: children,
                }),
                Err(_) => skip(skipped, SkipReason::Unreadable),
            }
        } else if let Some(item) = read_file(&path, shown.clone(), skipped) {
            items.push(item);
        }
    }
    Ok(items)
}

/// Lê um `.txt` como texto; se não puder, registra o motivo em `skipped`.
fn read_file(path: &Path, shown: String, skipped: &mut Vec<Skipped>) -> Option<Item> {
    let result = if is_txt(path) {
        fs::read(path)
            .map_err(|_| SkipReason::Unreadable)
            .and_then(|bytes| decode(&bytes))
    } else {
        Err(SkipReason::NotTxt)
    };
    match result {
        Ok(content) => Some(Item::Snippet(SnippetItem::with_text(
            &title_of(path),
            &content,
        ))),
        Err(reason) => {
            skipped.push(Skipped {
                path: shown,
                reason,
            });
            None
        }
    }
}

fn is_txt(path: &Path) -> bool {
    path.extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("txt"))
}

/// Conteúdo UTF-8 sem BOM e com quebras de linha LF, como o editor grava.
fn decode(bytes: &[u8]) -> std::result::Result<String, SkipReason> {
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    let text = std::str::from_utf8(bytes).map_err(|_| SkipReason::NotUtf8)?;
    let text = text.replace("\r\n", "\n").replace('\r', "\n");
    if text.trim().is_empty() {
        Err(SkipReason::Empty)
    } else {
        Ok(text)
    }
}

fn title_of(path: &Path) -> String {
    path.file_stem()
        .map(|stem| stem.to_string_lossy().trim().to_string())
        .filter(|title| !title.is_empty())
        .unwrap_or_else(|| UNTITLED.into())
}

fn display_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string())
}

/// Ordem alfabética sem diferenciar maiúsculas; empates pelo nome original.
fn sort_key(name: &str) -> (String, String) {
    (name.to_lowercase(), name.to_string())
}

// ---------- Exportação ----------

/// Grava em `file` o backup JSON da biblioteca (`folder_id` = `None`) ou de uma pasta.
pub fn export_json(conn: &Connection, folder_id: Option<i64>, file: &Path) -> Result<Summary> {
    let items = match folder_id {
        None => library(conn, None)?,
        Some(id) => {
            let folder = folders::get_folder(conn, id)?;
            vec![Item::Folder {
                name: folder.name,
                items: library(conn, Some(id))?,
            }]
        }
    };
    let backup = Backup {
        format: BACKUP_FORMAT.into(),
        version: BACKUP_VERSION,
        exported_at: conn.query_row(&format!("SELECT {}", db::NOW), [], |row| row.get(0))?,
        items,
    };
    let json = serde_json::to_string_pretty(&backup).expect("o backup sempre é serializável");
    fs::write(file, json).map_err(io_error(file))?;

    let mut summary = Summary {
        path: Some(file.display().to_string()),
        ..Summary::default()
    };
    count(&backup.items, &mut summary);
    Ok(summary)
}

/// Cria em `dir` uma pasta nova (`CSTM` ou o nome da pasta exportada) com um `.txt` por
/// texto. Nunca sobrescreve: nomes já existentes recebem ` (2)`, ` (3)`…
pub fn export_txt(conn: &Connection, folder_id: Option<i64>, dir: &Path) -> Result<Summary> {
    let name = match folder_id {
        None => LIBRARY_DIR.to_string(),
        Some(id) => folders::get_folder(conn, id)?.name,
    };
    let items = library(conn, folder_id)?;
    let target = create_new_dir(dir, &file_name(&name))?;
    write_items(&target, &items)?;

    let mut summary = Summary {
        path: Some(target.display().to_string()),
        ..Summary::default()
    };
    count(&items, &mut summary);
    Ok(summary)
}

/// Nome sugerido para o backup JSON: `CSTM.json` ou `<pasta>.json`.
pub fn json_file_name(conn: &Connection, folder_id: Option<i64>) -> Result<String> {
    let name = match folder_id {
        None => LIBRARY_DIR.to_string(),
        Some(id) => file_name(&folders::get_folder(conn, id)?.name),
    };
    Ok(format!("{name}.json"))
}

/// Árvore abaixo de `parent`: pastas e depois textos, cada grupo na ordem manual.
fn library(conn: &Connection, parent: Option<i64>) -> Result<Vec<Item>> {
    let mut folders_by_parent: HashMap<Option<i64>, Vec<Folder>> = HashMap::new();
    for folder in folders::list_folders(conn)? {
        folders_by_parent
            .entry(folder.parent_id)
            .or_default()
            .push(folder);
    }
    let mut snippets_by_folder: HashMap<Option<i64>, Vec<Snippet>> = HashMap::new();
    for snippet in snippets::list_all_snippets(conn)? {
        snippets_by_folder
            .entry(snippet.folder_id)
            .or_default()
            .push(snippet);
    }
    Ok(build(
        parent,
        &mut folders_by_parent,
        &mut snippets_by_folder,
    ))
}

fn build(
    parent: Option<i64>,
    folders_by_parent: &mut HashMap<Option<i64>, Vec<Folder>>,
    snippets_by_folder: &mut HashMap<Option<i64>, Vec<Snippet>>,
) -> Vec<Item> {
    let mut items = Vec::new();
    for folder in folders_by_parent.remove(&parent).unwrap_or_default() {
        let children = build(Some(folder.id), folders_by_parent, snippets_by_folder);
        items.push(Item::Folder {
            name: folder.name,
            items: children,
        });
    }
    for snippet in snippets_by_folder.remove(&parent).unwrap_or_default() {
        items.push(Item::Snippet(SnippetItem {
            title: snippet.title,
            content: snippet.content,
            favorite: snippet.favorite,
            use_count: u32::try_from(snippet.use_count).unwrap_or(u32::MAX),
            last_used_at: snippet.last_used_at,
            created_at: Some(snippet.created_at),
            updated_at: Some(snippet.updated_at),
        }));
    }
    items
}

fn count(items: &[Item], summary: &mut Summary) {
    for item in items {
        match item {
            Item::Folder { items, .. } => {
                summary.folders += 1;
                count(items, summary);
            }
            Item::Snippet(_) => summary.snippets += 1,
        }
    }
}

fn create_new_dir(parent: &Path, name: &str) -> Result<PathBuf> {
    for n in 1.. {
        let path = parent.join(numbered(name, "", n));
        match fs::create_dir(&path) {
            Ok(()) => return Ok(path),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(io_error(&path)(error)),
        }
    }
    unreachable!("a sequência de nomes é infinita")
}

fn write_items(dir: &Path, items: &[Item]) -> Result<()> {
    let mut used = HashSet::new();
    for item in items {
        match item {
            Item::Folder { name, items } => {
                let path = dir.join(unique_name(&file_name(name), "", &mut used));
                fs::create_dir(&path).map_err(io_error(&path))?;
                write_items(&path, items)?;
            }
            Item::Snippet(snippet) => {
                let path = dir.join(unique_name(&file_name(&snippet.title), ".txt", &mut used));
                fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&path)
                    .and_then(|mut file| file.write_all(snippet.content.as_bytes()))
                    .map_err(io_error(&path))?;
            }
        }
    }
    Ok(())
}

/// `name` ajustado às regras de nomes de arquivo do Windows.
fn file_name(name: &str) -> String {
    const INVALID: &[char] = &['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    let replaced: String = name
        .chars()
        .map(|c| {
            if c.is_control() || INVALID.contains(&c) {
                '_'
            } else {
                c
            }
        })
        .take(MAX_NAME_CHARS)
        .collect();
    // O Windows descarta pontos e espaços no fim do nome.
    let trimmed = replaced
        .trim_start()
        .trim_end_matches(|c: char| c == '.' || c.is_whitespace());
    if trimmed.is_empty() {
        return "_".into();
    }
    let stem = trimmed.split('.').next().unwrap_or_default().trim_end();
    if is_reserved(stem) {
        format!("_{trimmed}")
    } else {
        trimmed.into()
    }
}

/// Nomes de dispositivo do Windows, inválidos com qualquer extensão.
fn is_reserved(stem: &str) -> bool {
    let stem = stem.to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ["COM", "LPT"].iter().any(|prefix| {
            stem.strip_prefix(prefix)
                .is_some_and(|digit| digit.len() == 1 && digit.as_bytes()[0].is_ascii_digit())
        })
}

/// Primeiro nome livre em `used`, sem diferenciar maiúsculas, como o Windows.
fn unique_name(base: &str, extension: &str, used: &mut HashSet<String>) -> String {
    (1..)
        .map(|n| numbered(base, extension, n))
        .find(|name| used.insert(name.to_lowercase()))
        .expect("a sequência de nomes é infinita")
}

fn numbered(base: &str, extension: &str, n: usize) -> String {
    if n == 1 {
        format!("{base}{extension}")
    } else {
        format!("{base} ({n}){extension}")
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use super::*;
    use crate::db::open_in_memory;

    /// Diretório temporário apagado ao fim do teste.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            static NEXT: AtomicUsize = AtomicUsize::new(0);
            let path = std::env::temp_dir().join(format!(
                "cstm-transfer-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn write(&self, relative: &str, bytes: &[u8]) -> PathBuf {
            let path = self.0.join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(&path, bytes).unwrap();
            path
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    /// Árvore do banco como texto: `pasta/` e `pasta/título=conteúdo`, na ordem manual.
    fn tree(conn: &Connection) -> Vec<String> {
        fn walk(items: &[Item], prefix: &str, lines: &mut Vec<String>) {
            for item in items {
                match item {
                    Item::Folder { name, items } => {
                        lines.push(format!("{prefix}{name}/"));
                        walk(items, &format!("{prefix}{name}/"), lines);
                    }
                    Item::Snippet(snippet) => {
                        lines.push(format!("{prefix}{}={}", snippet.title, snippet.content));
                    }
                }
            }
        }
        let mut lines = Vec::new();
        walk(&library(conn, None).unwrap(), "", &mut lines);
        lines
    }

    fn sample_folder() -> TempDir {
        let dir = TempDir::new();
        dir.write("Clientes/b.txt", b"Texto B");
        dir.write("Clientes/A.TXT", b"\xEF\xBB\xBFTexto A\r\nlinha 2");
        dir.write("Clientes/Sub/c.txt", b"Texto C");
        dir.write("Clientes/logo.png", b"PNG");
        dir.write("Clientes/vazio.txt", b"  \r\n ");
        dir.write("Clientes/ansi.txt", b"Ol\xE1");
        dir
    }

    fn reasons(summary: &Summary) -> Vec<(String, SkipReason)> {
        summary
            .skipped
            .iter()
            .map(|skipped| (skipped.path.replace('\\', "/"), skipped.reason))
            .collect()
    }

    #[test]
    fn decode_accepts_utf8_with_or_without_bom_and_normalizes_line_breaks() {
        assert_eq!(
            decode(b"\xEF\xBB\xBFOl\xC3\xA1\r\nmundo\rfim").unwrap(),
            "Olá\nmundo\nfim"
        );
        assert_eq!(decode(b"sem BOM").unwrap(), "sem BOM");
        assert_eq!(decode(b"Ol\xE1"), Err(SkipReason::NotUtf8));
        assert_eq!(decode(b"\xEF\xBB\xBF \r\n"), Err(SkipReason::Empty));
    }

    #[test]
    fn import_folder_creates_the_folder_itself() {
        let dir = sample_folder();
        let mut conn = open_in_memory().unwrap();
        let summary = import_folder(&mut conn, None, &dir.0.join("Clientes"), true).unwrap();

        assert_eq!(
            tree(&conn),
            [
                "Clientes/",
                "Clientes/Sub/",
                "Clientes/Sub/c=Texto C",
                "Clientes/A=Texto A\nlinha 2",
                "Clientes/b=Texto B",
            ]
        );
        assert_eq!((summary.folders, summary.snippets), (2, 3));
        assert_eq!(
            reasons(&summary),
            [
                ("ansi.txt".to_string(), SkipReason::NotUtf8),
                ("logo.png".to_string(), SkipReason::NotTxt),
                ("vazio.txt".to_string(), SkipReason::Empty),
            ]
        );
    }

    #[test]
    fn import_folder_contents_go_straight_into_the_destination() {
        let dir = sample_folder();
        let mut conn = open_in_memory().unwrap();
        let work = folders::create_folder(&conn, None, "Trabalho").unwrap();
        let summary =
            import_folder(&mut conn, Some(work.id), &dir.0.join("Clientes"), false).unwrap();

        assert_eq!(
            tree(&conn),
            [
                "Trabalho/",
                "Trabalho/Sub/",
                "Trabalho/Sub/c=Texto C",
                "Trabalho/A=Texto A\nlinha 2",
                "Trabalho/b=Texto B",
            ]
        );
        assert_eq!((summary.folders, summary.snippets), (1, 3));
    }

    #[test]
    fn import_txt_files_creates_one_snippet_per_file_at_the_end() {
        let dir = TempDir::new();
        let mut conn = open_in_memory().unwrap();
        snippets::create_snippet(&conn, None, "Existente", "x").unwrap();
        let paths = [
            dir.write("Saudação.txt", "Olá!".as_bytes()),
            dir.write("Assinatura.txt", b"Att."),
            dir.write("notas.md", b"# notas"),
        ];
        let summary = import_txt_files(&mut conn, None, &paths).unwrap();

        assert_eq!(
            tree(&conn),
            ["Existente=x", "Assinatura=Att.", "Saudação=Olá!"]
        );
        assert_eq!(summary.snippets, 2);
        assert_eq!(
            reasons(&summary),
            [("notas.md".to_string(), SkipReason::NotTxt)]
        );
    }

    #[test]
    fn import_into_a_missing_folder_fails_without_writing() {
        let dir = sample_folder();
        let mut conn = open_in_memory().unwrap();
        assert!(matches!(
            import_folder(&mut conn, Some(42), &dir.0.join("Clientes"), true),
            Err(TransferError::Db(DbError::NotFound))
        ));
        assert!(tree(&conn).is_empty());
    }

    #[test]
    fn file_names_follow_windows_rules() {
        assert_eq!(
            file_name("Pedido: 1/2 <urgente>?"),
            "Pedido_ 1_2 _urgente__"
        );
        assert_eq!(file_name("Fim com ponto. . "), "Fim com ponto");
        assert_eq!(file_name("Linha\nquebrada"), "Linha_quebrada");
        assert_eq!(file_name("con"), "_con");
        assert_eq!(file_name("COM1.backup"), "_COM1.backup");
        assert_eq!(file_name("Console"), "Console");
        assert_eq!(file_name("..."), "_");
        assert_eq!(file_name(&"a".repeat(300)).chars().count(), MAX_NAME_CHARS);
    }

    #[test]
    fn repeated_names_are_numbered_ignoring_case() {
        let mut used = HashSet::new();
        assert_eq!(unique_name("Nota", ".txt", &mut used), "Nota.txt");
        assert_eq!(unique_name("nota", ".txt", &mut used), "nota (2).txt");
        assert_eq!(unique_name("Nota", ".txt", &mut used), "Nota (3).txt");
        assert_eq!(unique_name("Nota", "", &mut used), "Nota");
    }

    #[test]
    fn export_txt_round_trips_and_never_overwrites() {
        let dir = TempDir::new();
        let conn = open_in_memory().unwrap();
        let work = folders::create_folder(&conn, None, "Trabalho").unwrap();
        snippets::create_snippet(&conn, Some(work.id), "Resposta: padrão", "Olá!\nAtt.").unwrap();
        snippets::create_snippet(&conn, Some(work.id), "resposta: padrão", "Outra").unwrap();
        snippets::create_snippet(&conn, None, "Telefone", "(11) 90000-0000").unwrap();
        fs::create_dir(dir.0.join("CSTM")).unwrap();

        let summary = export_txt(&conn, None, &dir.0).unwrap();

        let target = dir.0.join("CSTM (2)");
        assert_eq!(summary.path, Some(target.display().to_string()));
        assert_eq!((summary.folders, summary.snippets), (1, 3));
        assert_eq!(
            fs::read_to_string(target.join("Trabalho/Resposta_ padrão.txt")).unwrap(),
            "Olá!\nAtt."
        );
        assert_eq!(
            fs::read_to_string(target.join("Trabalho/resposta_ padrão (2).txt")).unwrap(),
            "Outra"
        );

        let mut imported = open_in_memory().unwrap();
        import_folder(&mut imported, None, &target, false).unwrap();
        assert_eq!(
            tree(&imported),
            [
                "Trabalho/",
                "Trabalho/resposta_ padrão (2)=Outra",
                "Trabalho/Resposta_ padrão=Olá!\nAtt.",
                "Telefone=(11) 90000-0000",
            ]
        );
    }

    #[test]
    fn export_txt_of_a_folder_creates_a_directory_with_its_name() {
        let dir = TempDir::new();
        let conn = open_in_memory().unwrap();
        let work = folders::create_folder(&conn, None, "Trabalho").unwrap();
        snippets::create_snippet(&conn, Some(work.id), "Nota", "texto").unwrap();
        snippets::create_snippet(&conn, None, "Fora", "não vai").unwrap();

        export_txt(&conn, Some(work.id), &dir.0).unwrap();

        assert_eq!(
            fs::read_to_string(dir.0.join("Trabalho/Nota.txt")).unwrap(),
            "texto"
        );
        assert!(!dir.0.join("Trabalho/Fora.txt").exists());
    }

    #[test]
    fn json_round_trip_preserves_order_favorites_usage_and_dates() {
        let dir = TempDir::new();
        let conn = open_in_memory().unwrap();
        let work = folders::create_folder(&conn, None, "Trabalho").unwrap();
        let second = snippets::create_snippet(&conn, Some(work.id), "Segundo", "2").unwrap();
        let first = snippets::create_snippet(&conn, Some(work.id), "Primeiro", "1").unwrap();
        let mut moved = conn;
        snippets::move_snippet(&mut moved, first.id, Some(work.id), 0).unwrap();
        let conn = moved;
        snippets::set_favorite(&conn, second.id, true).unwrap();
        snippets::record_use(&conn, second.id).unwrap();
        snippets::record_use(&conn, second.id).unwrap();
        let file = dir.0.join("backup.json");

        let summary = export_json(&conn, None, &file).unwrap();
        assert_eq!((summary.folders, summary.snippets), (1, 2));

        let mut imported = open_in_memory().unwrap();
        let summary = import_json(&mut imported, None, &file).unwrap();
        assert_eq!((summary.folders, summary.snippets), (1, 2));

        let strip = |snippet: Snippet| {
            (
                snippet.title,
                snippet.favorite,
                snippet.use_count,
                snippet.last_used_at,
                snippet.created_at,
                snippet.updated_at,
            )
        };
        let original = snippets::list_all_snippets(&conn)
            .unwrap()
            .into_iter()
            .map(strip);
        let restored = snippets::list_all_snippets(&imported)
            .unwrap()
            .into_iter()
            .map(strip);
        assert_eq!(original.collect::<Vec<_>>(), restored.collect::<Vec<_>>());
        assert_eq!(
            tree(&imported),
            ["Trabalho/", "Trabalho/Primeiro=1", "Trabalho/Segundo=2"]
        );
    }

    #[test]
    fn json_export_of_a_folder_contains_the_folder_itself() {
        let dir = TempDir::new();
        let mut conn = open_in_memory().unwrap();
        let work = folders::create_folder(&conn, None, "Trabalho").unwrap();
        snippets::create_snippet(&conn, Some(work.id), "Nota", "texto").unwrap();
        let file = dir.0.join("Trabalho.json");

        export_json(&conn, Some(work.id), &file).unwrap();
        import_json(&mut conn, Some(work.id), &file).unwrap();

        assert_eq!(
            tree(&conn),
            [
                "Trabalho/",
                "Trabalho/Trabalho/",
                "Trabalho/Trabalho/Nota=texto",
                "Trabalho/Nota=texto"
            ]
        );
    }

    #[test]
    fn invalid_backups_import_nothing() {
        let dir = TempDir::new();
        let mut conn = open_in_memory().unwrap();
        type Expected = fn(&TransferError) -> bool;
        let cases: [(&str, Expected); 5] = [
            ("não é JSON", |e| matches!(e, TransferError::NotBackup)),
            (r#"{"format": "outro", "version": 1}"#, |e| {
                matches!(e, TransferError::NotBackup)
            }),
            (
                r#"{"format": "cstm", "version": 2, "exported_at": "", "items": []}"#,
                |e| matches!(e, TransferError::NewerBackup),
            ),
            (
                r#"{"format": "cstm", "version": 1, "exported_at": "", "items": [{"type": "snippet", "title": 3}]}"#,
                |e| matches!(e, TransferError::InvalidBackup(_)),
            ),
            (
                r#"{"format": "cstm", "version": 1, "exported_at": "", "items": [
                    {"type": "folder", "name": "Ok", "items": [{"type": "snippet", "title": "Bom", "content": "x"}]},
                    {"type": "snippet", "title": " ", "content": "sem título"}
                ]}"#,
                |e| matches!(e, TransferError::Db(DbError::EmptyField("título"))),
            ),
        ];
        for (json, expected) in cases {
            let file = dir.write("backup.json", json.as_bytes());
            let error = import_json(&mut conn, None, &file).unwrap_err();
            assert!(expected(&error), "{json}: {error:?}");
        }
        assert!(tree(&conn).is_empty());
    }

    #[test]
    fn summary_is_serialized_in_camel_case() {
        let summary = Summary {
            folders: 1,
            snippets: 2,
            skipped: vec![Skipped {
                path: "logo.png".into(),
                reason: SkipReason::NotTxt,
            }],
            path: None,
        };
        assert_eq!(
            serde_json::to_value(summary).unwrap(),
            serde_json::json!({
                "folders": 1,
                "snippets": 2,
                "skipped": [{"path": "logo.png", "reason": "notTxt"}],
                "path": null,
            })
        );
    }
}
