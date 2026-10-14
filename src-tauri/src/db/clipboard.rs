//! Histórico do clipboard: os últimos itens copiados em qualquer programa, do mais
//! recente para o mais antigo.

use rusqlite::{Connection, OptionalExtension, Row};
use serde::Serialize;

use super::{NOW, Result, ensure_changed};
use crate::clipboard::{self, Content, ImageContent, TextContent};

/// Quantos itens o histórico guarda; ao passar disso, os mais antigos são apagados.
pub const LIMIT: usize = 100;

/// Tamanho máximo do título de um texto, em caracteres.
const TITLE_CHARS: usize = 80;

/// Tamanho máximo da dica de um texto, em caracteres.
const PREVIEW_CHARS: usize = 500;

/// Item como aparece no menu de colagem, sem os dados completos.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: i64,
    /// `text` ou `image`.
    pub kind: String,
    /// Primeira linha não vazia do texto, ou "Imagem L × A".
    pub title: String,
    /// Dica: o começo do texto, ou o mesmo título da imagem.
    pub preview: String,
    /// Miniatura da imagem como `data:` URL.
    pub thumbnail: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    /// Última cópia ou uso.
    pub copied_at: String,
}

/// Corta `text` em `limit` caracteres, com reticências quando sobra algo.
fn shorten(text: &str, limit: usize) -> String {
    match text.char_indices().nth(limit) {
        Some((end, _)) => format!("{}…", text[..end].trim_end()),
        None => text.to_string(),
    }
}

/// Título de um texto: a primeira linha não vazia, sem os espaços das bordas.
pub fn text_title(text: &str) -> String {
    let line = text.lines().map(str::trim).find(|line| !line.is_empty());
    shorten(line.unwrap_or_default(), TITLE_CHARS)
}

pub fn image_title(width: u32, height: u32) -> String {
    format!("Imagem {width} × {height}")
}

/// Posição que coloca um item no topo.
fn next_position(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row(
        "SELECT COALESCE(MAX(position) + 1, 0) FROM clipboard_items",
        [],
        |row| row.get(0),
    )?)
}

/// Guarda um item copiado no topo do histórico. Um item igual a outro já guardado (o
/// mesmo texto, ou a mesma imagem) não é repetido: o existente sobe para o topo, com a
/// formatação da cópia mais recente. Devolve o id do item.
pub fn record(conn: &mut Connection, content: &Content) -> Result<i64> {
    let tx = conn.transaction()?;
    let position = next_position(&tx)?;
    let id = match content {
        Content::Text(text) => {
            let existing: Option<i64> = tx
                .query_row(
                    "SELECT id FROM clipboard_items WHERE kind = 'text' AND text = ?1",
                    [&text.text],
                    |row| row.get(0),
                )
                .optional()?;
            match existing {
                Some(id) => {
                    tx.execute(
                        &format!(
                            "UPDATE clipboard_items SET html = ?1, rtf = ?2, position = ?3, copied_at = {NOW}
                             WHERE id = ?4"
                        ),
                        (&text.html, &text.rtf, position, id),
                    )?;
                    id
                }
                None => {
                    tx.execute(
                        "INSERT INTO clipboard_items (kind, text, html, rtf, position)
                         VALUES ('text', ?1, ?2, ?3, ?4)",
                        (&text.text, &text.html, &text.rtf, position),
                    )?;
                    tx.last_insert_rowid()
                }
            }
        }
        Content::Image(image) => {
            let existing: Option<i64> = tx
                .query_row(
                    "SELECT id FROM clipboard_items
                     WHERE kind = 'image' AND width = ?1 AND height = ?2 AND image = ?3",
                    (image.width, image.height, &image.png),
                    |row| row.get(0),
                )
                .optional()?;
            match existing {
                Some(id) => {
                    touch_at(&tx, id, position)?;
                    id
                }
                None => {
                    tx.execute(
                        "INSERT INTO clipboard_items (kind, image, thumbnail, width, height, position)
                         VALUES ('image', ?1, ?2, ?3, ?4, ?5)",
                        (
                            &image.png,
                            &image.thumbnail,
                            image.width,
                            image.height,
                            position,
                        ),
                    )?;
                    tx.last_insert_rowid()
                }
            }
        }
    };
    tx.execute(
        "DELETE FROM clipboard_items WHERE id NOT IN
         (SELECT id FROM clipboard_items ORDER BY position DESC LIMIT ?1)",
        [LIMIT as i64],
    )?;
    tx.commit()?;
    Ok(id)
}

