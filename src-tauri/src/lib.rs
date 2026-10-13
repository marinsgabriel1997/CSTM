use std::sync::Mutex;

use tauri::Manager;

#[expect(
    dead_code,
    reason = "a camada de banco só é usada pelos comandos Tauri a partir do p30"
)]
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
