export interface ValidationError {
  field: string;
  message: string;
}

export function validateProfile(data: {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string | null;
  keyPath: string | null;
  authMethod: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.name.trim()) {
    errors.push({ field: 'name', message: 'Name is required' });
  }
  if (!data.host.trim()) {
    errors.push({ field: 'host', message: 'Host/IP is required' });
  }
  if (data.port < 1 || data.port > 65535) {
    errors.push({ field: 'port', message: 'Port must be between 1 and 65535' });
  }
  if (!data.username.trim()) {
    errors.push({ field: 'username', message: 'Username is required' });
  }
  if (data.authMethod === 'password' && (!data.password || !data.password.trim())) {
    errors.push({ field: 'password', message: 'Password is required' });
  }
  if (data.authMethod === 'key' && (!data.keyPath || !data.keyPath.trim())) {
    errors.push({ field: 'keyPath', message: 'SSH key path is required' });
  }

  return errors;
}