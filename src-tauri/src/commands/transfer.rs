use crate::ssh::SshConnection;
use crate::storage::Storage;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

use super::connection::AppState;

#[tauri::command]
pub async fn send_files(
    app: AppHandle,
    storage: State<'_, Storage>,
    profile_id: String,
    local_paths: Vec<String>,
    remote_dir: String,
    session_password: Option<String>,
) -> Result<(), String> {
    let pool = &app.state::<AppState>().connection_pool;

    let mut conn =
        pool.get(&profile_id).ok_or("Not connected. Please connect first.")?;

    if !conn.is_authenticated() {
        let profiles = storage.load_profiles().map_err(|e| e.to_string())?;
        let profile = profiles
            .into_iter()
            .find(|p| p.id == profile_id)
            .ok_or("Profile not found")?;
        conn = SshConnection::connect(&profile, session_password).map_err(|e| e.to_string())?;
    }

    conn.mkdir_p(&remote_dir).map_err(|e| e.to_string())?;

    let cancel_flag = Arc::new(AtomicBool::new(false));

    for local_path in &local_paths {
        let remote_path = format!(
            "{}/{}",
            remote_dir.trim_end_matches('/'),
            std::path::Path::new(local_path)
                .file_name()
                .unwrap()
                .to_string_lossy()
        );

        conn.upload_file(local_path, &remote_path, &app, cancel_flag.clone())
            .map_err(|e| e.to_string())?;
    }

    pool.add(conn);
    Ok(())
}

#[tauri::command]
pub fn cancel_transfer() -> Result<(), String> {
    Ok(())
}