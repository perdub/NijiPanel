import {
  Host,
  HostStats,
  Container,
  ContainerInspect,
  ContainerCrashDump,
  ComposeProject,
  ComposeStackDetail,
  ComposeValidateResponse,
  AppTemplate,
  DeployTemplateRequest,
  DeployTemplateResponse,
  DockerHubSearchResponse,
  DockerPrunePreviewResponse,
  DockerPruneExecuteRequest,
  DockerPruneExecuteResponse,
  DirectoryListing,
  HostPort,
  HostNote,
  SshTunnel,
  MasterKey,
  CronJobItem,
  CronExecutionResult,
  SharedFile,
  DiskUsageResult,
  HostMetricsHistory,
  NotificationItem,
  NotificationListResponse,
  AlertSettings,
  TestAlertResult,
  BenchmarkResult,
  FirewallStatus,
  CreateFirewallRuleRequest,
  Fail2banStatus,
  Passkey,
  PasskeyRegisterChallenge,
  PasskeyLoginChallenge,
  SystemdService,
  SystemdActionResult,
  LinuxUser,
  LinuxUserActionResult,
  PackageUpdateCheckResult,
  PackageUpgradeResult,
  LiveSocket,
  RandomizePortResult
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
    metricsHistory: (id: string) => request<HostMetricsHistory>(`/hosts/${id}/metrics/history`),
    benchmark: (id: string) => request<BenchmarkResult>(`/hosts/${id}/benchmark`, { method: 'POST' }),
    randomizePort: (id: string, targetPort?: number) =>
      request<RandomizePortResult>(`/hosts/${id}/randomize-port`, {
        method: 'POST',
        body: JSON.stringify({ targetPort }),
      }),
  },
  docker: {
    containers: (hostId: string) => request<Container[]>(`/hosts/${hostId}/docker/containers`),
    inspect: (hostId: string, containerId: string) =>
      request<ContainerInspect>(`/hosts/${hostId}/docker/containers/${containerId}`),
    crashDump: (hostId: string, containerId: string) =>
      request<ContainerCrashDump>(`/hosts/${hostId}/docker/containers/${containerId}/crash-dump`),
    action: (hostId: string, containerId: string, action: string) =>
      request<{ success: boolean; output: string; error?: string }>(
        `/hosts/${hostId}/docker/containers/${containerId}/action`,
        { method: 'POST', body: JSON.stringify({ action }) }
      ),
    logs: (hostId: string, containerId: string, tail = 200) =>
      request<{ logs: string }>(`/hosts/${hostId}/docker/containers/${containerId}/logs?tail=${tail}`),
    templates: (hostId: string) =>
      request<AppTemplate[]>(`/hosts/${hostId}/docker/templates`),
    deployTemplate: (hostId: string, body: DeployTemplateRequest) =>
      request<DeployTemplateResponse>(`/hosts/${hostId}/docker/templates/deploy`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    hubSearch: (q: string) =>
      request<DockerHubSearchResponse>(`/docker/hub-search?q=${encodeURIComponent(q)}`),
    prunePreview: (hostId: string) =>
      request<DockerPrunePreviewResponse>(`/hosts/${hostId}/docker/prune/preview`),
    pruneExecute: (hostId: string, body: DockerPruneExecuteRequest) =>
      request<DockerPruneExecuteResponse>(`/hosts/${hostId}/docker/prune/execute`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  compose: {
    projects: (hostId: string, customDir?: string) =>
      request<ComposeProject[]>(
        `/hosts/${hostId}/compose/projects${customDir ? `?customDir=${encodeURIComponent(customDir)}` : ''}`
      ),
    details: (hostId: string, filePath: string) =>
      request<ComposeStackDetail>(
        `/hosts/${hostId}/compose/details?filePath=${encodeURIComponent(filePath)}`
      ),
    validate: (hostId: string, body: { filePath?: string; composeYaml?: string }) =>
      request<ComposeValidateResponse>(`/hosts/${hostId}/compose/validate`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
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
    diskUsage: (hostId: string, path = '/', exclude = '/proc,/sys,/mnt,/dev', depth = 1) =>
      request<DiskUsageResult>(
        `/hosts/${hostId}/files/disk-usage?path=${encodeURIComponent(path)}&exclude=${encodeURIComponent(exclude)}&depth=${depth}`
      ),
    archive: (hostId: string, data: { path: string; items: string[]; format: 'zip' | 'tar.gz'; archiveName: string }) =>
      request<{ success: boolean; archivePath: string }>(`/hosts/${hostId}/files/archive`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    extract: (hostId: string, data: { archivePath: string; destinationPath: string }) =>
      request<{ success: boolean }>(`/hosts/${hostId}/files/extract`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  share: {
    create: (data: {
      hostId: string;
      filePath: string;
      expireHours?: number | null;
      expireDays?: number | null;
      maxDownloads?: number | null;
      password?: string;
    }) => request<SharedFile>('/share', { method: 'POST', body: JSON.stringify(data) }),
    listByHost: (hostId: string) => request<SharedFile[]>(`/share/host/${hostId}`),
    revoke: (id: string) => request<{ success: boolean }>(`/share/${id}`, { method: 'DELETE' }),
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
    liveSockets: (hostId: string) => request<LiveSocket[]>(`/hosts/${hostId}/ports/live-sockets`),
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
  cron: {
    list: (hostId: string) => request<CronJobItem[]>(`/hosts/${hostId}/cron`),
    raw: (hostId: string) => request<{ content: string }>(`/hosts/${hostId}/cron/raw`),
    saveRaw: (hostId: string, content: string) =>
      request<{ message: string }>(`/hosts/${hostId}/cron/raw`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    add: (hostId: string, data: { schedule: string; command: string; comment?: string; isEnabled?: boolean }) =>
      request<CronJobItem>(`/hosts/${hostId}/cron`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (hostId: string, lineIndex: number, data: { schedule: string; command: string; comment?: string; isEnabled?: boolean }) =>
      request<CronJobItem>(`/hosts/${hostId}/cron/${lineIndex}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (hostId: string, lineIndex: number) =>
      request<{ message: string }>(`/hosts/${hostId}/cron/${lineIndex}`, { method: 'DELETE' }),
    toggle: (hostId: string, lineIndex: number) =>
      request<CronJobItem>(`/hosts/${hostId}/cron/${lineIndex}/toggle`, { method: 'POST' }),
    run: (hostId: string, command: string) =>
      request<CronExecutionResult>(`/hosts/${hostId}/cron/run`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      }),
  },
  notifications: {
    list: () => request<NotificationListResponse>('/notifications'),
    create: (data: { title: string; message: string; severity?: string; hostId?: string }) =>
      request<NotificationItem>('/notifications', { method: 'POST', body: JSON.stringify(data) }),
    markRead: (id: string) =>
      request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: () =>
      request<{ success: boolean }>('/notifications/read-all', { method: 'POST' }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/notifications/${id}`, { method: 'DELETE' }),
    clearAll: () =>
      request<{ success: boolean }>('/notifications/clear-all', { method: 'DELETE' }),
    getSettings: () =>
      request<AlertSettings>('/notifications/settings'),
    saveSettings: (settings: AlertSettings) =>
      request<{ success: boolean }>('/notifications/settings', { method: 'POST', body: JSON.stringify(settings) }),
    test: (data: { telegramBotToken?: string; telegramChatId?: string; webhookUrl?: string }) =>
      request<TestAlertResult>('/notifications/test', { method: 'POST', body: JSON.stringify(data) }),
  },
  firewall: {
    getRules: (hostId: string) =>
      request<FirewallStatus>(`/hosts/${hostId}/firewall/rules`),
    addRule: (hostId: string, rule: CreateFirewallRuleRequest) =>
      request<{ success: boolean; message: string }>(`/hosts/${hostId}/firewall/rules`, {
        method: 'POST',
        body: JSON.stringify(rule),
      }),
    deleteRule: (hostId: string, ruleNumber: number) =>
      request<{ success: boolean; message: string }>(`/hosts/${hostId}/firewall/rules/${ruleNumber}`, {
        method: 'DELETE',
      }),
    getFail2ban: (hostId: string) =>
      request<Fail2banStatus>(`/hosts/${hostId}/firewall/fail2ban`),
    unbanIp: (hostId: string, ip: string, jail?: string) =>
      request<{ success: boolean; message: string }>(`/hosts/${hostId}/firewall/fail2ban/unban`, {
        method: 'POST',
        body: JSON.stringify({ ip, jail }),
      }),
  },
  passkey: {
    registerChallenge: () =>
      request<PasskeyRegisterChallenge>('/auth/passkey/register/challenge', { method: 'POST' }),
    registerVerify: (data: { name: string; credentialId: string; clientDataJson: string; attestationObject: string }) =>
      request<Passkey>('/auth/passkey/register/verify', { method: 'POST', body: JSON.stringify(data) }),
    loginChallenge: () =>
      request<PasskeyLoginChallenge>('/auth/passkey/login/challenge', { method: 'POST' }),
    loginVerify: (data: { credentialId: string; clientDataJson: string; authenticatorData: string; signature: string; userHandle?: string }) =>
      request<{ token: string; username: string }>('/auth/passkey/login/verify', { method: 'POST', body: JSON.stringify(data) }),
    list: () =>
      request<Passkey[]>('/auth/passkey/list'),
    delete: (id: string) =>
      request<{ success: boolean }>(`/auth/passkey/${id}`, { method: 'DELETE' }),
  },
  systemd: {
    list: (hostId: string) => request<SystemdService[]>(`/hosts/${hostId}/systemd/services`),
    action: (hostId: string, unitName: string, action: string) =>
      request<SystemdActionResult>(`/hosts/${hostId}/systemd/services/${encodeURIComponent(unitName)}/action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    logs: (hostId: string, unitName: string, lines = 100, priority?: string) =>
      request<{ logs: string }>(
        `/hosts/${hostId}/systemd/services/${encodeURIComponent(unitName)}/logs?lines=${lines}${priority ? `&priority=${encodeURIComponent(priority)}` : ''}`
      ),
  },
  users: {
    list: (hostId: string) => request<LinuxUser[]>(`/hosts/${hostId}/users`),
    create: (
      hostId: string,
      data: { username: string; password?: string; shell?: string; sudo?: boolean; createHome?: boolean }
    ) =>
      request<LinuxUserActionResult>(`/hosts/${hostId}/users`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    lock: (hostId: string, username: string) =>
      request<LinuxUserActionResult>(`/hosts/${hostId}/users/${encodeURIComponent(username)}/lock`, {
        method: 'POST',
      }),
    unlock: (hostId: string, username: string) =>
      request<LinuxUserActionResult>(`/hosts/${hostId}/users/${encodeURIComponent(username)}/unlock`, {
        method: 'POST',
      }),
    toggleSudo: (hostId: string, username: string) =>
      request<LinuxUserActionResult>(`/hosts/${hostId}/users/${encodeURIComponent(username)}/toggle-sudo`, {
        method: 'POST',
      }),
    delete: (hostId: string, username: string, removeHome = true) =>
      request<LinuxUserActionResult>(
        `/hosts/${hostId}/users/${encodeURIComponent(username)}?removeHome=${removeHome}`,
        { method: 'DELETE' }
      ),
  },
  packages: {
    check: (hostId: string) => request<PackageUpdateCheckResult>(`/hosts/${hostId}/packages/check`),
    upgrade: (hostId: string) =>
      request<PackageUpgradeResult>(`/hosts/${hostId}/packages/upgrade`, {
        method: 'POST',
      }),
  },
};

// WebAuthn buffer conversion helpers
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

