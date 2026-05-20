import type { ConnectionStatus } from '../types';
import * as api from '../services/tauri-bridge';

export class ConnectionStore {
  status: ConnectionStatus = 'disconnected';
  listeners: Set<() => void> = new Set();

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  async connect(profileId: string, sessionPassword?: string) {
    this.status = 'connecting';
    this.notify();
    try {
      await api.connect(profileId, sessionPassword);
      this.status = 'connected';
    } catch (e) {
      this.status = { error: String(e) };
    }
    this.notify();
  }

  async disconnect(profileId: string) {
    await api.disconnect(profileId);
    this.status = 'disconnected';
    this.notify();
  }

  setStatus(s: ConnectionStatus) {
    this.status = s;
    this.notify();
  }
}

export const connectionStore = new ConnectionStore();