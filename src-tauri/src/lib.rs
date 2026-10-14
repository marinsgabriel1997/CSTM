use std::sync::Mutex;

use tauri::Manager;

mod commands;
mod db;
mod picker;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Registrado antes dos demais plugins, como pede o plugin: uma segunda
        // execução apenas traz a janela existente e termina.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main_window(app);
        }))
        .plugin(picker::shortcut_plugin())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let conn = db::open(&data_dir.join("cstm.db"))?;
            picker::register_shortcut(app, &conn);
            app.manage(Mutex::new(conn));
            tray::create(app)?;
            Ok(())
        })
        .on_window_event(picker::on_window_event)
        .invoke_handler(tauri::generate_handler![
            commands::list_folders,
            commands::create_folder,
            commands::rename_folder,
            commands::delete_folder,
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
            commands::show_main_window,
            commands::exit_app,
            commands::hide_picker,
            commands::choose_snippet,
            commands::get_shortcut,
            commands::set_shortcut,
            commands::suspend_shortcut,
            commands::resume_shortcut,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
