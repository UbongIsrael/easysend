import type { Profile } from '../types';
import * as api from '../services/tauri-bridge';

export class ProfileStore {
  profiles: Profile[] = [];
  selectedId: string | null = null;
  searchQuery = '';
  listeners: Set<() => void> = new Set();

  get selected(): Profile | undefined {
    return this.profiles.find((p) => p.id === this.selectedId);
  }

  get filtered(): Profile[] {
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.profiles;
    return this.profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.host.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q)
    );
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  async load() {
    this.profiles = await api.listProfiles();
    this.notify();
  }

  async create(data: {
    name: string;
    host: string;
    port: number;
    username: string;
    authMethod: string;
    passwordStorage: string;
    password: string | null;
    keyPath: string | null;
    defaultRemoteDir: string;
  }): Promise<Profile> {
    const profile = await api.createProfile(
      data.name,
      data.host,
      data.port,
      data.username,
      data.authMethod,
      data.passwordStorage,
      data.password,
      data.keyPath,
      data.defaultRemoteDir
    );
    this.profiles.push(profile);
    this.selectedId = profile.id;
    this.notify();
    return profile;
  }

  async update(data: {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    authMethod: string;
    passwordStorage: string;
    password: string | null;
    keyPath: string | null;
    defaultRemoteDir: string;
  }): Promise<Profile> {
    const profile = await api.updateProfile(
      data.id,
      data.name,
      data.host,
      data.port,
      data.username,
      data.authMethod,
      data.passwordStorage,
      data.password,
      data.keyPath,
      data.defaultRemoteDir
    );
    const idx = this.profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) this.profiles[idx] = profile;
    this.notify();
    return profile;
  }

  async delete(id: string) {
    await api.deleteProfile(id);
    this.profiles = this.profiles.filter((p) => p.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    this.notify();
  }

  select(id: string | null) {
    this.selectedId = id;
    this.notify();
  }

  setSearch(q: string) {
    this.searchQuery = q;
    this.notify();
  }
}

export const profileStore = new ProfileStore();