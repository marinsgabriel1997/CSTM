//! Tema das janelas escolhido nas Configurações. O frontend aplica o tema do Fluent UI;
//! o backend aplica o tema da barra de título nativa do cadastro.

use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager, Theme};

use crate::db::settings;

const MAIN_WINDOW: &str = "main";
/// Avisa as duas janelas da troca de tema, com o valor gravado.
const THEME_CHANGED: &str = "theme-changed";

/// Tema nativo correspondente ao valor gravado; `None` segue o Windows.
fn window_theme(theme: &str) -> Result<Option<Theme>, String> {
    match theme {
        settings::THEME_SYSTEM => Ok(None),
        settings::THEME_LIGHT => Ok(Some(Theme::Light)),
        settings::THEME_DARK => Ok(Some(Theme::Dark)),
        _ => Err("tema inválido: use system, light ou dark".to_string()),
    }
}

/// Aplica o tema à barra de título do cadastro.
pub fn apply(app: &AppHandle, theme: &str) {
    if let (Ok(theme), Some(window)) = (window_theme(theme), app.get_webview_window(MAIN_WINDOW)) {
        // Sem efeito útil a tratar: no pior caso a barra de título segue o Windows.
        let _ = window.set_theme(theme);
    }
}

/// Grava o tema e o aplica na hora às duas janelas.
pub fn change(app: &AppHandle, conn: &Connection, theme: &str) -> Result<String, String> {
    window_theme(theme)?;
    settings::set_setting(conn, settings::THEME, theme).map_err(|error| error.to_string())?;
    apply(app, theme);
    let _ = app.emit(THEME_CHANGED, theme);
    Ok(theme.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_the_saved_theme_to_the_window_theme() {
        assert_eq!(window_theme("system"), Ok(None));
        assert_eq!(window_theme("light"), Ok(Some(Theme::Light)));
        assert_eq!(window_theme("dark"), Ok(Some(Theme::Dark)));
        assert!(window_theme("sepia").is_err());
    }
}
