//! Ícone na bandeja do sistema, que mantém o aplicativo acessível com a janela oculta.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Emitter, Manager};

const MAIN_WINDOW: &str = "main";
const OPEN_ITEM: &str = "open";
// Os ids das páginas são os mesmos que o frontend recebe em `page-requested`.
const SETTINGS_ITEM: &str = "settings";
const HELP_ITEM: &str = "help";
const ABOUT_ITEM: &str = "about";
const QUIT_ITEM: &str = "quit";

/// Evento enviado à janela `main` quando o usuário pede para sair. O frontend grava
/// as alterações pendentes e decide se encerra o aplicativo.
const QUIT_REQUESTED: &str = "quit-requested";
/// Evento enviado à janela `main` para abrir uma página (`settings`, `help` ou `about`)
/// na área do editor.
const PAGE_REQUESTED: &str = "page-requested";

pub fn create(app: &App) -> tauri::Result<()> {
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, OPEN_ITEM, "Abrir cadastro", true, None::<&str>)?,
            &MenuItem::with_id(app, SETTINGS_ITEM, "Configurações", true, None::<&str>)?,
            &MenuItem::with_id(app, HELP_ITEM, "Ajuda", true, None::<&str>)?,
            &MenuItem::with_id(app, ABOUT_ITEM, "Sobre o CSTM", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, QUIT_ITEM, "Sair", true, None::<&str>)?,
        ],
    )?;
    let mut tray = TrayIconBuilder::new()
        .tooltip("CSTM")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            OPEN_ITEM => show_main_window(app),
            page @ (SETTINGS_ITEM | HELP_ITEM | ABOUT_ITEM) => open_page(app, page),
            QUIT_ITEM => request_quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// Traz a janela de cadastro para a frente, mesmo oculta ou minimizada.
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        // Falhas aqui não têm tratamento útil: no pior caso a janela não aparece.
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn open_page(app: &AppHandle, page: &str) {
    show_main_window(app);
    let _ = app.emit_to(MAIN_WINDOW, PAGE_REQUESTED, page);
}

fn request_quit(app: &AppHandle) {
    // Sem a janela, ou sem como avisá-la, não há alterações a preservar.
    let notified = app.get_webview_window(MAIN_WINDOW).is_some()
        && app.emit_to(MAIN_WINDOW, QUIT_REQUESTED, ()).is_ok();
    if !notified {
        app.exit(0);
    }
}
