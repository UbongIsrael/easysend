use crate::models::{Profile, ProfilesData};
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use anyhow::{Context, Result};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use keyring::Entry;
use rand::RngCore;
use serde_json;
use std::path::PathBuf;
use std::sync::Mutex;

const SERVICE_NAME: &str = "easysend";
const KEY_ENTRY_NAME: &str = "encryption-key";
const PROFILES_FILE: &str = "profiles.json";

pub struct Storage {
    data_dir: PathBuf,
    key_cache: Mutex<Option<[u8; 32]>>,
}

impl Storage {
    pub fn new() -> Result<Self> {
        let data_dir = dirs::data_dir()
            .context("Failed to determine data directory")?
            .join("easysend");
        std::fs::create_dir_all(&data_dir).context("Failed to create data directory")?;
        Ok(Self {
            data_dir,
            key_cache: Mutex::new(None),
        })
    }

    fn profiles_path(&self) -> PathBuf {
        self.data_dir.join(PROFILES_FILE)
    }

    fn get_or_create_key(&self) -> Result<[u8; 32]> {
        {
            let cache = self.key_cache.lock().unwrap();
            if let Some(key) = *cache {
                return Ok(key);
            }
        }

        let entry = Entry::new(SERVICE_NAME, KEY_ENTRY_NAME)?;

        let key = match entry.get_password() {
            Ok(pw) => {
                let bytes = BASE64
                    .decode(&pw)
                    .context("Failed to decode existing key")?;
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                arr
            }
            Err(_) => {
                let mut key = [0u8; 32];
                OsRng.fill_bytes(&mut key);
                let encoded = BASE64.encode(key);
                entry.set_password(&encoded)?;
                key
            }
        };

        {
            let mut cache = self.key_cache.lock().unwrap();
            *cache = Some(key);
        }

        Ok(key)
    }

    fn encrypt(&self, plaintext: &str) -> Result<String> {
        let key = self.get_or_create_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| anyhow::anyhow!("Invalid key length: {:?}", e))?;
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {:?}", e))?;
        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);
        Ok(BASE64.encode(combined))
    }

    fn decrypt(&self, ciphertext_b64: &str) -> Result<String> {
        let key = self.get_or_create_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| anyhow::anyhow!("Invalid key length: {:?}", e))?;
        let combined = BASE64.decode(ciphertext_b64)?;
        if combined.len() < 12 {
            anyhow::bail!("Invalid ciphertext");
        }
        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {:?}", e))?;
        Ok(String::from_utf8(plaintext)?)
    }

    pub fn load_profiles(&self) -> Result<Vec<Profile>> {
        let path = self.profiles_path();
        if !path.exists() {
            return Ok(Vec::new());
        }
        let encrypted = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => return Ok(Vec::new()),
        };
        match self.decrypt(&encrypted) {
            Ok(json) => match serde_json::from_str::<ProfilesData>(&json) {
                Ok(data) => Ok(data.profiles),
                Err(_) => Ok(Vec::new()),
            },
            Err(e) => {
                eprintln!("Warning: failed to decrypt profiles file ({}), starting fresh.", e);
                Ok(Vec::new())
            }
        }
    }

    pub fn save_profiles(&self, profiles: &[Profile]) -> Result<()> {
        let data = ProfilesData {
            profiles: profiles.to_vec(),
        };
        let json = serde_json::to_string_pretty(&data)?;
        let encrypted = self.encrypt(&json)?;
        std::fs::write(self.profiles_path(), encrypted)?;
        Ok(())
    }

    pub fn encrypt_password(&self, password: &str) -> Result<String> {
        self.encrypt(password)
    }

    pub fn decrypt_password(&self, encrypted: &str) -> Result<String> {
        self.decrypt(encrypted)
    }
}