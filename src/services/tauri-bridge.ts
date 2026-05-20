import { invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { Profile, ConnectionStatus, TransferProgress } from '../types';

function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error(
      'Tauri bridge not available. Launch the app via `npm run dev`, not a browser.'
    );
  }
  return invoke<T>(cmd, args);
}

export async function createProfile(
  name: string,
  host: string,
  port: number,
  username: string,
  authMethod: string,
  passwordStorage: string,
  password: string | null,
  keyPath: string | null,
  defaultRemoteDir: string
): Promise<Profile> {
  return safeInvoke('create_profile', {
    name,
    host,
    port,
    username,
    authMethod,
    passwordStorage,
    password,
    keyPath,
    defaultRemoteDir,
  });
}

export async function listProfiles(): Promise<Profile[]> {
  return safeInvoke('list_profiles');
}

export async function getProfilePassword(profileId: string): Promise<string | null> {
  return safeInvoke('get_profile_password', { profileId });
}

export async function updateProfile(
  id: string,
  name: string,
  host: string,
  port: number,
  username: string,
  authMethod: string,
  passwordStorage: string,
  password: string | null,
  keyPath: string | null,
  defaultRemoteDir: string
): Promise<Profile> {
  return safeInvoke('update_profile', {
    id,
    name,
    host,
    port,
    username,
    authMethod,
    passwordStorage,
    password,
    keyPath,
    defaultRemoteDir,
  });
}

export async function deleteProfile(id: string): Promise<void> {
  return safeInvoke('delete_profile', { id });
}

export async function connect(
  profileId: string,
  sessionPassword?: string
): Promise<void> {
  return safeInvoke('connect', { profileId, sessionPassword: sessionPassword || null });
}

export async function disconnect(profileId: string): Promise<void> {
  return safeInvoke('disconnect', { profileId });
}

export async function pickFiles(): Promise<string[]> {
  const selected = await open({ multiple: true });
  if (!selected) return [];
  if (Array.isArray(selected)) return selected;
  return [selected];
}

export async function sendFiles(
  profileId: string,
  localPaths: string[],
  remoteDir: string,
  sessionPassword?: string
): Promise<void> {
  return safeInvoke('send_files', {
    profileId,
    localPaths,
    remoteDir,
    sessionPassword: sessionPassword || null,
  });
}

export function onConnectionStatus(
  cb: (status: ConnectionStatus) => void
): Promise<UnlistenFn> {
  return listen<ConnectionStatus>('connection:status', (event) => {
    cb(event.payload);
  });
}

export function onTransferProgress(
  cb: (progress: TransferProgress) => void
): Promise<UnlistenFn> {
  return listen<TransferProgress>('transfer:progress', (event) => {
    cb(event.payload);
  });
}