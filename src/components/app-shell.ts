import { html, type TemplateResult } from 'lit-html';
import type { ConnectionStatus, TransferProgress, Profile } from '../types';

export interface AppState {
  profiles: Profile[];
  selectedId: string | null;
  searchQuery: string;
  connectionStatus: ConnectionStatus;
  transferProgress: TransferProgress | null;
  showForm: boolean;
  editingProfile: Profile | null;
  localFiles: string[];
  remoteDir: string;
}

export interface ComponentProps {
  state: AppState;
  dispatch: (action: any) => void;
}

export function appShell(state: AppState, dispatch: (action: any) => void): TemplateResult {
  return html`
    <div class="shell">
      <aside class="sidebar">
        ${sidebar({ state, dispatch })}
      </aside>
      <main class="main">
        ${state.selectedId
          ? mainPanel({ state, dispatch })
          : html`<div class="empty-state">Select a profile to get started</div>`}
      </main>
    </div>
    ${state.showForm ? profileForm({ state, dispatch }) : ''}
  `;
}

function sidebar({ state, dispatch }: ComponentProps): TemplateResult {
  const filtered = state.searchQuery
    ? state.profiles.filter((p) => {
        const q = state.searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.host.toLowerCase().includes(q) ||
          p.username.toLowerCase().includes(q)
        );
      })
    : state.profiles;

  return html`
    <div class="sidebar-header">
      <h2>easysend</h2>
      <button class="btn-ghost" @click=${() => dispatch({ type: 'add-profile' })} title="Add profile">
        ＋
      </button>
    </div>
    <input
      class="search-input"
      type="text"
      placeholder="Search profiles..."
      .value=${state.searchQuery}
      @input=${(e: Event) => dispatch({ type: 'search', query: (e.target as HTMLInputElement).value })}
    />
    <div class="profile-list">
      ${filtered.length === 0
        ? html`<div class="empty-list">No profiles yet</div>`
        : filtered.map(
            (p) => html`
              <div
                class="profile-item ${state.selectedId === p.id ? 'active' : ''}"
                @click=${() => dispatch({ type: 'select-profile', id: p.id })}
              >
                <div class="profile-item-name">${p.name}</div>
                <div class="profile-item-detail">${p.username}@${p.host}</div>
              </div>
            `
          )}
    </div>
  `;
}

function mainPanel({ state, dispatch }: ComponentProps): TemplateResult {
  const profile = state.profiles.find((p) => p.id === state.selectedId);
  if (!profile) return html``;

  const statusColor =
    state.connectionStatus === 'connected'
      ? 'var(--success)'
      : state.connectionStatus === 'connecting'
        ? 'var(--warning)'
        : typeof state.connectionStatus === 'object' && 'error' in state.connectionStatus
          ? 'var(--error)'
          : 'var(--text-dim)';

  const statusText =
    state.connectionStatus === 'connected'
      ? 'Connected'
      : state.connectionStatus === 'connecting'
        ? 'Connecting...'
        : typeof state.connectionStatus === 'object' && 'error' in state.connectionStatus
          ? `Error: ${state.connectionStatus.error}`
          : 'Disconnected';

  const isConnected = state.connectionStatus === 'connected';
  const isConnecting = state.connectionStatus === 'connecting';

  return html`
    <div class="panel-header">
      <div class="panel-title-row">
        <h1>${profile.name}</h1>
        <div class="panel-actions">
          <button class="btn-ghost" @click=${() => dispatch({ type: 'edit-profile', id: profile.id })}>
            Edit
          </button>
          <button class="btn-danger" @click=${() => dispatch({ type: 'delete-profile', id: profile.id })}>
            Delete
          </button>
        </div>
      </div>
      <div class="panel-meta">
        <span>${profile.username}@${profile.host}:${profile.port}</span>
        <span class="status-indicator" style="color: ${statusColor}">● ${statusText}</span>
      </div>
    </div>

    <div class="panel-body">
      <div class="connection-bar">
        ${isConnected
          ? html`<button class="btn-danger" @click=${() => dispatch({ type: 'disconnect', id: profile.id })}>
              Disconnect
            </button>`
          : html`<button
              class="btn-primary"
              ?disabled=${isConnecting}
              @click=${() => dispatch({ type: 'connect', id: profile.id })}
            >
              ${isConnecting ? 'Connecting...' : 'Connect'}
            </button>`}
      </div>

      ${fileTransferPanel({ state, dispatch })}
    </div>
  `;
}

