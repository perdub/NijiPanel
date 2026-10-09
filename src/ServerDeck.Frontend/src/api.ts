import {
  Host,
  HostStats,
  Container,
  ContainerInspect,
  ComposeProject,
  DirectoryListing,
  HostPort,
  HostNote,
  SshTunnel,
  MasterKey
} from './types';

const API_BASE = '/api';

export function getToken(): string | null {
  return localStorage.getItem('serverdeck_token');
}

export function setToken(token: string) {
  localStorage.setItem('serverdeck_token', token);
}

export function clearToken() {
  localStorage.removeItem('serverdeck_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('serverdeck_unauthorized'));
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let errMessage = 'Request failed';
    try {
      const data = await res.json();
      errMessage = data.error || data.message || errMessage;
    } catch {
      errMessage = await res.text() || res.statusText;
    }
    throw new Error(errMessage);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  auth: {
    status: () => request<{ isSetup: boolean; isAuthenticated: boolean; username?: string }>('/auth/status'),
    setup: (body: { username: string; password: string }) =>
      request<{ token: string; username: string }>('/auth/setup', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { username: string; password: string }) =>
      request<{ token: string; username: string }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<{ success: boolean }>('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  },
  settings: {
    getMasterKey: () => request<MasterKey>('/settings/master-key'),
    regenerateMasterKey: (bits = 4096) =>
      request<MasterKey>(`/settings/master-key/regenerate?bits=${bits}`, { method: 'POST' }),
  },
  hosts: {
    list: () => request<Host[]>('/hosts'),
    get: (id: string) => request<Host>(`/hosts/${id}`),
    create: (data: Partial<Host> & { credential?: string; passphrase?: string }) =>
      request<Host>('/hosts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Host> & { credential?: string; passphrase?: string }) =>
      request<Host>(`/hosts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/hosts/${id}`, { method: 'DELETE' }),
    test: (id: string) => request<{ success: boolean; error?: string }>(`/hosts/${id}/test`, { method: 'POST' }),
    stats: (id: string) => request<HostStats>(`/hosts/${id}/stats`),
  },
  docker: {
    containers: (hostId: string) => request<Container[]>(`/hosts/${hostId}/docker/containers`),
    inspect: (hostId: string, containerId: string) =>
      request<ContainerInspect>(`/hosts/${hostId}/docker/containers/${containerId}`),
    action: (hostId: string, containerId: string, action: string) =>
      request<{ success: boolean; output: string; error?: string }>(
        `/hosts/${hostId}/docker/containers/${containerId}/action`,
        { method: 'POST', body: JSON.stringify({ action }) }
      ),
    logs: (hostId: string, containerId: string, tail = 200) =>
      request<{ logs: string }>(`/hosts/${hostId}/docker/containers/${containerId}/logs?tail=${tail}`),
  },
  compose: {
    projects: (hostId: string, customDir?: string) =>
      request<ComposeProject[]>(
        `/hosts/${hostId}/compose/projects${customDir ? `?customDir=${encodeURIComponent(customDir)}` : ''}`
      ),
    action: (hostId: string, filePath: string, action: string) =>
      request<{ success: boolean; exitCode: number; output: string; error?: string }>(
        `/hosts/${hostId}/compose/action`,
        { method: 'POST', body: JSON.stringify({ filePath, action }) }
      ),
    logs: (hostId: string, filePath: string, tail = 200) =>
      request<{ logs: string }>(
        `/hosts/${hostId}/compose/logs?filePath=${encodeURIComponent(filePath)}&tail=${tail}`
      ),
  },
  files: {
    list: (hostId: string, path = '/') =>
      request<DirectoryListing>(`/hosts/${hostId}/files/list?path=${encodeURIComponent(path)}`),
    read: (hostId: string, path: string) =>
      request<{ path: string; content: string; size: number; extension: string }>(
        `/hosts/${hostId}/files/read?path=${encodeURIComponent(path)}`
      ),
    write: (hostId: string, path: string, content: string) =>
      request<{ success: boolean }>(`/hosts/${hostId}/files/write`, {
        method: 'POST',
        body: JSON.stringify({ path, content }),
      }),
    createFolder: (hostId: string, path: string) =>
      request<{ success: boolean }>(`/hosts/${hostId}/files/create-folder`, {
        method: 'POST',
        body: JSON.stringify({ path }),
      }),
    createFile: (hostId: string, path: string) =>
      request<{ success: boolean }>(`/hosts/${hostId}/files/create-file`, {
        method: 'POST',
        body: JSON.stringify({ path }),
      }),
    delete: (hostId: string, path: string) =>
      request<{ success: boolean }>(`/hosts/${hostId}/files?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      }),
    rename: (hostId: string, oldPath: string, newPath: string) =>
      request<{ success: boolean }>(`/hosts/${hostId}/files/rename`, {
        method: 'POST',
        body: JSON.stringify({ oldPath, newPath }),
      }),
    getStreamUrl: (hostId: string, path: string, download = false) => {
      const token = getToken();
      return `${API_BASE}/hosts/${hostId}/files/stream?path=${encodeURIComponent(path)}&download=${download}&access_token=${token || ''}`;
    },
    upload: (hostId: string, targetDir: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return request<{ success: boolean; path: string; size: number }>(
        `/hosts/${hostId}/files/upload?targetDir=${encodeURIComponent(targetDir)}`,
        { method: 'POST', body: formData }
      );
    },
    directTransfer: (data: { sourceHostId: string; sourcePath: string; targetHostId: string; targetPath: string }) =>
      request<{ success: boolean; exitCode: number; output: string; error?: string }>(
        `/hosts/${data.sourceHostId}/files/direct-transfer`,
        { method: 'POST', body: JSON.stringify(data) }
      ),
  },
  extras: {
    ports: (hostId: string) => request<HostPort[]>(`/hosts/${hostId}/ports`),
    addPort: (hostId: string, data: { port: number; protocol: string; serviceName: string; description?: string }) =>
      request<HostPort>(`/hosts/${hostId}/ports`, { method: 'POST', body: JSON.stringify(data) }),
    deletePort: (hostId: string, portId: string) =>
      request<{ success: boolean }>(`/hosts/${hostId}/ports/${portId}`, { method: 'DELETE' }),

    note: (hostId: string) => request<HostNote>(`/hosts/${hostId}/note`),
    saveNote: (hostId: string, data: { title: string; content: string }) =>
      request<HostNote>(`/hosts/${hostId}/note`, { method: 'POST', body: JSON.stringify(data) }),

    tunnels: (hostId: string) => request<SshTunnel[]>(`/hosts/${hostId}/tunnels`),
    createTunnel: (
      hostId: string,
      data: { name: string; localPort: number; remoteHost: string; remotePort: number }
    ) => request<SshTunnel>(`/hosts/${hostId}/tunnels`, { method: 'POST', body: JSON.stringify(data) }),
    deleteTunnel: (hostId: string, tunnelId: string) =>
      request<{ success: boolean }>(`/hosts/${hostId}/tunnels/${tunnelId}`, { method: 'DELETE' }),
    startTunnel: (hostId: string, tunnelId: string) =>
      request<{ success: boolean; error?: string }>(`/hosts/${hostId}/tunnels/${tunnelId}/start`, {
        method: 'POST',
      }),
    stopTunnel: (hostId: string, tunnelId: string) =>
      request<{ success: boolean }>(`/hosts/${hostId}/tunnels/${tunnelId}/stop`, { method: 'POST' }),
  },
  utils: {
    generatePassword: (data: { length?: number; includeSymbols?: boolean; includeNumbers?: boolean; includeUppercase?: boolean }) =>
      request<{ password: string }>('/utils/generate-password', { method: 'POST', body: JSON.stringify(data) }),
    generateSshKey: (data: { type?: string; bits?: number; comment?: string }) =>
      request<{ publicKey: string; privateKey: string; type: string; fingerprint: string }>(
        '/utils/generate-ssh-key',
        { method: 'POST', body: JSON.stringify(data) }
      ),
    getSetupCommand: (customPublicKey?: string) =>
      request<{ command: string; publicKey: string }>(
        `/utils/setup-command${customPublicKey ? `?customPublicKey=${encodeURIComponent(customPublicKey)}` : ''}`
      ),
  },
  backup: {
    export: (passphrase: string) => {
      const token = getToken();
      return fetch(`${API_BASE}/backup/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ passphrase }),
      });
    },
    import: (file: File, passphrase: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('passphrase', passphrase);
      return request<{ success: boolean; importedHosts: number }>('/backup/import', {
        method: 'POST',
        body: formData,
      });
    },
    cloudExport: (customPassphrase?: string) =>
      request<{ shareUrl: string; shareCode: string; passphrase: string }>('/backup/cloud/export', {
        method: 'POST',
        body: JSON.stringify({ customPassphrase: customPassphrase || undefined }),
      }),
    cloudImport: (data: { shareCodeOrUrl: string; passphrase: string }) =>
      request<{ success: boolean; importedHosts: number }>('/backup/cloud/import', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};
