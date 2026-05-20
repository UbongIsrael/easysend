use crate::models::{AuthMethod, PasswordStorage, Profile};
use crate::storage::Storage;
use tauri::State;

#[tauri::command]
pub fn create_profile(
    storage: State<Storage>,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_method: String,
    password_storage: String,
    password: Option<String>,
    key_path: Option<String>,
    default_remote_dir: String,
) -> Result<Profile, String> {
    let auth = match auth_method.as_str() {
        "password" => AuthMethod::Password,
        "key" => AuthMethod::Key,
        _ => return Err("Invalid auth method".into()),
    };

    let pw_storage = match password_storage.as_str() {
        "encrypted" => PasswordStorage::Encrypted,
        "session" => PasswordStorage::Session,
        _ => return Err("Invalid password storage".into()),
    };

    let mut profiles = storage.load_profiles().map_err(|e| e.to_string())?;

    let stored_password = if let Some(pw) = &password {
        if pw_storage == PasswordStorage::Encrypted {
            Some(storage.encrypt_password(pw).map_err(|e| e.to_string())?)
        } else {
            None
        }
    } else {
        None
    };

    let profile = Profile {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        host,
        port,
        username,
        auth_method: auth,
        password_storage: pw_storage,
        password: stored_password,
        key_path,
        default_remote_dir,
    };

    profiles.push(profile.clone());
    storage.save_profiles(&profiles).map_err(|e| e.to_string())?;

    // Clear password before returning to frontend
    let mut return_profile = profile;
    return_profile.password = None;
    Ok(return_profile)
}

#[tauri::command]
pub fn list_profiles(storage: State<Storage>) -> Result<Vec<Profile>, String> {
    let profiles = storage.load_profiles().map_err(|e| e.to_string())?;
    let sanitized: Vec<Profile> = profiles
        .into_iter()
        .map(|mut p| {
            p.password = None;
            p
        })
        .collect();
    Ok(sanitized)
}

#[tauri::command]
pub fn get_profile_password(
    storage: State<Storage>,
    profile_id: String,
) -> Result<Option<String>, String> {
    let profiles = storage.load_profiles().map_err(|e| e.to_string())?;
    let profile = profiles
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or("Profile not found")?;

    if let Some(encrypted) = &profile.password {
        let decrypted = storage.decrypt_password(encrypted).map_err(|e| e.to_string())?;
        Ok(Some(decrypted))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn update_profile(
    storage: State<Storage>,
    id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_method: String,
    password_storage: String,
    password: Option<String>,
    key_path: Option<String>,
    default_remote_dir: String,
) -> Result<Profile, String> {
    let auth = match auth_method.as_str() {
        "password" => AuthMethod::Password,
        "key" => AuthMethod::Key,
        _ => return Err("Invalid auth method".into()),
    };

    let pw_storage = match password_storage.as_str() {
        "encrypted" => PasswordStorage::Encrypted,
        "session" => PasswordStorage::Session,
        _ => return Err("Invalid password storage".into()),
    };

    let mut profiles = storage.load_profiles().map_err(|e| e.to_string())?;

    let stored_password = if let Some(pw) = &password {
        if pw_storage == PasswordStorage::Encrypted && !pw.is_empty() {
            Some(storage.encrypt_password(pw).map_err(|e| e.to_string())?)
        } else {
            None
        }
    } else {
        None
    };

    let profile = Profile {
        id,
        name,
        host,
        port,
        username,
        auth_method: auth,
        password_storage: pw_storage,
        password: stored_password,
        key_path,
        default_remote_dir,
    };

    if let Some(pos) = profiles.iter().position(|p| p.id == profile.id) {
        profiles[pos] = profile.clone();
    } else {
        return Err("Profile not found".into());
    }

    storage.save_profiles(&profiles).map_err(|e| e.to_string())?;

    let mut return_profile = profile;
    return_profile.password = None;
    Ok(return_profile)
}

#[tauri::command]
pub fn delete_profile(storage: State<Storage>, id: String) -> Result<(), String> {
    let mut profiles = storage.load_profiles().map_err(|e| e.to_string())?;
    profiles.retain(|p| p.id != id);
    storage.save_profiles(&profiles).map_err(|e| e.to_string())?;
    Ok(())
}