//! Histórico do clipboard: os últimos itens copiados em qualquer programa, do mais
//! recente para o mais antigo.

use rusqlite::{Connection, OptionalExtension, Row};
use serde::Serialize;

use super::{DbError, NOW, Result, ensure_changed};
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

/// Conteúdo completo de um item, para o editor do cadastro.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardDetail {
    pub id: i64,
    /// `text` ou `image`.
    pub kind: String,
    /// Texto completo.
    pub text: Option<String>,
    /// PNG completo como `data:` URL.
    pub image: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub copied_at: String,
    /// O texto veio com formatação HTML ou RTF.
    pub formatted: bool,
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
/// mesmo texto, ou a mesma imagem) não é repetido; itens na lixeira não contam: o existente sobe para o topo, com a
/// formatação da cópia mais recente. Devolve o id do item.
pub fn record(conn: &mut Connection, content: &Content) -> Result<i64> {
    let tx = conn.transaction()?;
    let position = next_position(&tx)?;
    let id = match content {
        Content::Text(text) => {
            let existing: Option<i64> = tx
                .query_row(
                    "SELECT id FROM clipboard_items
                     WHERE kind = 'text' AND text = ?1 AND deleted_at IS NULL",
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
                     WHERE kind = 'image' AND width = ?1 AND height = ?2 AND image = ?3
                       AND deleted_at IS NULL",
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
    // O limite vale só para o histórico; a lixeira nem conta nem é apagada aqui.
    tx.execute(
        "DELETE FROM clipboard_items WHERE deleted_at IS NULL AND id NOT IN
         (SELECT id FROM clipboard_items WHERE deleted_at IS NULL
          ORDER BY position DESC LIMIT ?1)",
        [LIMIT as i64],
    )?;
    tx.commit()?;
    Ok(id)
}

fn touch_at(conn: &Connection, id: i64, position: i64) -> Result<()> {
    ensure_changed(conn.execute(
        &format!(
            "UPDATE clipboard_items SET position = ?1, copied_at = {NOW}
             WHERE id = ?2 AND deleted_at IS NULL"
        ),
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

/// Colunas lidas por `history_item`; só o começo do texto, porque o título e a dica não
/// precisam do resto.
fn summary_columns() -> String {
    format!(
        "id, kind, substr(text, 1, {}), thumbnail, width, height, copied_at",
        PREVIEW_CHARS + 1
    )
}

/// Itens do mais recente para o mais antigo, sem os dados completos. Os da lixeira ficam de fora.
pub fn list(conn: &Connection) -> Result<Vec<HistoryItem>> {
    let sql = format!(
        "SELECT {} FROM clipboard_items WHERE deleted_at IS NULL ORDER BY position DESC",
        summary_columns()
    );
    let items = conn
        .prepare(&sql)?
        .query_map([], history_item)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(items)
}

/// Conteúdo completo de um item do histórico, para o editor.
pub fn detail(conn: &Connection, id: i64) -> Result<ClipboardDetail> {
    conn.query_row(
        "SELECT kind, text, image, width, height, copied_at, html IS NOT NULL OR rtf IS NOT NULL
         FROM clipboard_items WHERE id = ?1 AND deleted_at IS NULL",
        [id],
        |row| {
            let image: Option<Vec<u8>> = row.get(2)?;
            Ok(ClipboardDetail {
                id,
                kind: row.get(0)?,
                text: row.get(1)?,
                image: image.as_deref().map(clipboard::png_data_url),
                width: row.get(3)?,
                height: row.get(4)?,
                copied_at: row.get(5)?,
                formatted: row.get(6)?,
            })
        },
    )
    .optional()?
    .ok_or(DbError::NotFound)
}

/// Troca o texto de um item do histórico. A formatação HTML/RTF que veio junto deixa de
/// valer e é descartada; o item sobe para o topo, como numa nova cópia.
pub fn update_text(conn: &Connection, id: i64, text: &str) -> Result<HistoryItem> {
    if text.trim().is_empty() {
        return Err(DbError::EmptyField("texto"));
    }
    let kind: String = conn
        .query_row(
            "SELECT kind FROM clipboard_items WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            |row| row.get(0),
        )
        .optional()?
        .ok_or(DbError::NotFound)?;
    if kind != "text" {
        return Err(DbError::NotText);
    }
    ensure_changed(conn.execute(
        &format!(
            "UPDATE clipboard_items SET text = ?1, html = NULL, rtf = NULL, position = ?2,
                 copied_at = {NOW}
             WHERE id = ?3"
        ),
        (text, next_position(conn)?, id),
    )?)?;
    Ok(conn.query_row(
        &format!(
            "SELECT {} FROM clipboard_items WHERE id = ?1",
            summary_columns()
        ),
        [id],
        history_item,
    )?)
}

/// Conteúdo completo do item, para colar ou copiar.
pub fn get(conn: &Connection, id: i64) -> Result<Content> {
    conn.query_row(
        "SELECT kind, text, html, rtf, image, thumbnail, width, height
         FROM clipboard_items WHERE id = ?1 AND deleted_at IS NULL",
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
    )
    .optional()?
    .ok_or(DbError::NotFound)
}

/// Move o item do histórico para a lixeira, com a data `deleted_at`. Quem já estava nela
/// mantém a data da exclusão.
pub fn trash_item(conn: &Connection, id: i64, deleted_at: &str) -> Result<()> {
    ensure_changed(conn.execute(
        "UPDATE clipboard_items SET deleted_at = COALESCE(deleted_at, ?1) WHERE id = ?2",
        (deleted_at, id),
    )?)
}

/// Devolve o item da lixeira ao histórico. A posição é mantida, então ele volta ao lugar
/// que tinha na ordem.
pub fn restore_item(conn: &Connection, id: i64) -> Result<()> {
    ensure_changed(conn.execute(
        "UPDATE clipboard_items SET deleted_at = NULL WHERE id = ?1",
        [id],
    )?)
}

/// Apaga o item definitivamente, esteja ou não na lixeira; um item que não existe é ignorado.
pub fn delete_item(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM clipboard_items WHERE id = ?1", [id])?;
    Ok(())
}

/// Apaga definitivamente os itens que estão na lixeira.
pub fn empty_trash(conn: &Connection) -> Result<()> {
    conn.execute(
        "DELETE FROM clipboard_items WHERE deleted_at IS NOT NULL",
        [],
    )?;
    Ok(())
}

/// Itens na lixeira, do mais recente para o mais antigo no histórico, com a data da exclusão.
pub fn list_trashed(conn: &Connection) -> Result<Vec<(HistoryItem, String)>> {
    let sql = format!(
        "SELECT {}, deleted_at FROM clipboard_items
         WHERE deleted_at IS NOT NULL ORDER BY position DESC",
        summary_columns()
    );
    let items = conn
        .prepare(&sql)?
        .query_map([], |row| Ok((history_item(row)?, row.get(7)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(items)
}

/// Apaga todos os itens, inclusive os da lixeira; devolve quantos eram.
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

    fn trash_at(conn: &Connection, id: i64) {
        trash_item(conn, id, "2026-10-14T09:12:00.000Z").unwrap();
    }

    #[test]
    fn list_ignores_the_trash() {
        let mut conn = open_in_memory().unwrap();
        record(&mut conn, &text("fica")).unwrap();
        let gone = record(&mut conn, &text("sai")).unwrap();
        trash_at(&conn, gone);

        assert_eq!(titles(&conn), ["fica"]);
    }

    #[test]
    fn the_limit_neither_counts_nor_deletes_trashed_items() {
        let mut conn = open_in_memory().unwrap();
        let trashed = record(&mut conn, &text("antigo")).unwrap();
        trash_at(&conn, trashed);
        for index in 0..LIMIT + 3 {
            record(&mut conn, &text(&format!("item {index}"))).unwrap();
        }

        assert_eq!(list(&conn).unwrap().len(), LIMIT);
        assert_eq!(list_trashed(&conn).unwrap().len(), 1);
        restore_item(&conn, trashed).unwrap();
        assert_eq!(list(&conn).unwrap().len(), LIMIT + 1);
    }

    #[test]
    fn copying_the_content_of_a_trashed_item_creates_a_new_item() {
        let mut conn = open_in_memory().unwrap();
        let old = record(&mut conn, &text("repetido")).unwrap();
        let picture = record(&mut conn, &image(b"png", 20)).unwrap();
        trash_at(&conn, old);
        trash_at(&conn, picture);

        let new_text = record(&mut conn, &text("repetido")).unwrap();
        let new_image = record(&mut conn, &image(b"png", 20)).unwrap();

        assert_ne!(new_text, old);
        assert_ne!(new_image, picture);
        assert_eq!(list(&conn).unwrap().len(), 2);
        assert_eq!(list_trashed(&conn).unwrap().len(), 2);
    }

    #[test]
    fn restoring_returns_the_item_to_its_place_in_the_order() {
        let mut conn = open_in_memory().unwrap();
        record(&mut conn, &text("a")).unwrap();
        let b = record(&mut conn, &text("b")).unwrap();
        record(&mut conn, &text("c")).unwrap();
        trash_at(&conn, b);
        record(&mut conn, &text("d")).unwrap();
        assert_eq!(titles(&conn), ["d", "c", "a"]);

        restore_item(&conn, b).unwrap();

        assert_eq!(titles(&conn), ["d", "c", "b", "a"]);
        assert!(matches!(restore_item(&conn, 999), Err(DbError::NotFound)));
    }

    #[test]
    fn trashed_items_are_listed_and_can_be_deleted() {
        let mut conn = open_in_memory().unwrap();
        let a = record(&mut conn, &text("  primeira\nsegunda")).unwrap();
        let picture = record(&mut conn, &image(b"png", 20)).unwrap();
        record(&mut conn, &text("fica")).unwrap();
        trash_at(&conn, a);
        trash_at(&conn, picture);

        let trashed = list_trashed(&conn).unwrap();
        let summary: Vec<_> = trashed
            .iter()
            .map(|(item, at)| (item.title.as_str(), at.as_str()))
            .collect();
        assert_eq!(
            summary,
            [
                ("Imagem 20 × 10", "2026-10-14T09:12:00.000Z"),
                ("primeira", "2026-10-14T09:12:00.000Z")
            ]
        );

        delete_item(&conn, a).unwrap();
        assert_eq!(list_trashed(&conn).unwrap().len(), 1);
        empty_trash(&conn).unwrap();
        assert!(list_trashed(&conn).unwrap().is_empty());
        assert_eq!(titles(&conn), ["fica"]);
    }

    #[test]
    fn trashing_keeps_the_first_deletion_date() {
        let mut conn = open_in_memory().unwrap();
        let id = record(&mut conn, &text("a")).unwrap();
        trash_item(&conn, id, "2026-01-01T00:00:00.000Z").unwrap();
        trash_item(&conn, id, "2026-02-02T00:00:00.000Z").unwrap();

        assert_eq!(
            list_trashed(&conn).unwrap()[0].1,
            "2026-01-01T00:00:00.000Z"
        );
        assert!(matches!(
            trash_item(&conn, 999, "2026-01-01T00:00:00.000Z"),
            Err(DbError::NotFound)
        ));
    }

    #[test]
    fn update_text_drops_the_formatting_and_moves_to_the_top() {
        let mut conn = open_in_memory().unwrap();
        let id = record(
            &mut conn,
            &Content::Text(TextContent {
                text: "antes".into(),
                html: Some(b"<b>antes</b>".to_vec()),
                rtf: Some(b"{\\rtf1 antes}".to_vec()),
            }),
        )
        .unwrap();
        record(&mut conn, &text("outro")).unwrap();

        let item = update_text(&conn, id, "  depois\nlinha 2 ").unwrap();

        assert_eq!(item.id, id);
        assert_eq!(item.title, "depois");
        assert_eq!(list(&conn).unwrap()[0].id, id);
        assert_eq!(get(&conn, id).unwrap(), text("  depois\nlinha 2 "));
        assert!(!detail(&conn, id).unwrap().formatted);
    }

    #[test]
    fn update_text_refuses_empty_images_and_trashed_items() {
        let mut conn = open_in_memory().unwrap();
        let id = record(&mut conn, &text("a")).unwrap();
        let picture = record(&mut conn, &image(b"png", 20)).unwrap();
        let gone = record(&mut conn, &text("b")).unwrap();
        trash_at(&conn, gone);

        assert!(matches!(
            update_text(&conn, id, " \n\t"),
            Err(DbError::EmptyField("texto"))
        ));
        assert!(matches!(
            update_text(&conn, picture, "x"),
            Err(DbError::NotText)
        ));
        assert!(matches!(
            update_text(&conn, gone, "x"),
            Err(DbError::NotFound)
        ));
        assert!(matches!(
            update_text(&conn, 999, "x"),
            Err(DbError::NotFound)
        ));
        assert_eq!(get(&conn, id).unwrap(), text("a"));
    }

    #[test]
    fn detail_returns_the_full_content() {
        let mut conn = open_in_memory().unwrap();
        let long = "x".repeat(600);
        let plain = record(&mut conn, &text(&long)).unwrap();
        let formatted = record(
            &mut conn,
            &Content::Text(TextContent {
                text: "rico".into(),
                html: Some(b"<b>rico</b>".to_vec()),
                rtf: None,
            }),
        )
        .unwrap();
        let picture = record(&mut conn, &image(b"f", 20)).unwrap();

        let plain = detail(&conn, plain).unwrap();
        assert_eq!(plain.text.as_deref(), Some(long.as_str()));
        assert!(!plain.formatted);
        assert_eq!(plain.image, None);
        assert!(detail(&conn, formatted).unwrap().formatted);
        let picture_detail = detail(&conn, picture).unwrap();
        assert_eq!(picture_detail.kind, "image");
        assert_eq!(picture_detail.text, None);
        assert_eq!(
            picture_detail.image.as_deref(),
            Some("data:image/png;base64,Zg==")
        );
        assert_eq!(
            (picture_detail.width, picture_detail.height),
            (Some(20), Some(10))
        );
        assert!(matches!(detail(&conn, 999), Err(DbError::NotFound)));
    }

    #[test]
    fn clear_removes_trashed_items_too() {
        let mut conn = open_in_memory().unwrap();
        record(&mut conn, &text("a")).unwrap();
        let b = record(&mut conn, &text("b")).unwrap();
        trash_at(&conn, b);

        assert_eq!(clear(&conn).unwrap(), 2);
        assert!(list_trashed(&conn).unwrap().is_empty());
    }

    #[test]
    fn trashed_items_cannot_be_read_or_touched() {
        let mut conn = open_in_memory().unwrap();
        let id = record(&mut conn, &text("a")).unwrap();
        trash_at(&conn, id);

        assert!(matches!(get(&conn, id), Err(DbError::NotFound)));
        assert!(matches!(touch(&conn, id), Err(DbError::NotFound)));
        assert!(matches!(detail(&conn, id), Err(DbError::NotFound)));
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
