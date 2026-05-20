import { html, render } from 'lit-html';
import type { ConnectionStatus, TransferProgress } from './types';
import { profileStore } from './stores/profile-store';
import { connectionStore } from './stores/connection-store';
import * as api from './services/tauri-bridge';
import { appShell } from './components/app-shell';

interface AppState {
  showForm: boolean;
  editingProfileId: string | null;
  localFiles: string[];
  remoteDir: string;
  transferProgress: TransferProgress | null;
}

let state: AppState = {
  showForm: false,
  editingProfileId: null,
  localFiles: [],
  remoteDir: '',
  transferProgress: null,
};

function renderApp() {
  render(
    appShell(
      {
        profiles: profileStore.profiles,
        selectedId: profileStore.selectedId,
        searchQuery: profileStore.searchQuery,
        connectionStatus: connectionStore.status,
        transferProgress: state.transferProgress,
        showForm: state.showForm,
        editingProfile: state.editingProfileId
          ? profileStore.profiles.find((p) => p.id === state.editingProfileId) || null
          : null,
        localFiles: state.localFiles,
        remoteDir: state.remoteDir,
      },
      dispatch
    ),
    document.getElementById('app')!
  );
}

async function dispatch(
  action:
    | { type: 'select-profile'; id: string | null }
    | { type: 'search'; query: string }
    | { type: 'add-profile' }
    | { type: 'edit-profile'; id: string }
    | { type: 'close-form' }
    | { type: 'save-profile'; data: any }
    | { type: 'delete-profile'; id: string }
    | { type: 'connect'; id: string; password?: string }
    | { type: 'disconnect'; id: string }
    | { type: 'pick-files' }
    | { type: 'set-local-files'; paths: string[] }
    | { type: 'set-remote-dir'; dir: string }
    | { type: 'send-files' }
    | { type: 'transfer-progress'; progress: TransferProgress }
    | { type: 'connection-status'; status: ConnectionStatus }
) {
  switch (action.type) {
    case 'select-profile': {
      profileStore.select(action.id);
      connectionStore.setStatus('disconnected');
      state.localFiles = [];
      state.remoteDir = '';
      state.transferProgress = null;
      break;
    }
    case 'search':
      profileStore.setSearch(action.query);
      break;
    case 'add-profile':
      state.editingProfileId = null;
      state.showForm = true;
      break;
    case 'edit-profile':
      state.editingProfileId = action.id;
      state.showForm = true;
      break;
    case 'close-form':
      state.showForm = false;
      state.editingProfileId = null;
      break;
    case 'save-profile': {
      const d = action.data;
      try {
        if (state.editingProfileId) {
          await profileStore.update({ id: state.editingProfileId, ...d });
        } else {
          await profileStore.create(d);
        }
        state.showForm = false;
        state.editingProfileId = null;
      } catch (e) {
        alert('Failed to save profile: ' + e);
      }
      break;
    }
    case 'delete-profile':
      if (confirm('Delete this profile?')) {
        profileStore.delete(action.id);
        connectionStore.setStatus('disconnected');
      }
      break;
    case 'connect': {
      if (action.password) {
        await connectionStore.connect(action.id, action.password);
      } else {
        const profile = profileStore.profiles.find((p) => p.id === action.id);
        if (profile?.password_storage === 'session') {
          const pw = prompt('Enter password for ' + profile.name + ':');
          if (pw) await connectionStore.connect(action.id, pw);
        } else {
          await connectionStore.connect(action.id);
        }
      }
      break;
    }
    case 'disconnect':
      await connectionStore.disconnect(action.id);
      break;
    case 'pick-files': {
      try {
        const paths = await api.pickFiles();
        if (paths.length > 0) {
          state.localFiles = paths;
        }
      } catch (e) {
        console.error('File picker failed:', e);
      }
      break;
    }
    case 'set-local-files':
      state.localFiles = action.paths;
      break;
    case 'set-remote-dir':
      state.remoteDir = action.dir;
      break;
    case 'send-files': {
      const profile = profileStore.profiles.find((p) => p.id === profileStore.selectedId);
      if (!profile || !state.localFiles.length) return;

      const remoteDir = state.remoteDir || profile.default_remote_dir;
      if (!remoteDir) {
        alert('Please enter a remote directory.');
        return;
      }

      let sessionPassword: string | undefined;
      if (profile.password_storage === 'session') {
        const pw = prompt('Enter password for ' + profile.name + ':');
        if (!pw) return;
        sessionPassword = pw;
      }

      try {
        await api.sendFiles(profile.id, state.localFiles, remoteDir, sessionPassword);
      } catch (e) {
        alert('Transfer failed: ' + e);
      }
      break;
    }
    case 'transfer-progress':
      state.transferProgress = action.progress;
      break;
    case 'connection-status':
      connectionStore.setStatus(action.status);
      break;
  }
  renderApp();
}

// Load profiles on startup
profileStore.load().catch((e) => {
  console.error('Failed to load profiles:', e);
}).then(() => renderApp());

// Wire up Tauri events
api.onConnectionStatus((status) => {
  dispatch({ type: 'connection-status', status });
}).catch((e) => console.error('Failed to listen for connection events:', e));

api.onTransferProgress((progress) => {
  dispatch({ type: 'transfer-progress', progress });
}).catch((e) => console.error('Failed to listen for transfer events:', e));

// Subscriptions for store changes
profileStore.subscribe(() => renderApp());
connectionStore.subscribe(() => renderApp());

// Listen for drag-and-drop from OS (Tauri window event)
import { listen } from '@tauri-apps/api/event';
listen<string[]>('tauri://drag-drop', (event) => {
  const payload = event.payload as any;
  const paths = payload?.paths || [];
  if (paths.length > 0) {
    state.localFiles = paths;
    renderApp();
  }
}).catch(() => {});

renderApp();