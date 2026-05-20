use crate::models::{AuthMethod, Profile, TransferProgress, TransferStatus};
use anyhow::{Context, Result};
use ssh2::{Channel, Session, Sftp};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub struct SshConnection {
    session: Session,
    #[allow(dead_code)]
    tcp: TcpStream,
    pub profile_id: String,
}

impl SshConnection {
    pub fn connect(profile: &Profile, password: Option<String>) -> Result<Self> {
        let tcp = TcpStream::connect(format!("{}:{}", profile.host, profile.port))?;
        tcp.set_read_timeout(Some(Duration::from_secs(30)))?;
        tcp.set_write_timeout(Some(Duration::from_secs(30)))?;

        let mut session = Session::new()?;
        session.set_tcp_stream(tcp.try_clone()?);
        session.handshake()?;

        match profile.auth_method {
            AuthMethod::Password => {
                let pw = password
                    .or_else(|| profile.password.clone())
                    .context("No password provided")?;
                session.userauth_password(&profile.username, &pw)?;
            }
            AuthMethod::Key => {
                let key_path = profile
                    .key_path
                    .as_ref()
                    .context("No key path provided")?;
                session.userauth_pubkey_file(&profile.username, None, Path::new(key_path), None)?;
            }
        }

        if !session.authenticated() {
            anyhow::bail!("Authentication failed");
        }

        Ok(SshConnection {
            session,
            tcp,
            profile_id: profile.id.clone(),
        })
    }

    pub fn is_authenticated(&self) -> bool {
        self.session.authenticated()
    }

    pub fn sftp(&self) -> Result<Sftp> {
        Ok(self.session.sftp()?)
    }

    pub fn mkdir_p(&self, path: &str) -> Result<()> {
        let sftp = self.sftp()?;
        let components: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        let mut current = String::new();
        for component in components {
            current.push('/');
            current.push_str(component);
            if let Err(_) = sftp.stat(Path::new(&current)) {
                sftp.mkdir(Path::new(&current), 0o755)?;
            }
        }
        Ok(())
    }

    pub fn upload_file(
        &self,
        local_path: &str,
        remote_path: &str,
        app_handle: &AppHandle,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<()> {
        let sftp = self.sftp()?;
        let local = Path::new(local_path);
        let file_size = std::fs::metadata(local)?.len();
        let file_name = local
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let mut local_file = std::fs::File::open(local)?;

        let remote_file = sftp.create(Path::new(remote_path))?;
        let mut writer = std::io::BufWriter::new(remote_file);

        let mut buffer = vec![0u8; 32768];
        let mut bytes_sent: u64 = 0;

        loop {
            if cancel_flag.load(Ordering::Relaxed) {
                anyhow::bail!("Transfer cancelled");
            }

            let n = local_file.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            writer.write_all(&buffer[..n])?;
            bytes_sent += n as u64;

            let percent = (bytes_sent as f64 / file_size as f64) * 100.0;
            let _ = app_handle.emit(
                "transfer:progress",
                TransferProgress {
                    file_name: file_name.clone(),
                    bytes_sent,
                    total_bytes: file_size,
                    percent,
                    status: TransferStatus::InProgress,
                },
            );
        }

        writer.flush()?;
        let _ = app_handle.emit(
            "transfer:progress",
            TransferProgress {
                file_name,
                bytes_sent,
                total_bytes: file_size,
                percent: 100.0,
                status: TransferStatus::Completed,
            },
        );

        Ok(())
    }

    pub fn execute(&self, command: &str) -> Result<String> {
        let mut channel: Channel = self.session.channel_session()?;
        channel.exec(command)?;
        let mut output = String::new();
        channel.read_to_string(&mut output)?;
        channel.wait_close()?;
        Ok(output)
    }
}

pub struct ConnectionPool {
    connections: Mutex<Vec<SshConnection>>,
}

impl ConnectionPool {
    pub fn new() -> Self {
        ConnectionPool {
            connections: Mutex::new(Vec::new()),
        }
    }

    pub fn add(&self, conn: SshConnection) {
        let mut pool = self.connections.lock().unwrap();
        pool.retain(|c| c.profile_id != conn.profile_id);
        pool.push(conn);
    }

    pub fn get(&self, profile_id: &str) -> Option<SshConnection> {
        let mut pool = self.connections.lock().unwrap();
        if let Some(pos) = pool.iter().position(|c| c.profile_id == profile_id) {
            if pool[pos].is_authenticated() {
                return Some(pool.remove(pos));
            }
        }
        None
    }

    pub fn remove(&self, profile_id: &str) {
        let mut pool = self.connections.lock().unwrap();
        pool.retain(|c| c.profile_id != profile_id);
    }

    pub fn is_connected(&self, profile_id: &str) -> bool {
        let pool = self.connections.lock().unwrap();
        pool.iter()
            .any(|c| c.profile_id == profile_id && c.is_authenticated())
    }
}