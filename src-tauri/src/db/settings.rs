//! Configurações do aplicativo, guardadas como pares de chave e valor.

use rusqlite::{Connection, OptionalExtension};

use super::Result;

/// Atalho global do menu de colagem, no formato do `tauri-plugin-global-shortcut`.
pub const SHORTCUT: &str = "shortcut";

/// Como as pastas se abrem no menu de colagem: `cascade` (ao passar o mouse) ou `click`.
pub const PICKER_NAVIGATION: &str = "picker_navigation";

pub const NAVIGATION_CASCADE: &str = "cascade";
pub const NAVIGATION_CLICK: &str = "click";

/// Tema das janelas: `system` (segue o Windows), `light` ou `dark`.
pub const THEME: &str = "theme";

pub const THEME_SYSTEM: &str = "system";
pub const THEME_LIGHT: &str = "light";
pub const THEME_DARK: &str = "dark";

/// Se o histórico do clipboard está ligado: `on` ou `off`.
pub const CLIPBOARD_HISTORY: &str = "clipboard_history";

pub const ON: &str = "on";
pub const OFF: &str = "off";

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

/// Tema das janelas; vale `system` enquanto nada foi gravado.
pub fn get_theme(conn: &Connection) -> Result<String> {
    Ok(match get_setting(conn, THEME)?.as_deref() {
        Some(THEME_LIGHT) => THEME_LIGHT,
        Some(THEME_DARK) => THEME_DARK,
        _ => THEME_SYSTEM,
    }
    .to_string())
}

/// Histórico do clipboard; ligado enquanto nada foi gravado.
pub fn get_clipboard_history(conn: &Connection) -> Result<bool> {
    Ok(get_setting(conn, CLIPBOARD_HISTORY)?.as_deref() != Some(OFF))
}

pub fn set_clipboard_history(conn: &Connection, enabled: bool) -> Result<()> {
    set_setting(conn, CLIPBOARD_HISTORY, if enabled { ON } else { OFF })
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

    #[test]
    fn theme_defaults_to_system_and_reads_the_saved_choice() {
        let conn = open_in_memory().unwrap();
        assert_eq!(get_theme(&conn).unwrap(), "system");

        set_setting(&conn, THEME, THEME_DARK).unwrap();
        assert_eq!(get_theme(&conn).unwrap(), "dark");

        set_setting(&conn, THEME, THEME_LIGHT).unwrap();
        assert_eq!(get_theme(&conn).unwrap(), "light");

        set_setting(&conn, THEME, "sepia").unwrap();
        assert_eq!(get_theme(&conn).unwrap(), "system");
    }

    #[test]
    fn clipboard_history_defaults_to_on() {
        let conn = open_in_memory().unwrap();
        assert!(get_clipboard_history(&conn).unwrap());

        set_clipboard_history(&conn, false).unwrap();
        assert!(!get_clipboard_history(&conn).unwrap());
        assert_eq!(
            get_setting(&conn, CLIPBOARD_HISTORY).unwrap().as_deref(),
            Some("off")
        );

        set_clipboard_history(&conn, true).unwrap();
        assert!(get_clipboard_history(&conn).unwrap());
    }
}
