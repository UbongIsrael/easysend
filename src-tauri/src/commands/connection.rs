use crate::models::{ConnectionStatus, PasswordStorage};
use crate::ssh::SshConnection;
use crate::ssh::ConnectionPool;
use crate::storage::Storage;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct AppState {
    pub connection_pool: ConnectionPool,
}

impl AppState {
    pub fn pool(&self) -> &ConnectionPool {
        &self.connection_pool
    }
}

#[tauri::command]
pub async fn connect(
    app: AppHandle,
    storage: State<'_, Storage>,
    profile_id: String,
    session_password: Option<String>,
) -> Result<(), String> {
    let profiles = storage.load_profiles().map_err(|e| e.to_string())?;
    let profile = profiles
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or("Profile not found")?;

    let _ = app.emit("connection:status", ConnectionStatus::Connecting);

    let password = if let Some(pw) = session_password {
        Some(pw)
    } else if profile.password_storage == PasswordStorage::Encrypted {
        if let Some(enc) = &profile.password {
            Some(storage.decrypt_password(enc).map_err(|e| e.to_string())?)
        } else {
            None
        }
    } else {
        None
    };

    match SshConnection::connect(&profile, password) {
        Ok(conn) => {
            let pool = &app.state::<AppState>().connection_pool;
            pool.add(conn);
            let _ = app.emit("connection:status", ConnectionStatus::Connected);
            Ok(())
        }
        Err(e) => {
            let _ = app.emit(
                "connection:status",
                ConnectionStatus::Error(e.to_string()),
            );
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn disconnect(app: AppHandle, profile_id: String) -> Result<(), String> {
    let pool = &app.state::<AppState>().connection_pool;
    pool.remove(&profile_id);
    let _ = app.emit("connection:status", ConnectionStatus::Disconnected);
    Ok(())
}

#[tauri::command]
pub fn get_connection_status(app: AppHandle, profile_id: String) -> ConnectionStatus {
    let pool = &app.state::<AppState>().connection_pool;
    if pool.is_connected(&profile_id) {
        ConnectionStatus::Connected
    } else {
        ConnectionStatus::Disconnected
    }
}