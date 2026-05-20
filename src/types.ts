export interface Profile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: 'password' | 'key';
  password_storage: 'encrypted' | 'session';
  password: string | null;
  key_path: string | null;
  default_remote_dir: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | { error: string };

export type TransferStatus = 'in_progress' | 'completed' | { failed: string };

export interface TransferProgress {
  file_name: string;
  bytes_sent: number;
  total_bytes: number;
  percent: number;
  status: TransferStatus;
}