fn touch_at(conn: &Connection, id: i64, position: i64) -> Result<()> {
    ensure_changed(conn.execute(
        &format!("UPDATE clipboard_items SET position = ?1, copied_at = {NOW} WHERE id = ?2"),
        (position, id),
    )?)
}

/// Leva o item ao topo, como numa nova cópia; usado ao colá-lo ou copiá-lo pelo menu.
pub fn touch(conn: &Connection, id: i64) -> Result<()> {
    touch_at(conn, id, next_position(conn)?)
}

fn history_item(row: &Row) -> rusqlite::Result<HistoryItem> {
    let kind: String = row.get(1)?;
    let text: Option<String> = row.get(2)?;
    let thumbnail: Option<Vec<u8>> = row.get(3)?;
    let width: Option<u32> = row.get(4)?;
    let height: Option<u32> = row.get(5)?;
    let (title, preview) = match (&text, width, height) {
        (Some(text), _, _) => (text_title(text), shorten(text, PREVIEW_CHARS)),
        (None, Some(width), Some(height)) => {
            let title = image_title(width, height);
            (title.clone(), title)
        }
        _ => (String::new(), String::new()),
    };
    Ok(HistoryItem {
        id: row.get(0)?,
        kind,
        title,
        preview,
        thumbnail: thumbnail.as_deref().map(clipboard::png_data_url),
        width,
        height,
        copied_at: row.get(6)?,
    })
}

/// Itens do mais recente para o mais antigo, sem os dados completos.
pub fn list(conn: &Connection) -> Result<Vec<HistoryItem>> {
    // Só o começo do texto: o título e a dica não precisam do resto.
    let sql = format!(
        "SELECT id, kind, substr(text, 1, {}), thumbnail, width, height, copied_at
         FROM clipboard_items ORDER BY position DESC",
        PREVIEW_CHARS + 1
    );
    let items = conn
        .prepare(&sql)?
        .query_map([], history_item)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(items)
}

/// Conteúdo completo do item, para colar ou copiar.
pub fn get(conn: &Connection, id: i64) -> Result<Content> {
    Ok(conn.query_row(
        "SELECT kind, text, html, rtf, image, thumbnail, width, height
         FROM clipboard_items WHERE id = ?1",
        [id],
        |row| {
            Ok(if row.get::<_, String>(0)? == "image" {
                Content::Image(ImageContent {
                    png: row.get(4)?,
                    thumbnail: row.get(5)?,
                    width: row.get(6)?,
                    height: row.get(7)?,
                })
            } else {
                Content::Text(TextContent {
                    text: row.get(1)?,
                    html: row.get(2)?,
                    rtf: row.get(3)?,
                })
            })
        },
    )?)
}

