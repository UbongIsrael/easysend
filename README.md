# easysend

> Automated VPS Management & File Transfer GUI

**easysend** is a lightweight desktop application that simplifies remote server management. It acts as an address book for your infrastructure — abstracting away repetitive SSH/SFTP connection strings, manual `mkdir -p` commands, and file upload orchestration.

---

## Features

### Profile Manager ("Server Address Book")

Save, organize, and instantly connect to multiple VPS instances:

- **Create profiles** with friendly name, IP/hostname, port (defaults to 22), SSH username, and authentication method
- **Authentication** — Password or SSH private key; passwords can be stored encrypted at rest or prompted each session
- **Default remote directory** — Set a per-profile default target path for file transfers
- **Search & filter** — Quickly find profiles by name, host, or username
- **Edit/Delete** — Modify or remove profiles on the fly

### One-Click Connection

- Click any profile to establish an SSH/SFTP session in the background
- **Visual status indicator** — Color-coded dot (green = connected, yellow = connecting, red = error, gray = disconnected)
- Connection pool management — sessions are cached and reused

### Smart File Transfer Pipeline

- **File picker** — Browse or drag-and-drop files into the transfer zone
- **Remote directory** — Auto-filled from the profile's default target; editable per transfer
- **Idempotent directory creation** — If the remote directory doesn't exist, `mkdir -p` runs silently before upload
- **Progress visualization** — Real-time progress bar with speed, percentage, and file name
- **Async transfers** — Background workers keep the UI responsive during large uploads

### Security

- **Encrypted at rest** — All profile data is encrypted with AES-256-GCM before touching disk
- **OS keyring integration** — The encryption key is stored in your system's native credential manager (libsecret on Linux, Keychain on macOS, Credential Manager on Windows)
- **Session-only passwords** — Per-profile toggle to keep passwords in-memory only (re-enter each session)
- **SSH-only** — Strictly encrypted SFTP channels over SSH; no unencrypted protocols

---

## Screenshots

```
┌──────────────────────────────────────────────────────────┐
│  Sidebar              │  Main Panel                       │
│  ──────────           │  ─────────────                     │
│  easysend    [＋]     │  Staging API              [Edit][Delete]
│  ──────────           │  root@192.168.1.42:22     ● Connected
│  [Search profiles...] │  ──────────────────────────────────
│                        │  [Disconnect]                      │
│  ● Staging API        │                                      │
│    root@192.168.1.42  │  Transfer Files                     │
│                        │  ┌─────────────────────────────┐   │
│  ○ Prod Database      │  │ [Browse Files] or drag & drop│   │
│    deploy@10.0.0.5    │  └─────────────────────────────┘   │
│                        │  Remote Directory                   │
│  ○ Dev Server         │  [/var/www/app                ]    │
│    ubuntu@dev.local   │                                      │
│                        │  ████████████████░░░░ 72%           │
│                        │  app-v2.3.4.tar.gz                   │
│                        │                                      │
│                        │  [Send Files]                        │
└──────────────────────────────────────────────────────────┘
```

---

## Architecture

```
                    ┌──────────────────────────┐
                    │   Desktop GUI (lit-html) │
                    │   Vanilla TypeScript     │
                    └──────────┬───────────────┘
                               │ Tauri IPC (invoke / events)
                    ┌──────────▼───────────────┐
                    │   Rust Backend (tauri)   │
                    │   ┌───────────────────┐  │
                    │   │ Commands:         │  │
                    │   │ • profiles (CRUD) │  │
                    │   │ • connection      │  │
                    │   │ • transfer        │  │
                    │   ├───────────────────┤  │
                    │   │ Storage (AES-GCM) │  │
                    │   │ SSH Pool (ssh2)   │  │
                    │   └───────────────────┘  │
                    └──────────┬───────────────┘
                               │ SFTP over SSH
                    ┌──────────▼───────────────┐
                    │       Remote VPS         │
                    └──────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://v2.tauri.app/) |
| Frontend | Vanilla TypeScript + [lit-html](https://lit.dev/docs/libraries/standalone-templates/) |
| Backend | Rust |
| SSH/SFTP | [`ssh2`](https://docs.rs/ssh2/) crate (libssh2 bindings) |
| Encryption | AES-256-GCM via [`aes-gcm`](https://docs.rs/aes-gcm/) |
| Key management | [`keyring`](https://docs.rs/keyring/) crate (OS native credential store) |
| Bundling | Vite (frontend), Cargo (backend) |

### Data Flow

1. **User creates a profile** → Rust encrypts credentials with AES-256-GCM → writes ciphertext to `~/.local/share/easysend/profiles.json`
2. **User clicks a profile** → Rust establishes SSH/SFTP session → emits `connection:status` events → UI shows green dot
3. **User selects files + remote path** → Rust runs `mkdir -p` on remote via SFTP → uploads file in 32KB chunks → emits `transfer:progress` events (file name, bytes, percent)
4. **UI updates in real-time** → Progress bar fills, percentage updates, success/failure notification

---

## Getting Started

### Prerequisites

- **Node.js** >= 20.19 (or 22.12+)
- **Rust** >= 1.77 (install via [rustup](https://rustup.rs/))
- **System dependencies** (Linux):

```bash
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev
```

### Install & Run

```bash
# Clone the repository
git clone https://github.com/your-username/easysend.git
cd easysend

# Install frontend dependencies
npm install

# Run in development mode (hot-reload enabled)
npm run dev

