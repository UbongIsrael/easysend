import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { Profile, ConnectionStatus, TransferProgress } from '../types';

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
  return invoke('create_profile', {
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
  return invoke('list_profiles');
}

export async function getProfilePassword(profileId: string): Promise<string | null> {
  return invoke('get_profile_password', { profileId });
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
  return invoke('update_profile', {
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
  return invoke('delete_profile', { id });
}

export async function connect(
  profileId: string,
  sessionPassword?: string
): Promise<void> {
  return invoke('connect', { profileId, sessionPassword: sessionPassword || null });
}

export async function disconnect(profileId: string): Promise<void> {
  return invoke('disconnect', { profileId });
}

export async function sendFiles(
  profileId: string,
  localPaths: string[],
  remoteDir: string,
  sessionPassword?: string
): Promise<void> {
  return invoke('send_files', {
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