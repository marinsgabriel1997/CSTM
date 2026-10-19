//! Configurações do aplicativo, guardadas como pares de chave e valor.

use rusqlite::{Connection, OptionalExtension};

use serde::{Deserialize, Serialize};

use super::Result;
use crate::markdown::PasteFormat;
use crate::update::AvailableUpdate;

/// Estado lembrado da janela principal. Posição em pixels físicos e tamanho em pixels
/// lógicos, ambos do estado "normal" (não maximizado): é para ele que a janela volta
/// quando o usuário a desmaximiza.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct MainWindowState {
    pub x: i32,
    pub y: i32,
    pub width: f64,
    pub height: f64,
    pub maximized: bool,
}

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

/// Modo de colagem padrão dos textos cadastrados (ver `markdown::PasteFormat`).
pub const PASTE_FORMAT: &str = "paste_format";

/// O que fazer com o clipboard depois de colar: `keep` ou `restore`.
pub const AFTER_PASTE: &str = "after_paste";

/// Destino do clipboard depois da colagem: manter o item colado ou devolver o conteúdo
/// que havia antes.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AfterPaste {
    #[default]
    Keep,
    Restore,
}

impl AfterPaste {
    fn as_str(self) -> &'static str {
        match self {
            Self::Keep => "keep",
            Self::Restore => "restore",
        }
    }
}

/// Se o histórico do clipboard está ligado: `on` ou `off`.
pub const CLIPBOARD_HISTORY: &str = "clipboard_history";

pub const ON: &str = "on";
pub const OFF: &str = "off";

/// Presente depois que a Ajuda abriu sozinha na primeira execução.
pub const HELP_SHOWN: &str = "help_shown";

/// Posição, tamanho e estado maximizado da janela principal, em JSON (ver `main_window`).
pub const MAIN_WINDOW: &str = "main_window";

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

/// Modo de colagem padrão; vale Markdown (fonte) se nada foi gravado ou o valor é inválido.
pub fn get_paste_format(conn: &Connection) -> Result<PasteFormat> {
    Ok(get_setting(conn, PASTE_FORMAT)?
        .and_then(|value| value.parse().ok())
        .unwrap_or_default())
}

pub fn set_paste_format(conn: &Connection, format: PasteFormat) -> Result<()> {
    set_setting(conn, PASTE_FORMAT, format.as_str())
}

/// Destino do clipboard após colar; vale `Keep` se nada foi gravado ou o valor é inválido.
pub fn get_after_paste(conn: &Connection) -> Result<AfterPaste> {
    Ok(match get_setting(conn, AFTER_PASTE)?.as_deref() {
        Some("restore") => AfterPaste::Restore,
        _ => AfterPaste::Keep,
    })
}

pub fn set_after_paste(conn: &Connection, value: AfterPaste) -> Result<()> {
    set_setting(conn, AFTER_PASTE, value.as_str())
}

/// Histórico do clipboard; ligado enquanto nada foi gravado.
pub fn get_clipboard_history(conn: &Connection) -> Result<bool> {
    Ok(get_setting(conn, CLIPBOARD_HISTORY)?.as_deref() != Some(OFF))
}

pub fn set_clipboard_history(conn: &Connection, enabled: bool) -> Result<()> {
    set_setting(conn, CLIPBOARD_HISTORY, if enabled { ON } else { OFF })
}

/// Estado salvo da janela principal; `None` se nunca foi gravado ou se o JSON é inválido
/// (nesse caso a janela abre como na primeira vez).
pub fn get_main_window(conn: &Connection) -> Result<Option<MainWindowState>> {
    Ok(get_setting(conn, MAIN_WINDOW)?.and_then(|json| serde_json::from_str(&json).ok()))
}

pub fn set_main_window(conn: &Connection, state: &MainWindowState) -> Result<()> {
    // Estruturas simples com números e booleano nunca falham ao serializar.
    let json = serde_json::to_string(state).expect("MainWindowState é serializável");
    set_setting(conn, MAIN_WINDOW, &json)
}

/// Verificação de atualização ligada: `on` ou `off`.
pub const UPDATE_CHECK: &str = "update_check";

/// Intervalo, em dias, entre as verificações automáticas.
pub const UPDATE_INTERVAL_DAYS: &str = "update_interval_days";

/// Instante da última verificação bem-sucedida, em segundos Unix.
pub const UPDATE_LAST_CHECK: &str = "update_last_check";

/// Última release encontrada, em JSON (ver `update::AvailableUpdate`).
pub const UPDATE_LATEST: &str = "update_latest";

/// Última versão avisada por notificação do Windows.
pub const UPDATE_NOTIFIED: &str = "update_notified";

/// Última versão dispensada na barra de aviso da janela principal.
pub const UPDATE_DISMISSED: &str = "update_dismissed";

pub const UPDATE_INTERVAL_DEFAULT: u32 = 7;
pub const UPDATE_INTERVAL_MIN: u32 = 1;
pub const UPDATE_INTERVAL_MAX: u32 = 90;

