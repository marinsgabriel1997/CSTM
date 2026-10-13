use std::sync::Mutex;

use tauri::Manager;

mod commands;
mod db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let conn = db::open(&data_dir.join("cstm.db"))?;
            app.manage(Mutex::new(conn));
            Ok(())
        })
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