# Build for production
npm run build
```

The production build will produce:
- `.deb` — Debian/Ubuntu package
- `.rpm` — Fedora/RHEL package
- `.AppImage` — Portable Linux AppImage
- Raw binary at `src-tauri/target/release/easysend`

---

## Usage Walkthrough

### 1. Add a Profile

1. Click the **＋** button in the sidebar header
2. Fill in the form:
   - **Name** — A friendly label (e.g., "Staging API")
   - **Host** — IP address or hostname
   - **Port** — SSH port (default: 22)
   - **Username** — SSH login user
   - **Auth Method** — Choose "Password" or "SSH Private Key"
   - **Password Storage** — "Store encrypted" persists the password; "Prompt each session" asks on each connect
   - **Default Remote Directory** — Pre-filled target path for file transfers
3. Click **Create Profile**

### 2. Connect

1. Click a profile in the sidebar
2. Click **Connect** in the main panel
3. The status dot turns **yellow** while connecting, then **green** when ready

### 3. Transfer Files

1. Ensure the profile shows **Connected** (green dot)
2. Click **Browse Files** or drag-and-drop files onto the drop zone
3. Enter or confirm the **Remote Directory** path
4. Click **Send Files**
5. Watch the progress bar complete, then verify on the remote server

---

## Project Structure

```
easysend/
├── src/                              # Frontend
│   ├── index.html                    # Entry HTML
│   ├── main.ts                       # App bootstrap, state, dispatch
│   ├── style.css                     # Global styles (dark theme)
│   ├── types.ts                      # Shared TypeScript interfaces
│   ├── components/
│   │   └── app-shell.ts              # All UI components (shell, sidebar, form, transfer, progress)
│   ├── services/
│   │   ├── tauri-bridge.ts           # Typed Tauri invoke/listen wrappers
│   │   └── validation.ts             # Form validation helpers
│   └── stores/
│       ├── connection-store.ts       # Connection state machine
│       └── profile-store.ts          # Profile CRUD state
├── src-tauri/                        # Backend (Rust)
│   ├── Cargo.toml                    # Rust dependencies
│   ├── tauri.conf.json               # Tauri app configuration
│   ├── build.rs                      # Tauri build script
│   ├── icons/                        # App icons
│   └── src/
│       ├── main.rs                   # Binary entry point
│       ├── lib.rs                    # Library entry, Tauri builder setup
│       ├── models.rs                 # Profile, ConnectionStatus, TransferProgress structs
│       ├── storage.rs                # AES-256-GCM encrypted JSON storage + OS keyring
│       ├── ssh.rs                    # SSH/SFTP connection pool, mkdir_p, upload with progress
│       └── commands/
│           ├── mod.rs                # Module declarations
│           ├── profiles.rs           # create/list/update/delete profile commands
│           ├── connection.rs         # connect/disconnect/status commands
│           └── transfer.rs           # send_files command
├── PLAN.md                           # Implementation plan document
├── package.json                      # npm scripts & dependencies
├── vite.config.ts                    # Vite bundler configuration
└── tsconfig.json                     # TypeScript configuration
```

---

## Security Model

```
┌──────────────────────────────────────────────┐
│           OS Keyring (keyring crate)          │
│  ┌──────────────────────────────────────────┐ │
│  │  AES-256-GCM Encryption Key (64 chars)   │ │
│  │  Protected by OS:                         │ │
│  │  • Linux: libsecret (GNOME Keyring/KDE)   │ │
│  │  • macOS: Keychain                        │ │
│  │  • Windows: Credential Manager            │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│        Encrypted Profiles (disk only)         │
│                                               │
│  Nonce (12B) + Ciphertext + AEAD Tag          │
│                                               │
│  File: ~/.local/share/easysend/profiles.json  │
│  Content: base64( nonce || ciphertext )       │
└──────────────────────────────────────────────┘
```

| Threat | Mitigation |
|---|---|
| Disk theft / file exfiltration | Profiles are AES-256-GCM encrypted; ciphertext only on disk |
| Key file compromise | Encryption key lives in OS keyring, never on filesystem |
| In-transit eavesdropping | SFTP over SSH (encrypted channel) — no cleartext FTP |
| Shoulder surfing / session reuse | Per-profile "session-only" password mode — nothing persisted |

---

## Tauri Commands (IPC API)

| Command | Direction | Description |
|---|---|---|
| `create_profile` | Frontend → Rust | Create a new VPS profile |
| `list_profiles` | Frontend → Rust | List all saved profiles (passwords stripped) |
| `get_profile_password` | Frontend → Rust | Decrypt and return a stored password |
| `update_profile` | Frontend → Rust | Update an existing profile |
| `delete_profile` | Frontend → Rust | Delete a profile |
| `connect` | Frontend → Rust | Open SSH/SFTP session |
| `disconnect` | Frontend → Rust | Close SSH/SFTP session |
| `get_connection_status` | Frontend → Rust | Poll connection state |
| `send_files` | Frontend → Rust | Upload files with auto mkdir-p |
| `connection:status` | Rust → Frontend (event) | Connection state changes |
| `transfer:progress` | Rust → Frontend (event) | Real-time upload progress |

---

## Building from Source

```bash
# Development build (debug, unoptimized)
npm run dev

# Production build (optimized, bundled)
npm run build

# Build artifacts are in:
#   src-tauri/target/release/easysend          (binary)
#   src-tauri/target/release/bundle/deb/        (.deb)
#   src-tauri/target/release/bundle/rpm/        (.rpm)
#   src-tauri/target/release/bundle/appimage/   (.AppImage)
```

---

## Roadmap / Future Phases

| Feature | Phase |
|---|---|
| File download (remote → local) | Phase 2 |
| Interactive SSH terminal emulator | Future |
| Cloud sync for profile addresses | Future |
| Multi-hop SSH tunnels / jump hosts | Future |
| Directory sync (rsync-style) | Future |

---

## License

MIT
