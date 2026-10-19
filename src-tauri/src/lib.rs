use std::sync::Mutex;

use tauri::{App, Manager, WebviewWindowBuilder};

mod autostart;
mod cascade;
mod clipboard;
mod clipboard_history;
mod commands;
mod db;
mod main_window;
mod markdown;
mod paste;
mod picker;
mod theme;
mod transfer;
mod tray;
mod update;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Registrado antes dos demais plugins, como pede o plugin: uma segunda
        // execução apenas traz a janela existente e termina. Se for o Windows iniciando
        // o CSTM ao entrar na sessão, nada aparece.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if !autostart::started_by_windows(args) {
                tray::show_main_window(app);
            }
        }))
        .plugin(picker::shortcut_plugin())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Um erro devolvido ao Tauri vira um panic sem mensagem, que fecha o
            // aplicativo em silêncio; aqui o usuário vê o motivo antes do fim.
            if let Err(error) = setup(app) {
                show_startup_error(&error.to_string());
                std::process::exit(1);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            picker::on_window_event(window, event);
            main_window::on_window_event(window, event);
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_folders,
            commands::create_folder,
            commands::rename_folder,
            commands::move_folder,
            commands::list_snippets,
            commands::list_all_snippets,
            commands::list_favorites,
            commands::search_snippets,
            commands::create_snippet,
            commands::update_snippet,
            commands::set_favorite,
            commands::delete_snippet,
            commands::move_snippet,
            commands::trash_items,
            commands::restore_items,
            commands::delete_items,
            commands::empty_trash,
            commands::list_trash,
            commands::copy_items,
            commands::arrange_items,
            commands::show_main_window,
            commands::exit_app,
            commands::hide_picker,
            commands::choose_snippet,
            commands::copy_snippet,
            commands::list_clipboard_history,
            commands::paste_clipboard_item,
            commands::copy_clipboard_item,
            commands::clear_clipboard_history,
            commands::get_clipboard_monitoring,
            commands::set_clipboard_monitoring,
            commands::get_picker_navigation,
            commands::set_picker_navigation,
            commands::get_paste_format,
            commands::set_paste_format,
            commands::get_after_paste,
            commands::set_after_paste,
            commands::get_update_settings,
            commands::set_update_settings,
            commands::check_update_now,
            commands::get_available_update,
            commands::dismiss_update,
            commands::open_release,
            commands::layout_picker,
            commands::picker_ready,
            commands::get_shortcut,
            commands::set_shortcut,
            commands::suspend_shortcut,
            commands::resume_shortcut,
            commands::take_help_prompt,
            commands::get_data_dir,
            commands::open_repository,
            commands::open_data_folder,
            commands::get_theme,
            commands::set_theme,
            commands::get_autostart,
            commands::set_autostart,
            commands::import_txt_files,
            commands::import_folder,
            commands::import_json,
            commands::export_json,
            commands::export_txt,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;
    let conn = db::open(&data_dir.join("cstm.db"))?;
    picker::register_shortcut(app, &conn);
    let theme = db::settings::get_theme(&conn)?;
    let saved_window = db::settings::get_main_window(&conn)?;
    let clipboard_history = db::settings::get_clipboard_history(&conn)?;
    app.manage(Mutex::new(conn));
    update::start(app.handle());
    app.manage(paste::PasteState::default());
    app.manage(picker::PickerGeometry::default());
    app.manage(main_window::MainWindowTracker::default());
    clipboard_history::start(app.handle(), clipboard_history);
    tray::create(app)?;
    // As janelas têm `create: false` na configuração e só são criadas aqui, com
    // todo o estado registrado: criadas antes do setup, como faz o Tauri, podiam
    // chamar comandos ainda sem o banco quando a inicialização demorava (por
    // exemplo, com o antivírus examinando o executável na primeira execução).
    // Iniciado pelo Windows ao entrar na sessão, o CSTM fica só na bandeja.
    let hidden = autostart::started_by_windows(std::env::args());
    for mut config in app.config().app.windows.clone() {
        let is_main = config.label == "main";
        if is_main {
            // A janela principal nasce oculta para receber o tamanho e a posição antes
            // de aparecer, sem piscar no tamanho da configuração.
            config.visible = false;
        }
        let window = WebviewWindowBuilder::from_config(app, &config)?.build()?;
        if is_main {
            if let Some(state) = main_window::startup_state(app.handle(), saved_window) {
                main_window::apply(app.handle(), &window, state);
            }
            if !hidden {
                window.show()?;
            }
        }
    }
    theme::apply(app.handle(), &theme);
    Ok(())
}

/// Caixa de mensagem nativa: o loop de eventos ainda não roda durante o setup,
/// então os diálogos do plugin não podem ser usados.
#[cfg(windows)]
fn show_startup_error(error: &str) {
    use windows::Win32::UI::WindowsAndMessaging::{MB_ICONERROR, MB_OK, MessageBoxW};
    use windows::core::HSTRING;

    let text = HSTRING::from(format!("O CSTM não pôde ser iniciado: {error}"));
    unsafe {
        MessageBoxW(None, &text, &HSTRING::from("CSTM"), MB_OK | MB_ICONERROR);
    }
}

#[cfg(not(windows))]
fn show_startup_error(error: &str) {
    eprintln!("O CSTM não pôde ser iniciado: {error}");
}
