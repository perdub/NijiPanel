export interface Host {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key' | 'global_key';
  notes?: string;
  tags?: string;
  createdAt: string;
  isOnline?: boolean;
  osInfo?: string;
  uptime?: string;
  cpuUsage?: string;
  memoryUsage?: string;
  diskUsage?: string;
}

export interface HostStats {
  isOnline: boolean;
  osInfo?: string;
  uptime?: string;
  memoryUsage?: string;
  diskUsage?: string;
  cpuUsage?: string;
  networkUsage?: string;
  loadAverage?: string;
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  dockerVersion?: string;
  error?: string;
}

export interface Container {
  id: string;
  names: string;
  image: string;
  status: string;
  state: string; // running, exited, paused
  ports: string;
  createdAt: string;
  command: string;
}

export interface ContainerInspect {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: string;
  env: string[];
  ports: string[];
  mounts: string[];
  restartPolicy: string;
  rawJson: string;
}

export interface ComposeProject {
  name: string;
  filePath: string;
  directory: string;
  services: string[];
  status: string;
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
  permissions: string;
  owner: string;
  group: string;
  extension: string;
  isText: boolean;
  isImage: boolean;
  isAudio: boolean;
}

export interface DirectoryListing {
  currentPath: string;
  parentPath?: string;
  items: FileItem[];
}

export interface HostPort {
  id: string;
  hostId: string;
  port: number;
  protocol: string;
  serviceName: string;
  description?: string;
}

export interface HostNote {
  id: string;
  hostId: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface SshTunnel {
  id: string;
  hostId: string;
  name: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  isActive: boolean;
}

export interface MasterKey {
  publicKey: string;
  keyType: string;
  fingerprint: string;
}

export interface CronJobItem {
  id: string;
  lineIndex: number;
  schedule: string;
  command: string;
  comment: string;
  isEnabled: boolean;
  rawLine: string;
  scheduleDescription: string;
}

export interface CronExecutionResult {
  exitCode: number;
  output: string;
  error: string;
  durationMs: number;
}
