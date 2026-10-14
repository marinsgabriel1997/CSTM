//! Configurações do aplicativo, guardadas como pares de chave e valor.

use rusqlite::{Connection, OptionalExtension};

use super::Result;

/// Atalho global do menu de colagem, no formato do `tauri-plugin-global-shortcut`.
pub const SHORTCUT: &str = "shortcut";

/// Como as pastas se abrem no menu de colagem: `cascade` (ao passar o mouse) ou `click`.
pub const PICKER_NAVIGATION: &str = "picker_navigation";

pub const NAVIGATION_CASCADE: &str = "cascade";
pub const NAVIGATION_CLICK: &str = "click";

/// Valor gravado para `key`, ou `None` se nunca foi definido.
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    Ok(conn
        .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
            row.get(0)
        })
        .optional()?)
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        (key, value),
    )?;
    Ok(())
}

/// Navegação nas pastas do menu de colagem; vale `cascade` enquanto nada foi gravado.
pub fn get_navigation(conn: &Connection) -> Result<String> {
    Ok(match get_setting(conn, PICKER_NAVIGATION)?.as_deref() {
        Some(NAVIGATION_CLICK) => NAVIGATION_CLICK,
        _ => NAVIGATION_CASCADE,
    }
    .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn missing_setting_is_none() {
        let conn = open_in_memory().unwrap();
        assert_eq!(get_setting(&conn, SHORTCUT).unwrap(), None);
    }

    #[test]
    fn set_creates_and_replaces_the_value() {
        let conn = open_in_memory().unwrap();

        set_setting(&conn, SHORTCUT, "Alt+KeyQ").unwrap();
        assert_eq!(
            get_setting(&conn, SHORTCUT).unwrap().as_deref(),
            Some("Alt+KeyQ")
        );

        set_setting(&conn, SHORTCUT, "Ctrl+Shift+Space").unwrap();
        assert_eq!(
            get_setting(&conn, SHORTCUT).unwrap().as_deref(),
            Some("Ctrl+Shift+Space")
        );
        let count: i64 = conn
            .query_row("SELECT count(*) FROM settings", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn navigation_defaults_to_cascade_and_reads_the_saved_choice() {
        let conn = open_in_memory().unwrap();
        assert_eq!(get_navigation(&conn).unwrap(), "cascade");

        set_setting(&conn, PICKER_NAVIGATION, NAVIGATION_CLICK).unwrap();
        assert_eq!(get_navigation(&conn).unwrap(), "click");

        set_setting(&conn, PICKER_NAVIGATION, NAVIGATION_CASCADE).unwrap();
        assert_eq!(get_navigation(&conn).unwrap(), "cascade");
    }

    #[test]
    fn unknown_saved_navigation_falls_back_to_cascade() {
        let conn = open_in_memory().unwrap();
        set_setting(&conn, PICKER_NAVIGATION, "hover").unwrap();
        assert_eq!(get_navigation(&conn).unwrap(), "cascade");
    }
}