/// Configuração da verificação automática de atualização.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettings {
    pub enabled: bool,
    pub interval_days: u32,
}

fn clamp_interval(days: u32) -> u32 {
    days.clamp(UPDATE_INTERVAL_MIN, UPDATE_INTERVAL_MAX)
}

/// Verificação ligada e intervalo; valem ligada e 7 dias enquanto nada válido foi gravado.
pub fn get_update_settings(conn: &Connection) -> Result<UpdateSettings> {
    let interval_days = get_setting(conn, UPDATE_INTERVAL_DAYS)?
        .and_then(|value| value.trim().parse::<u32>().ok())
        .map_or(UPDATE_INTERVAL_DEFAULT, clamp_interval);
    Ok(UpdateSettings {
        enabled: get_setting(conn, UPDATE_CHECK)?.as_deref() != Some(OFF),
        interval_days,
    })
}

/// Grava a configuração com o intervalo limitado a 1..=90 e devolve o valor gravado.
pub fn set_update_settings(
    conn: &Connection,
    enabled: bool,
    interval_days: u32,
) -> Result<UpdateSettings> {
    let interval_days = clamp_interval(interval_days);
    set_setting(conn, UPDATE_CHECK, if enabled { ON } else { OFF })?;
    set_setting(conn, UPDATE_INTERVAL_DAYS, &interval_days.to_string())?;
    Ok(UpdateSettings {
        enabled,
        interval_days,
    })
}

/// Instante da última verificação; `None` se nunca ocorreu ou o valor é inválido.
pub fn get_update_last_check(conn: &Connection) -> Result<Option<i64>> {
    Ok(get_setting(conn, UPDATE_LAST_CHECK)?.and_then(|value| value.trim().parse().ok()))
}

pub fn set_update_last_check(conn: &Connection, timestamp: i64) -> Result<()> {
    set_setting(conn, UPDATE_LAST_CHECK, &timestamp.to_string())
}

/// Última release encontrada; `None` se nunca houve ou o JSON é inválido.
pub fn get_update_latest(conn: &Connection) -> Result<Option<AvailableUpdate>> {
    Ok(get_setting(conn, UPDATE_LATEST)?.and_then(|json| serde_json::from_str(&json).ok()))
}

pub fn set_update_latest(conn: &Connection, update: &AvailableUpdate) -> Result<()> {
    // Duas strings nunca falham ao serializar.
    let json = serde_json::to_string(update).expect("AvailableUpdate é serializável");
    set_setting(conn, UPDATE_LATEST, &json)
}

pub fn get_update_notified(conn: &Connection) -> Result<Option<String>> {
    get_setting(conn, UPDATE_NOTIFIED)
}

pub fn set_update_notified(conn: &Connection, version: &str) -> Result<()> {
    set_setting(conn, UPDATE_NOTIFIED, version)
}

pub fn get_update_dismissed(conn: &Connection) -> Result<Option<String>> {
    get_setting(conn, UPDATE_DISMISSED)
}

pub fn set_update_dismissed(conn: &Connection, version: &str) -> Result<()> {
    set_setting(conn, UPDATE_DISMISSED, version)
}