function fileTransferPanel({ state, dispatch }: ComponentProps): TemplateResult {
  const profile = state.profiles.find((p) => p.id === state.selectedId);
  const isConnected = state.connectionStatus === 'connected';

  return html`
    <div class="transfer-section">
      <h3>Transfer Files</h3>

      <div class="transfer-row">
        <label>Local Files</label>
        <div class="drop-zone">
          <button class="btn-ghost" type="button" @click=${() => dispatch({ type: 'pick-files' })}>
            Browse Files
          </button>
          <span>or drag & drop files onto this window</span>
          ${state.localFiles.length > 0
            ? html`<div class="selected-files">
                ${state.localFiles.map((f) => html`<div class="file-chip">${f.split('/').pop() || f.split('\\').pop()}</div>`)}
              </div>`
            : ''}
        </div>
      </div>

      <div class="transfer-row">
        <label>Remote Directory</label>
        <input
          type="text"
          id="remote-dir"
          placeholder="/var/www/app"
          .value=${state.remoteDir || profile?.default_remote_dir || ''}
          @input=${(e: Event) => dispatch({ type: 'set-remote-dir', dir: (e.target as HTMLInputElement).value })}
        />
      </div>

      ${state.transferProgress ? progressBar({ state, dispatch }) : ''}

      <button
        class="btn-primary send-btn"
        ?disabled=${!isConnected || state.localFiles.length === 0}
        @click=${() => dispatch({ type: 'send-files' })}
      >
        ${isConnected ? 'Send Files' : 'Connect to send files'}
      </button>
    </div>
  `;
}

function progressBar({ state }: ComponentProps): TemplateResult {
  const p = state.transferProgress;
  if (!p) return html``;

  const isError = typeof p.status === 'object' && 'failed' in p.status;
  const isDone = p.status === 'completed';

  return html`
    <div class="progress-section">
      <div class="progress-header">
        <span>${p.file_name}</span>
        <span>${Math.round(p.percent)}%</span>
      </div>
      <div class="progress-track ${isError ? 'error' : isDone ? 'done' : ''}">
        <div class="progress-fill" style="width: ${p.percent}%"></div>
      </div>
      <div class="progress-status">
        ${(() => {
          if (typeof p.status === 'object' && 'failed' in p.status) {
            return html`<span style="color: var(--error)">Failed: ${p.status.failed}</span>`;
          }
          if (p.status === 'completed') {
            return html`<span style="color: var(--success)">Complete ✓</span>`;
          }
          return html`<span>${formatBytes(p.bytes_sent)} / ${formatBytes(p.total_bytes)}</span>`;
        })()}
      </div>
    </div>
  `;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function profileForm({ state, dispatch }: ComponentProps): TemplateResult {
  const p = state.editingProfile;
  const isEdit = !!p;

  function handleSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    dispatch({
      type: 'save-profile',
      data: {
        name: fd.get('name') as string,
        host: fd.get('host') as string,
        port: parseInt(fd.get('port') as string) || 22,
        username: fd.get('username') as string,
        authMethod: fd.get('auth_method') as string || 'password',
        passwordStorage: fd.get('password_storage') as string || 'encrypted',
        password: fd.get('password') as string || null,
        keyPath: fd.get('key_path') as string || null,
        defaultRemoteDir: fd.get('default_remote_dir') as string || '',
      },
    });
  }

  function toggleAuthFields(e: Event) {
    const method = (e.target as HTMLSelectElement).value;
    const pwField = document.getElementById('password-field');
    const keyField = document.getElementById('key-field');
    if (pwField && keyField) {
      pwField.style.display = method === 'password' ? '' : 'none';
      keyField.style.display = method === 'key' ? '' : 'none';
    }
  }

  return html`
    <div class="modal-backdrop" @click=${() => dispatch({ type: 'close-form' })}>
      <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
        <h2>${isEdit ? 'Edit Profile' : 'New Profile'}</h2>
        <form class="profile-form" @submit=${handleSubmit}>
          <label>
            Name
            <input type="text" name="name" .value=${p?.name || ''} required />
          </label>
          <label>
            IP Address / Hostname
            <input type="text" name="host" .value=${p?.host || ''} required />
          </label>
          <label>
            Port
            <input type="number" name="port" .value=${p?.port ?? 22} min="1" max="65535" />
          </label>
          <label>
            SSH Username
            <input type="text" name="username" .value=${p?.username || ''} required />
          </label>
          <label>
            Auth Method
            <select name="auth_method" .value=${p?.auth_method || 'password'} @change=${toggleAuthFields}>
              <option value="password">Password</option>
              <option value="key">SSH Private Key</option>
            </select>
          </label>
          <label>
            Password Storage
            <select name="password_storage" .value=${p?.password_storage || 'encrypted'}>
              <option value="encrypted">Store encrypted</option>
              <option value="session">Prompt each session</option>
            </select>
          </label>
          <label id="password-field" style="display:${(!p || p.auth_method === 'password') ? '' : 'none'}">
            Password
            <input type="password" name="password" />
          </label>
          <label id="key-field" style="display:${p?.auth_method === 'key' ? '' : 'none'}">
            Key File Path
            <input type="text" name="key_path" .value=${p?.key_path || ''} placeholder="/home/user/.ssh/id_rsa" />
          </label>
          <label>
            Default Remote Directory
            <input type="text" name="default_remote_dir" .value=${p?.default_remote_dir || ''} placeholder="/var/www/app" />
          </label>
          <div class="form-actions">
            <button type="button" class="btn-ghost" @click=${() => dispatch({ type: 'close-form' })}>Cancel</button>
            <button type="submit" class="btn-primary">${isEdit ? 'Save Changes' : 'Create Profile'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}