/// Apaga todos os itens; devolve quantos eram.
pub fn clear(conn: &Connection) -> Result<usize> {
    Ok(conn.execute("DELETE FROM clipboard_items", [])?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{DbError, open_in_memory};

    fn text(value: &str) -> Content {
        Content::Text(TextContent::plain(value))
    }

    fn image(png: &[u8], width: u32) -> Content {
        Content::Image(ImageContent {
            png: png.to_vec(),
            thumbnail: vec![9],
            width,
            height: 10,
        })
    }

    fn titles(conn: &Connection) -> Vec<String> {
        list(conn)
            .unwrap()
            .into_iter()
            .map(|item| item.title)
            .collect()
    }

    #[test]
    fn lists_the_most_recent_first() {
        let mut conn = open_in_memory().unwrap();
        record(&mut conn, &text("primeiro")).unwrap();
        record(&mut conn, &image(b"png", 20)).unwrap();
        record(&mut conn, &text("terceiro")).unwrap();

        assert_eq!(titles(&conn), ["terceiro", "Imagem 20 × 10", "primeiro"]);
        let items = list(&conn).unwrap();
        assert_eq!(items[0].kind, "text");
        assert_eq!(items[0].thumbnail, None);
        assert_eq!(items[1].kind, "image");
        assert_eq!(items[1].width, Some(20));
        assert_eq!(
            items[1].thumbnail.as_deref(),
            Some("data:image/png;base64,CQ==")
        );
    }

    #[test]
    fn copying_again_moves_the_item_to_the_top_with_the_new_formatting() {
        let mut conn = open_in_memory().unwrap();
        let first = record(&mut conn, &text("repetido")).unwrap();
        record(&mut conn, &text("outro")).unwrap();
        let again = record(
            &mut conn,
            &Content::Text(TextContent {
                text: "repetido".into(),
                html: Some(b"<b>repetido</b>".to_vec()),
                rtf: None,
            }),
        )
        .unwrap();

        assert_eq!(first, again);
        assert_eq!(titles(&conn), ["repetido", "outro"]);
        let Content::Text(stored) = get(&conn, first).unwrap() else {
            panic!("deveria ser texto");
        };
        assert_eq!(stored.html.as_deref(), Some(&b"<b>repetido</b>"[..]));
    }

    #[test]
    fn the_same_image_is_not_repeated() {
        let mut conn = open_in_memory().unwrap();
        let first = record(&mut conn, &image(b"igual", 20)).unwrap();
        record(&mut conn, &image(b"outra", 20)).unwrap();
        assert_eq!(record(&mut conn, &image(b"igual", 20)).unwrap(), first);
        assert_eq!(list(&conn).unwrap().len(), 2);
        assert_eq!(list(&conn).unwrap()[0].id, first);
    }

    #[test]
    fn keeps_only_the_most_recent_items() {
        let mut conn = open_in_memory().unwrap();
        for index in 0..LIMIT + 5 {
            record(&mut conn, &text(&format!("item {index}"))).unwrap();
        }
        let items = titles(&conn);
        assert_eq!(items.len(), LIMIT);
        assert_eq!(items[0], format!("item {}", LIMIT + 4));
        assert_eq!(items[LIMIT - 1], "item 5");
    }

    #[test]
    fn touching_moves_to_the_top_and_get_returns_every_format() {
        let mut conn = open_in_memory().unwrap();
        let formatted = Content::Text(TextContent {
            text: "olá".into(),
            html: Some(b"<p>ol\xc3\xa1</p>".to_vec()),
            rtf: Some(b"{\\rtf1 ol\\'e1}".to_vec()),
        });
        let id = record(&mut conn, &formatted).unwrap();
        let picture = record(&mut conn, &image(b"png", 30)).unwrap();

        touch(&conn, id).unwrap();
        assert_eq!(list(&conn).unwrap()[0].id, id);
        assert_eq!(get(&conn, id).unwrap(), formatted);
        assert_eq!(get(&conn, picture).unwrap(), image(b"png", 30));
        assert!(matches!(touch(&conn, 999), Err(DbError::NotFound)));
    }

    #[test]
    fn clear_removes_everything() {
        let mut conn = open_in_memory().unwrap();
        record(&mut conn, &text("a")).unwrap();
        record(&mut conn, &text("b")).unwrap();
        assert_eq!(clear(&conn).unwrap(), 2);
        assert!(list(&conn).unwrap().is_empty());
    }

    #[test]
    fn titles_and_previews_of_texts() {
        assert_eq!(
            text_title("\n   \n  Primeira linha  \nsegunda"),
            "Primeira linha"
        );
        assert_eq!(text_title(&"a".repeat(100)), format!("{}…", "a".repeat(80)));
        assert_eq!(image_title(1920, 1080), "Imagem 1920 × 1080");

        let mut conn = open_in_memory().unwrap();
        record(&mut conn, &text(&"x".repeat(600))).unwrap();
        let item = &list(&conn).unwrap()[0];
        assert_eq!(item.preview, format!("{}…", "x".repeat(500)));
    }
}