/// Se a Ajuda ainda deve abrir sozinha; marca-a como mostrada, para abrir uma vez só.
pub fn take_help_prompt(conn: &Connection) -> Result<bool> {
    let pending = get_setting(conn, HELP_SHOWN)?.is_none();
    if pending {
        set_setting(conn, HELP_SHOWN, ON)?;
    }
    Ok(pending)
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
    fn paste_format_defaults_to_markdown_and_round_trips() {
        let conn = open_in_memory().unwrap();
        assert_eq!(get_paste_format(&conn).unwrap(), PasteFormat::Markdown);

        for format in [
            PasteFormat::Plain,
            PasteFormat::Rich,
            PasteFormat::Chat,
            PasteFormat::Markdown,
        ] {
            set_paste_format(&conn, format).unwrap();
            assert_eq!(get_paste_format(&conn).unwrap(), format);
        }
        assert_eq!(
            get_setting(&conn, PASTE_FORMAT).unwrap().as_deref(),
            Some("markdown")
        );
    }

    #[test]
    fn invalid_saved_paste_format_falls_back_to_markdown() {
        let conn = open_in_memory().unwrap();
        set_setting(&conn, PASTE_FORMAT, "rtf").unwrap();
        assert_eq!(get_paste_format(&conn).unwrap(), PasteFormat::Markdown);
    }

    #[test]
    fn after_paste_defaults_to_keep_and_round_trips() {
        let conn = open_in_memory().unwrap();
        assert_eq!(get_after_paste(&conn).unwrap(), AfterPaste::Keep);

        for value in [AfterPaste::Restore, AfterPaste::Keep] {
            set_after_paste(&conn, value).unwrap();
            assert_eq!(get_after_paste(&conn).unwrap(), value);
        }
        set_after_paste(&conn, AfterPaste::Restore).unwrap();
        assert_eq!(
            get_setting(&conn, AFTER_PASTE).unwrap().as_deref(),
            Some("restore")
        );
        assert_eq!(
            serde_json::to_string(&AfterPaste::Restore).unwrap(),
            "\"restore\""
        );
    }

    #[test]
    fn invalid_saved_after_paste_falls_back_to_keep() {
        let conn = open_in_memory().unwrap();
        set_setting(&conn, AFTER_PASTE, "always").unwrap();
        assert_eq!(get_after_paste(&conn).unwrap(), AfterPaste::Keep);
    }

    #[test]
    fn help_prompt_is_taken_only_once() {
        let conn = open_in_memory().unwrap();
        assert!(take_help_prompt(&conn).unwrap());
        assert!(!take_help_prompt(&conn).unwrap());
        assert_eq!(
            get_setting(&conn, HELP_SHOWN).unwrap().as_deref(),
            Some("on")
        );
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

    #[test]
    fn update_settings_default_to_on_every_7_days() {
        let conn = open_in_memory().unwrap();
        assert_eq!(
            get_update_settings(&conn).unwrap(),
            UpdateSettings {
                enabled: true,
                interval_days: 7
            }
        );
    }

    #[test]
    fn update_settings_round_trip_and_clamp_on_write() {
        let conn = open_in_memory().unwrap();

        let saved = set_update_settings(&conn, false, 30).unwrap();
        assert_eq!(
            saved,
            UpdateSettings {
                enabled: false,
                interval_days: 30
            }
        );
        assert_eq!(get_update_settings(&conn).unwrap(), saved);
        assert_eq!(
            get_setting(&conn, UPDATE_CHECK).unwrap().as_deref(),
            Some("off")
        );

        assert_eq!(
            set_update_settings(&conn, true, 0).unwrap().interval_days,
            1
        );
        assert_eq!(
            set_update_settings(&conn, true, 500).unwrap().interval_days,
            90
        );
        assert_eq!(get_update_settings(&conn).unwrap().interval_days, 90);
    }

    #[test]
    fn update_interval_is_clamped_or_defaulted_on_read() {
        let conn = open_in_memory().unwrap();
        for (raw, expected) in [
            ("0", 1),
            ("1000", 90),
            ("14", 14),
            ("abc", 7),
            ("-3", 7),
            ("", 7),
        ] {
            set_setting(&conn, UPDATE_INTERVAL_DAYS, raw).unwrap();
            assert_eq!(get_update_settings(&conn).unwrap().interval_days, expected);
        }
        set_setting(&conn, UPDATE_CHECK, "talvez").unwrap();
        assert!(get_update_settings(&conn).unwrap().enabled);
    }

    #[test]
    fn update_state_values_round_trip() {
        let conn = open_in_memory().unwrap();
        assert_eq!(get_update_last_check(&conn).unwrap(), None);
        assert_eq!(get_update_latest(&conn).unwrap(), None);
        assert_eq!(get_update_notified(&conn).unwrap(), None);
        assert_eq!(get_update_dismissed(&conn).unwrap(), None);

        set_update_last_check(&conn, 1_700_000_000).unwrap();
        assert_eq!(get_update_last_check(&conn).unwrap(), Some(1_700_000_000));
        set_setting(&conn, UPDATE_LAST_CHECK, "ontem").unwrap();
        assert_eq!(get_update_last_check(&conn).unwrap(), None);

        let latest = AvailableUpdate {
            version: "0.19.0".into(),
            url: "https://github.com/marinsgabriel1997/CSTM/releases/tag/v0.19.0".into(),
        };
        set_update_latest(&conn, &latest).unwrap();
        assert_eq!(get_update_latest(&conn).unwrap(), Some(latest));
        set_setting(&conn, UPDATE_LATEST, "não é json").unwrap();
        assert_eq!(get_update_latest(&conn).unwrap(), None);

        set_update_notified(&conn, "0.19.0").unwrap();
        assert_eq!(
            get_update_notified(&conn).unwrap().as_deref(),
            Some("0.19.0")
        );
        set_update_dismissed(&conn, "0.19.0").unwrap();
        assert_eq!(
            get_update_dismissed(&conn).unwrap().as_deref(),
            Some("0.19.0")
        );
    }

    #[test]
    fn main_window_round_trips_and_ignores_invalid_values() {
        let conn = open_in_memory().unwrap();
        assert_eq!(get_main_window(&conn).unwrap(), None);

        let state = MainWindowState {
            x: -1200,
            y: 40,
            width: 1152.0,
            height: 659.0,
            maximized: true,
        };
        set_main_window(&conn, &state).unwrap();
        assert_eq!(get_main_window(&conn).unwrap(), Some(state));

        set_setting(&conn, MAIN_WINDOW, "não é json").unwrap();
        assert_eq!(get_main_window(&conn).unwrap(), None);
        set_setting(&conn, MAIN_WINDOW, r#"{"x":1}"#).unwrap();
        assert_eq!(get_main_window(&conn).unwrap(), None);
    }
}
