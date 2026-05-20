use crate::commands::connection::AppState;
use crate::commands::{connection, profiles, transfer};
use crate::ssh::ConnectionPool;
use crate::storage::Storage;

pub mod commands;
pub mod models;
pub mod ssh;
pub mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let storage = Storage::new().expect("Failed to initialize storage");
    let pool = ConnectionPool::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(storage)
        .manage(AppState {
            connection_pool: pool,
        })
        .invoke_handler(tauri::generate_handler![
            profiles::create_profile,
            profiles::list_profiles,
            profiles::get_profile_password,
            profiles::update_profile,
            profiles::delete_profile,
            connection::connect,
            connection::disconnect,
            connection::get_connection_status,
            transfer::send_files,
            transfer::cancel_transfer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}