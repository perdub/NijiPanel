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
  state: string; // running, exited, paused, restarting, dead
  ports: string;
  createdAt: string;
  command: string;
  isCrashed?: boolean;
  isOOMKilled?: boolean;
  exitCode?: number;
  crashDump?: string;
}

export interface ContainerCrashDump {
  containerId: string;
  name: string;
  state: string;
  exitCode: number;
  oomKilled: boolean;
  finishedAt?: string;
  error?: string;
  logs: string;
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

export interface ComposeServiceDetail {
  name: string;
  image: string;
  ports: string[];
  environment: Record<string, string>;
  volumes: string[];
  dependsOn: string[];
  restart: string;
  networks: string[];
}

export interface ComposeStackDetail {
  projectName: string;
  filePath: string;
  directory: string;
  rawYaml: string;
  services: ComposeServiceDetail[];
}

export interface ComposeValidateResponse {
  valid: boolean;
  output: string;
  error?: string;
}

export interface AppTemplate {
  id: string;
  name: string;
  category: string; // Database, Web, Media, Tools, Dev, Analytics
  description: string;
  icon: string;
  defaultEnv: Record<string, string>;
  composeYaml: string;
}

export interface DeployTemplateRequest {
  templateId: string;
  env: Record<string, string>;
  projectName: string;
}

export interface DeployTemplateResponse {
  success: boolean;
  projectName: string;
  directory: string;
  output: string;
  error?: string;
}

export interface DockerHubRepo {
  repoName: string;
  shortDescription: string;
  starCount: number;
  pullCount: number;
  isOfficial: boolean;
}

export interface DockerHubSearchResponse {
  count: number;
  results: DockerHubRepo[];
}

export interface DockerPruneCategoryInfo {
  type: string;
  totalCount: number;
  activeCount: number;
  size: string;
  reclaimable: string;
  reclaimableBytes: number;
}

export interface DockerPrunePreviewResponse {
  categories: DockerPruneCategoryInfo[];
  totalReclaimable: string;
  totalReclaimableBytes: number;
}

export interface DockerPruneExecuteRequest {
  pruneImages: boolean;
  pruneContainers: boolean;
  pruneVolumes: boolean;
  pruneBuildCache: boolean;
}

export interface DockerPruneExecuteResponse {
  success: boolean;
  output: string;
  error?: string;
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

export interface SharedFile {
  token: string;
  hostId: string;
  filePath: string;
  fileName: string;
  createdAt: string;
  expiresAt?: string | null;
  downloadCount: number;
  maxDownloads?: number | null;
  isActive: boolean;
  downloadUrl: string;
  hasPassword?: boolean;
}

export interface DiskUsageItem {
  path: string;
  name: string;
  sizeBytes: number;
  percent: number;
  depth: number;
}

export interface DiskUsageResult {
  path: string;
  totalSizeBytes: number;
  items: DiskUsageItem[];
}

// === Packet 4: Monitoring, Alerts, Security & Passkeys ===

export interface MetricDataPoint {
  timestamp: string;
  cpuPercent: number;
  ramPercent: number;
  netRxKbps: number;
  netTxKbps: number;
  diskPercent: number;
}

export interface DiskFillPrediction {
  isStable: boolean;
  daysUntilFull?: number | null;
  hoursUntilFull?: number | null;
  formattedPrediction: string;
}

export interface HostMetricsHistory {
  hostId: string;
  prediction: DiskFillPrediction;
  history: MetricDataPoint[];
}

export interface NotificationItem {
  id: string;
  hostId?: string | null;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  createdAt: string;
  isRead: boolean;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export interface AlertSettings {
  telegramBotToken?: string;
  telegramChatId?: string;
  webhookUrl?: string;
  alertsEnabled: boolean;
}

export interface TestAlertResult {
  telegramSuccess: boolean;
  telegramError?: string | null;
  webhookSuccess: boolean;
  webhookError?: string | null;
}

export interface BenchmarkResult {
  hostId: string;
  hostName: string;
  score: number;
  diskWriteSpeedMBps: number;
  diskWriteFormatted: string;
  cpuSha256Ops: number;
  cpuFormatted: string;
  pingAverageMs: number;
  pingFormatted: string;
  executedAt: string;
  summary: string;
}

export interface FirewallRule {
  number: number;
  action: string;
  from: string;
  to: string;
  protocol: string;
  direction?: string | null;
}

export interface FirewallStatus {
  isActive: boolean;
  statusText: string;
  backend: string;
  rules: FirewallRule[];
}

export interface CreateFirewallRuleRequest {
  port: string;
  protocol?: string;
  action?: string;
  from?: string;
}

export interface Fail2banStatus {
  isInstalled: boolean;
  isRunning: boolean;
  jails: string[];
  bannedIps: string[];
  currentlyBanned: number;
  totalBanned: number;
}

export interface Passkey {
  id: string;
  name: string;
  createdAt: string;
}

export interface PasskeyRegisterChallenge {
  challenge: string;
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  userDisplayName: string;
  timeout: number;
}

export interface PasskeyLoginChallenge {
  challenge: string;
  rpId: string;
  timeout: number;
  allowCredentials?: string[] | null;
}

export interface SystemdService {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

export interface SystemdActionResult {
  success: boolean;
  unit: string;
  action: string;
  output: string;
  error?: string;
}

export interface LinuxUser {
  username: string;
  uid: number;
  gid: number;
  fullName: string;
  homeDirectory: string;
  shell: string;
  groups: string[];
  isSudo: boolean;
  isSystem: boolean;
  isLocked: boolean;
}

export interface LinuxUserActionResult {
  success: boolean;
  message: string;
  output?: string;
}

export interface PackageUpdateCheckResult {
  packageManager: string;
  availableUpdatesCount: number;
  securityUpdatesCount: number;
  packages: string[];
  summary: string;
  rawOutput: string;
}

export interface PackageUpgradeResult {
  success: boolean;
  exitCode: number;
  output: string;
  error: string;
}

export interface LiveSocket {
  protocol: string;
  state: string;
  localAddress: string;
  port: number;
  processName?: string;
  pid?: number;
  raw: string;
}

export interface RandomizePortResult {
  success: boolean;
  oldPort: number;
  newPort: number;
  message: string;
  details?: string;
}


