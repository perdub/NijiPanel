import React, { useState, useRef, useEffect } from 'react';
import {
  Key,
  Lock,
  Copy,
  Check,
  RefreshCw,
  X,
  AlertCircle,
  Database,
  Cloud,
  Download,
  Upload,
  ArrowRight,
  Share2,
  Bell,
  Send,
  Fingerprint,
  Trash2,
  ShieldCheck,
  KeyRound,
  Wrench,
  Terminal,
  Search,
  Edit2,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { api, bufferToBase64Url, base64UrlToBuffer } from '../api';
import { MasterKey, Passkey, AlertSettings, TestAlertResult, CommandTemplate } from '../types';
import { DoritoLogo } from './DoritoLogo';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterKey: MasterKey | null;
  onMasterKeyUpdated: (key: MasterKey) => void;
  onBackupRestored?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  masterKey,
  onMasterKeyUpdated,
  onBackupRestored,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'key' | 'password' | 'alerts' | 'passkeys' | 'backup' | 'provisioning' | 'commands'>('key');
  const [copiedKey, setCopiedKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Bootstrap Provisioning States
  const [bootstrapScript, setBootstrapScript] = useState('');
  const [bootstrapEnabled, setBootstrapEnabled] = useState(false);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapSaving, setBootstrapSaving] = useState(false);
  const [bootstrapMsg, setBootstrapMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passMessage, setPassMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Alerts & Notifications States
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertSaveMsg, setAlertSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testingAlert, setTestingAlert] = useState(false);
  const [alertTestResult, setAlertTestResult] = useState<TestAlertResult | null>(null);

  // Passkeys States
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(false);
  const [passkeyRegistering, setPasskeyRegistering] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  // Backup & Cloud Share States
  const [cloudExporting, setCloudExporting] = useState(false);
  const [cloudExportResult, setCloudExportResult] = useState<{
    shareCode: string;
    shareUrl: string;
    passphrase: string;
  } | null>(null);
  const [copiedShareCode, setCopiedShareCode] = useState(false);
  const [copiedPassphrase, setCopiedPassphrase] = useState(false);

  // Cloud Import States
  const [importShareCode, setImportShareCode] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [cloudImporting, setCloudImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Local file backup
  const [localPassphrase, setLocalPassphrase] = useState('');
  const [localExporting, setLocalExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Command Templates States
  const [commandsList, setCommandsList] = useState<CommandTemplate[]>([]);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingCommand, setEditingCommand] = useState<string>('');
  const [editingTimeout, setEditingTimeout] = useState<number>(30);
  const [editingDesc, setEditingDesc] = useState<string>('');
  const [cmdSaving, setCmdSaving] = useState(false);
  const [cmdMsg, setCmdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCmdKey, setCopiedCmdKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (activeSubTab === 'alerts') loadAlertSettings();
      if (activeSubTab === 'passkeys') loadPasskeys();
      if (activeSubTab === 'provisioning') loadBootstrapSettings();
      if (activeSubTab === 'commands') loadCommands();
    }
  }, [isOpen, activeSubTab]);

  const loadCommands = async () => {
    setCommandsLoading(true);
    setCmdMsg(null);
    try {
      const data = await api.commands.getAll();
      setCommandsList(data);
    } catch (err: any) {
      setCmdMsg({ type: 'error', text: `Failed to load commands: ${err.message}` });
    } finally {
      setCommandsLoading(false);
    }
  };

  const handleStartEditCommand = (cmd: CommandTemplate) => {
    setEditingKey(cmd.key);
    setEditingCommand(cmd.command);
    setEditingTimeout(cmd.timeoutSeconds);
    setEditingDesc(cmd.description);
    setCmdMsg(null);
  };

  const handleSaveCommand = async (key: string) => {
    setCmdSaving(true);
    setCmdMsg(null);
    try {
      const updated = await api.commands.update(key, {
        command: editingCommand,
        timeoutSeconds: editingTimeout,
        description: editingDesc,
      });
      setCommandsList(prev => prev.map(c => c.key === key ? updated : c));
      setEditingKey(null);
      setCmdMsg({ type: 'success', text: `Command '${key}' updated successfully!` });
    } catch (err: any) {
      setCmdMsg({ type: 'error', text: `Failed to save command: ${err.message}` });
    } finally {
      setCmdSaving(false);
    }
  };

  const handleResetCommands = async () => {
    if (!confirm('Are you sure you want to reset all command templates to default? Any custom modifications will be overwritten.')) return;
    setCommandsLoading(true);
    setCmdMsg(null);
    try {
      const res = await api.commands.reset();
      await loadCommands();
      setCmdMsg({ type: 'success', text: res.message || 'All commands reset to defaults' });
    } catch (err: any) {
      setCmdMsg({ type: 'error', text: `Failed to reset commands: ${err.message}` });
    } finally {
      setCommandsLoading(false);
    }
  };

  const handleCopyCommand = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmdKey(key);
    setTimeout(() => setCopiedCmdKey(null), 1500);
  };


  const loadBootstrapSettings = async () => {
    setBootstrapLoading(true);
    try {
      const res = await api.settings.getBootstrapScript();
      setBootstrapScript(res.script || '');
      setBootstrapEnabled(res.enabled ?? false);
    } catch {
      // ignore
    } finally {
      setBootstrapLoading(false);
    }
  };

  const handleSaveBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setBootstrapSaving(true);
    setBootstrapMsg(null);
    try {
      await api.settings.setBootstrapScript({
        script: bootstrapScript,
        enabled: bootstrapEnabled,
      });
      setBootstrapMsg({ type: 'success', text: 'Bootstrap provisioning settings saved successfully!' });
      setTimeout(() => setBootstrapMsg(null), 3000);
    } catch (err: any) {
      setBootstrapMsg({ type: 'error', text: err.message || 'Failed to save bootstrap settings' });
    } finally {
      setBootstrapSaving(false);
    }
  };

  const loadAlertSettings = async () => {
    try {
      const res = await api.notifications.getSettings();
      setTgBotToken(res.telegramBotToken || '');
      setTgChatId(res.telegramChatId || '');
      setWebhookUrl(res.webhookUrl || '');
      setAlertsEnabled(res.alertsEnabled ?? false);
    } catch {
      // ignore
    }
  };

  const handleSaveAlerts = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAlerts(true);
    setAlertSaveMsg(null);
    try {
      await api.notifications.saveSettings({
        telegramBotToken: tgBotToken,
        telegramChatId: tgChatId,
        webhookUrl,
        alertsEnabled,
      });
      setAlertSaveMsg({ type: 'success', text: 'Alert settings saved successfully!' });
      setTimeout(() => setAlertSaveMsg(null), 3000);
    } catch (err: any) {
      setAlertSaveMsg({ type: 'error', text: err.message || 'Failed to save alert settings' });
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleTestAlert = async () => {
    setTestingAlert(true);
    setAlertTestResult(null);
    try {
      const res = await api.notifications.test({
        telegramBotToken: tgBotToken,
        telegramChatId: tgChatId,
        webhookUrl,
      });
      setAlertTestResult(res);
    } catch (err: any) {
      alert(`Test alert error: ${err.message}`);
    } finally {
      setTestingAlert(false);
    }
  };

  const loadPasskeys = async () => {
    setPasskeysLoading(true);
    try {
      const list = await api.passkey.list();
      setPasskeys(list);
    } catch {
      // ignore
    } finally {
      setPasskeysLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!window.PublicKeyCredential) {
      alert('Passkeys / WebAuthn is not supported in this browser.');
      return;
    }
    setPasskeyRegistering(true);
    setPasskeyError(null);
    try {
      const ch = await api.passkey.registerChallenge();
      const challengeBuffer = base64UrlToBuffer(ch.challenge);
      const userIdBuffer = new TextEncoder().encode(ch.userId);

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: challengeBuffer,
          rp: {
            name: ch.rpName || 'NijiPanel',
            id: ch.rpId || window.location.hostname,
          },
          user: {
            id: userIdBuffer,
            name: ch.userName,
            displayName: ch.userDisplayName,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
          },
          timeout: ch.timeout || 60000,
          attestation: 'none',
        },
      })) as PublicKeyCredential;

      if (!credential) {
        throw new Error('No credential was returned from authenticator');
      }

      const rawResp = credential.response as AuthenticatorAttestationResponse;
      const clientDataJson = bufferToBase64Url(rawResp.clientDataJSON);
      const attestationObject = bufferToBase64Url(rawResp.attestationObject);
      const credentialId = bufferToBase64Url(credential.rawId);

      const deviceName = prompt('Enter a friendly name for this Passkey device:', 'My Security Key') || 'Passkey Device';

      await api.passkey.registerVerify({
        name: deviceName,
        credentialId,
        clientDataJson,
        attestationObject,
      });

      alert('Passkey registered successfully!');
      loadPasskeys();
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setPasskeyError(err.message || 'Passkey registration error');
      }
    } finally {
      setPasskeyRegistering(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Passkey?')) return;
    try {
      await api.passkey.delete(id);
      loadPasskeys();
    } catch (err: any) {
      alert(`Failed to delete passkey: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  const handleCopyKey = () => {
    if (!masterKey) return;
    navigator.clipboard.writeText(masterKey.publicKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRegenerateKey = async () => {
    if (!confirm('WARNING: Regenerating the master SSH key will prevent connection to hosts configured with the previous key until their authorized_keys are updated. Continue?')) {
      return;
    }

    setRegenerating(true);
    try {
      const updated = await api.settings.regenerateMasterKey(4096);
      onMasterKeyUpdated(updated);
      alert('NijiPanel master key regenerated successfully!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setRegenerating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage(null);

    if (newPassword !== confirmPassword) {
      setPassMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setPassSaving(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      setPassMessage({ type: 'success', text: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassMessage({ type: 'error', text: err.message || 'Failed to update password' });
    } finally {
      setPassSaving(false);
    }
  };

  const handleCloudExport = async () => {
    setCloudExporting(true);
    try {
      const res = await api.backup.cloudExport();
      setCloudExportResult(res);
    } catch (err: any) {
      alert(`Cloud backup error: ${err.message}`);
    } finally {
      setCloudExporting(false);
    }
  };

  const handleCloudImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importShareCode.trim() || !importPassphrase.trim()) return;

    setCloudImporting(true);
    setImportStatus(null);
    try {
      const res = await api.backup.cloudImport({
        shareCodeOrUrl: importShareCode.trim(),
        passphrase: importPassphrase.trim(),
      });
      setImportStatus(res.success ? `Success! Imported ${res.importedHosts} host(s)` : 'Import failed');
      if (res.success && onBackupRestored) {
        setTimeout(() => {
          onBackupRestored();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`);
    } finally {
      setCloudImporting(false);
    }
  };

  const handleLocalExport = async () => {
    setLocalExporting(true);
    try {
      const response = await api.backup.export(localPassphrase || '');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nijipanel-backup-${new Date().toISOString().split('T')[0]}.deck`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Failed to create backup: ${err.message}`);
    } finally {
      setLocalExporting(false);
    }
  };

  const handleLocalImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (!confirm('Restoring backup will merge or update current server configurations. Continue?')) {
      return;
    }

    try {
      const res = await api.backup.import(file, localPassphrase || '');
      alert(`Backup restored successfully! Imported ${res.importedHosts} host(s)`);
      if (onBackupRestored) onBackupRestored();
      onClose();
    } catch (err: any) {
      alert(`Backup restore failed: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const commandCategories = ['all', 'System', 'Network', 'Docker', 'Systemd', 'Users', 'Packages', 'Firewall', 'Cron', 'Files'];

  const filteredCommands = commandsList.filter((cmd) => {
    const matchesCat = selectedCategory === 'all' || cmd.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !commandSearch ||
      cmd.key.toLowerCase().includes(commandSearch.toLowerCase()) ||
      (cmd.description || '').toLowerCase().includes(commandSearch.toLowerCase()) ||
      (cmd.command || '').toLowerCase().includes(commandSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className={`w-full ${activeSubTab === 'commands' ? 'max-w-4xl' : 'max-w-xl'} bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative max-h-[92vh] overflow-y-auto transition-all`}>
        <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
          <div className="flex items-center gap-2.5">
            <DoritoLogo size={28} />
            <h3 className="font-medium text-white text-lg font-sans">
              Niji<span className="text-dorito-500">Panel</span> Settings
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-carbon-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="flex border-b border-carbon-700 mb-5 gap-3.5 text-xs font-mono font-semibold overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setActiveSubTab('key')}
            className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'key'
                ? 'border-dorito-500 text-dorito-400 font-bold'
                : 'border-transparent text-carbon-400 hover:text-white'
            }`}
          >
            SSH Master Key
          </button>
          <button
            onClick={() => setActiveSubTab('password')}
            className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'password'
                ? 'border-dorito-500 text-dorito-400 font-bold'
                : 'border-transparent text-carbon-400 hover:text-white'
            }`}
          >
            Change Password
          </button>
          <button
            onClick={() => setActiveSubTab('alerts')}
            className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'alerts'
                ? 'border-dorito-500 text-dorito-400 font-bold'
                : 'border-transparent text-carbon-400 hover:text-white'
            }`}
          >
            Alerts & Notifications
          </button>
          <button
            onClick={() => setActiveSubTab('passkeys')}
            className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'passkeys'
                ? 'border-dorito-500 text-dorito-400 font-bold'
                : 'border-transparent text-carbon-400 hover:text-white'
            }`}
          >
            Passkeys
          </button>
          <button
            onClick={() => setActiveSubTab('backup')}
            className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'backup'
                ? 'border-dorito-500 text-dorito-400 font-bold'
                : 'border-transparent text-carbon-400 hover:text-white'
            }`}
          >
            Backup & Migration
          </button>
          <button
            onClick={() => setActiveSubTab('provisioning')}
            className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap ${
              activeSubTab === 'provisioning'
                ? 'border-dorito-500 text-dorito-400 font-bold'
                : 'border-transparent text-carbon-400 hover:text-white'
            }`}
          >
            Host Provisioning
          </button>
          <button
            onClick={() => setActiveSubTab('commands')}
            className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'commands'
                ? 'border-dorito-500 text-dorito-400 font-bold'
                : 'border-transparent text-carbon-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Commands
          </button>
        </div>

        {/* Tab 1: Global Master Key */}
        {activeSubTab === 'key' && (
          <div className="space-y-4 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs text-carbon-400">
                Used by default for 1-click provisioning across target servers.
              </span>
              <button
                onClick={handleRegenerateKey}
                disabled={regenerating}
                className="text-[11px] text-carbon-400 hover:text-amber-400 flex items-center gap-1 transition-colors shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>

            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-black/80 border border-carbon-700 font-mono text-[11px] text-dorito-300 max-h-36 overflow-y-auto break-all select-all leading-relaxed">
                {masterKey?.publicKey || 'Loading...'}
              </pre>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-mono text-[11px] text-carbon-500 truncate max-w-xs">
                {masterKey?.fingerprint}
              </span>
              <button
                onClick={handleCopyKey}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-medium text-xs shadow-md shadow-dorito-500/20 transition-all"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-950" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied!' : 'Copy .pub Key'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Change Password */}
        {activeSubTab === 'password' && (
          <div>
            {passMessage && (
              <div
                className={`p-3 rounded-xl mb-4 text-xs font-mono flex items-center gap-2 ${
                  passMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {passMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{passMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3 font-mono">
              <div>
                <label className="block text-xs font-medium text-carbon-300 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-dorito-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-carbon-300 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-dorito-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-carbon-300 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-dorito-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={passSaving}
                  className="px-4 py-2 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-medium text-xs transition-colors disabled:opacity-50 shadow-md shadow-dorito-500/20"
                >
                  {passSaving ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Backup & Cloud Share (2 Values) */}
        {activeSubTab === 'backup' && (
          <div className="space-y-6 font-mono">
            {/* Cloud Export in 2 Values */}
            <div className="p-4 rounded-xl bg-carbon-850 border border-carbon-700 space-y-3">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-dorito-500" />
                <h4 className="text-sm font-medium text-white font-sans">Zero-Knowledge Cloud Migration (2-Value Transfer)</h4>
              </div>
              <p className="text-xs text-carbon-400 leading-relaxed font-sans">
                All host configurations are encrypted client-side using <strong>AES-256-GCM</strong> before uploading. To restore on another machine, save only <strong>2 values</strong>: the share code and passphrase.
              </p>

              <button
                onClick={handleCloudExport}
                disabled={cloudExporting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-medium text-xs shadow-md shadow-dorito-500/20 transition-all disabled:opacity-50"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{cloudExporting ? 'Encrypting & Uploading...' : 'Generate Cloud Backup'}</span>
              </button>

              {cloudExportResult && (
                <div className="mt-3 p-3.5 rounded-xl bg-black/80 border border-carbon-700 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-carbon-400 font-medium">1. Share Code / URL:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(cloudExportResult.shareUrl);
                        setCopiedShareCode(true);
                        setTimeout(() => setCopiedShareCode(false), 2000);
                      }}
                      className="text-dorito-400 hover:text-dorito-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedShareCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedShareCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-xs text-dorito-300 break-all select-all">
                    {cloudExportResult.shareUrl}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-carbon-700">
                    <span className="text-carbon-400 font-medium">2. Decryption Passphrase:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(cloudExportResult.passphrase);
                        setCopiedPassphrase(true);
                        setTimeout(() => setCopiedPassphrase(false), 2000);
                      }}
                      className="text-dorito-400 hover:text-dorito-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedPassphrase ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPassphrase ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-xs text-emerald-400 break-all select-all">
                    {cloudExportResult.passphrase}
                  </div>
                </div>
              )}
            </div>

            {/* Cloud Restore */}
            <div className="p-4 rounded-xl bg-carbon-850 border border-carbon-700 space-y-3">
              <h4 className="text-sm font-medium text-white flex items-center gap-2 font-sans">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Restore from Cloud via 2 Values</span>
              </h4>

              {importStatus && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
                  {importStatus}
                </div>
              )}

              <form onSubmit={handleCloudImport} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-carbon-300 mb-1">1. Share Code or URL</label>
                    <input
                      type="text"
                      value={importShareCode}
                      onChange={(e) => setImportShareCode(e.target.value)}
                      placeholder="abcde or https://paste.rs/..."
                      required
                      className="w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-dorito-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-carbon-300 mb-1">2. Decryption Passphrase</label>
                    <input
                      type="text"
                      value={importPassphrase}
                      onChange={(e) => setImportPassphrase(e.target.value)}
                      placeholder="Secret passphrase"
                      required
                      className="w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-dorito-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={cloudImporting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <span>{cloudImporting ? 'Fetching & Decrypting...' : 'Restore Data'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>

            {/* Local Offline File Export / Import */}
            <div className="p-4 rounded-xl bg-carbon-850 border border-carbon-700 space-y-3">
              <h4 className="text-sm font-medium text-white flex items-center gap-2 font-sans">
                <Database className="w-4 h-4 text-dorito-500" />
                <span>Offline Backup File (.deck)</span>
              </h4>

              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium text-carbon-300 mb-1">File Encryption Passphrase</label>
                  <input
                    type="password"
                    value={localPassphrase}
                    onChange={(e) => setLocalPassphrase(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-dorito-500 font-mono"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleLocalExport}
                    disabled={localExporting}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-white text-xs font-medium transition-colors border border-carbon-600"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLocalImportFile}
                    accept=".deck,.json"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-white text-xs font-medium transition-colors border border-carbon-600"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Alerts & Notifications */}
        {activeSubTab === 'alerts' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-carbon-800">
              <div>
                <h4 className="font-medium text-white text-sm">External Alert Integrations</h4>
                <p className="text-[11px] text-carbon-400">
                  Dispatch instant notifications to Telegram or a custom HTTP Webhook
                </p>
              </div>
              <Bell className="w-5 h-5 text-dorito-500" />
            </div>

            {alertSaveMsg && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                  alertSaveMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {alertSaveMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{alertSaveMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveAlerts} className="space-y-3">
              <div>
                <label className="block text-carbon-300 mb-1">Telegram Bot Token</label>
                <input
                  type="text"
                  placeholder="e.g. 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                  value={tgBotToken}
                  onChange={(e) => setTgBotToken(e.target.value)}
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-carbon-300 mb-1">Telegram Chat ID</label>
                <input
                  type="text"
                  placeholder="e.g. 987654321 or -100123456789"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-carbon-300 mb-1">Generic Webhook URL</label>
                <input
                  type="url"
                  placeholder="https://your-webhook-endpoint.com/api/alerts"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="enableAlertsCheck"
                  checked={alertsEnabled}
                  onChange={(e) => setAlertsEnabled(e.target.checked)}
                  className="rounded bg-carbon-800 border-carbon-700 text-dorito-500 focus:ring-0"
                />
                <label htmlFor="enableAlertsCheck" className="text-carbon-200 cursor-pointer select-none">
                  Enable active external notifications dispatch
                </label>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-carbon-800">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  disabled={testingAlert}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-dorito-400 font-semibold border border-carbon-700 transition-colors disabled:opacity-40"
                >
                  <Send className={`w-3.5 h-3.5 ${testingAlert ? 'animate-pulse' : ''}`} />
                  <span>{testingAlert ? 'Testing...' : 'Test Alert'}</span>
                </button>

                <button
                  type="submit"
                  disabled={savingAlerts}
                  className="px-4 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-medium transition-colors shadow-md disabled:opacity-40"
                >
                  {savingAlerts ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>

            {alertTestResult && (
              <div className="p-3 rounded-xl bg-carbon-850 border border-carbon-700 space-y-2 mt-3">
                <span className="text-[10px] text-carbon-400 uppercase font-bold">Integration Test Results</span>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-carbon-300">Telegram Bot:</span>
                  <span className={alertTestResult.telegramSuccess ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                    {alertTestResult.telegramSuccess ? '✓ Delivered' : alertTestResult.telegramError || 'Failed'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-carbon-300">Generic Webhook:</span>
                  <span className={alertTestResult.webhookSuccess ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                    {alertTestResult.webhookSuccess ? '✓ Delivered' : alertTestResult.webhookError || 'Failed'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Passkeys (WebAuthn) */}
        {activeSubTab === 'passkeys' && (
          <div className="space-y-4 font-mono text-xs">
            <div className="flex items-start justify-between pb-2 border-b border-carbon-800">
              <div>
                <h4 className="font-medium text-white text-sm">Passkeys & WebAuthn Credentials</h4>
                <p className="text-[11px] text-carbon-400">
                  Sign in without passwords using Touch ID, Face ID, Windows Hello, or YubiKey
                </p>
              </div>
              <Fingerprint className="w-5 h-5 text-dorito-500" />
            </div>

            {passkeyError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passkeyError}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-carbon-300 text-xs">
                Registered Passkeys ({passkeys.length})
              </span>
              <button
                onClick={handleRegisterPasskey}
                disabled={passkeyRegistering}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-medium transition-colors shadow-md disabled:opacity-50"
              >
                <Fingerprint className="w-4 h-4" />
                <span>{passkeyRegistering ? 'Registering...' : 'Register New Passkey'}</span>
              </button>
            </div>

            {/* List of registered passkeys */}
            <div className="rounded-xl border border-carbon-700 bg-carbon-850 overflow-hidden divide-y divide-carbon-800">
              {passkeysLoading ? (
                <div className="p-6 text-center text-carbon-500 text-xs">Loading passkeys...</div>
              ) : passkeys.length === 0 ? (
                <div className="p-8 text-center text-carbon-500 space-y-1">
                  <KeyRound className="w-8 h-8 mx-auto opacity-30 text-dorito-500 mb-2" />
                  <p className="text-xs text-carbon-300 font-bold">No Passkeys registered yet</p>
                  <p className="text-[11px] text-carbon-500 font-sans">
                    Pair your device or hardware security key for fast, passwordless 1-tap sign in.
                  </p>
                </div>
              ) : (
                passkeys.map((pk) => (
                  <div key={pk.id} className="p-3 flex items-center justify-between hover:bg-carbon-800/60 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-carbon-800 text-dorito-400">
                        <Fingerprint className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium text-white text-xs">{pk.name}</div>
                        <div className="text-[10px] text-carbon-500">
                          Added: {new Date(pk.createdAt).toLocaleDateString()} {new Date(pk.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeletePasskey(pk.id)}
                      className="p-1.5 rounded-lg text-carbon-500 hover:text-rose-400 hover:bg-carbon-700 transition-colors"
                      title="Delete Passkey"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 6: Host Provisioning / Default Packages */}
        {activeSubTab === 'provisioning' && (
          <form onSubmit={handleSaveBootstrap} className="space-y-4 font-mono text-xs">
            <div className="flex items-start justify-between pb-2 border-b border-carbon-800">
              <div>
                <h4 className="font-medium text-white text-sm">Host Bootstrap & Package Provisioning</h4>
                <p className="text-[11px] text-carbon-400">
                  Automatically run commands or install software (Docker, Neofetch, utilities) on any new server upon registration.
                </p>
              </div>
              <Wrench className="w-5 h-5 text-dorito-500" />
            </div>

            {bootstrapMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  bootstrapMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bootstrapMsg.text}</span>
              </div>
            )}

            {/* Toggle Enable */}
            <div className="p-3 rounded-xl bg-carbon-850 border border-carbon-700/80">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bootstrapEnabled}
                  onChange={(e) => setBootstrapEnabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-carbon-800 border-carbon-700 text-dorito-500 focus:ring-0"
                />
                <div>
                  <span className="text-white text-xs font-medium block">
                    Enable automatic bootstrap execution on new hosts
                  </span>
                  <span className="text-[10px] text-carbon-400 block">
                    When checked, NijiPanel runs the bash script below over SSH immediately after a host is added.
                  </span>
                </div>
              </label>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-carbon-400 block">Quick Stack Presets:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setBootstrapScript(
                      `# Docker + Docker Compose\napt-get update -y && apt-get install -y curl ca-certificates\ncurl -fsSL https://get.docker.com | sh\napt-get install -y docker-compose-plugin\nsystemctl enable --now docker`
                    )
                  }
                  className="px-2.5 py-1 rounded bg-carbon-800 hover:bg-carbon-750 text-carbon-200 hover:text-white border border-carbon-700 text-[11px] transition-colors"
                >
                  + Docker & Compose
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setBootstrapScript(
                      `# Essential Sysadmin Utilities\napt-get update -y && apt-get install -y neofetch htop curl git jq unzip ufw fail2ban`
                    )
                  }
                  className="px-2.5 py-1 rounded bg-carbon-800 hover:bg-carbon-750 text-carbon-200 hover:text-white border border-carbon-700 text-[11px] transition-colors"
                >
                  + Neofetch & Tools
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setBootstrapScript(
                      `# Full Stack: Utilities + Docker + Compose\napt-get update -y && apt-get install -y neofetch htop curl git jq unzip ufw fail2ban\ncurl -fsSL https://get.docker.com | sh\napt-get install -y docker-compose-plugin\nsystemctl enable --now docker`
                    )
                  }
                  className="px-2.5 py-1 rounded bg-carbon-800 hover:bg-carbon-750 text-carbon-200 hover:text-white border border-carbon-700 text-[11px] transition-colors"
                >
                  + Full Stack (Docker + Neofetch + Tools)
                </button>
              </div>
            </div>

            {/* Script Textarea */}
            <div>
              <label className="block text-xs text-carbon-300 mb-1">
                Bootstrap Shell Script (Bash)
              </label>
              <textarea
                rows={7}
                value={bootstrapScript}
                onChange={(e) => setBootstrapScript(e.target.value)}
                placeholder="#!/usr/bin/env bash&#10;apt-get update -y && apt-get install -y docker.io neofetch"
                className="w-full bg-black/80 border border-carbon-700 rounded-xl px-3 py-2 text-xs font-mono text-dorito-300 focus:outline-none focus:border-dorito-500 leading-relaxed"
              />
              <span className="text-[10px] text-carbon-500 block mt-1">
                Script runs with root / sudo permissions. Errors or output will be captured in the Notification Center.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={bootstrapSaving}
                className="px-4 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-medium text-xs transition-colors disabled:opacity-50 shadow-md shadow-dorito-500/20"
              >
                {bootstrapSaving ? 'Saving...' : 'Save Provisioning Settings'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 7: Commands Registry */}
        {activeSubTab === 'commands' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-white text-sm font-medium font-sans">Shell Command Registry</h4>
                <p className="text-xs text-carbon-400 font-mono mt-0.5">
                  Centralized command templates executed over SSH. Customizations persist across restarts.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetCommands}
                  disabled={commandsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-500/60 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-mono transition-colors disabled:opacity-50"
                  title="Reset all command templates to default definitions"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={loadCommands}
                  disabled={commandsLoading}
                  className="p-1.5 rounded-lg border border-carbon-700 hover:bg-carbon-800 text-carbon-400 hover:text-white transition-colors"
                  title="Refresh commands list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${commandsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Notification message */}
            {cmdMsg && (
              <div
                className={`p-3 rounded-lg text-xs font-mono flex items-center justify-between ${
                  cmdMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {cmdMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{cmdMsg.text}</span>
                </div>
                <button onClick={() => setCmdMsg(null)} className="text-carbon-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Search and Category Filters */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-carbon-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={commandSearch}
                  onChange={(e) => setCommandSearch(e.target.value)}
                  placeholder="Search commands, keys, descriptions, placeholders..."
                  className="w-full pl-9 pr-8 py-2 bg-black/60 border border-carbon-700 rounded-xl text-xs font-mono text-carbon-200 placeholder-carbon-500 focus:outline-none focus:border-dorito-500"
                />
                {commandSearch && (
                  <button
                    onClick={() => setCommandSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-carbon-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {commandCategories.map((cat) => {
                  const count =
                    cat === 'all'
                      ? commandsList.length
                      : commandsList.filter((c) => c.category.toLowerCase() === cat.toLowerCase()).length;
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-dorito-500/20 border-dorito-500 text-dorito-400 font-bold'
                          : 'bg-carbon-800/80 border-carbon-700/80 text-carbon-400 hover:text-white hover:border-carbon-600'
                      }`}
                    >
                      <span className="capitalize">{cat}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-dorito-500 text-carbon-950 font-bold' : 'bg-carbon-700 text-carbon-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Commands List */}
            {commandsLoading && commandsList.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-carbon-400 text-xs font-mono">
                <RefreshCw className="w-5 h-5 animate-spin text-dorito-500 mb-2" />
                <span>Loading command templates...</span>
              </div>
            ) : filteredCommands.length === 0 ? (
              <div className="text-center py-12 text-carbon-500 text-xs font-mono border border-dashed border-carbon-800 rounded-xl">
                No command templates match your query.
              </div>
            ) : (
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1.5 scrollbar-thin">
                {filteredCommands.map((cmd) => {
                  const isEditing = editingKey === cmd.key;
                  return (
                    <div
                      key={cmd.key}
                      className="p-3.5 rounded-xl bg-carbon-800/50 border border-carbon-700/80 hover:border-carbon-600 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-xs text-dorito-400">
                            {cmd.key}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-carbon-800 border border-carbon-700 text-carbon-300">
                            {cmd.category}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-carbon-900 border border-carbon-800 text-carbon-400">
                            {cmd.timeoutSeconds}s
                          </span>
                          {cmd.isCustom ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold">
                              CUSTOMIZED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-carbon-800/80 text-carbon-500">
                              DEFAULT
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyCommand(cmd.key, cmd.command)}
                            className="p-1.5 rounded-lg text-carbon-400 hover:text-white hover:bg-carbon-800 transition-colors"
                            title="Copy shell command"
                          >
                            {copiedCmdKey === cmd.key ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => handleStartEditCommand(cmd)}
                              className="p-1.5 rounded-lg text-carbon-400 hover:text-dorito-400 hover:bg-carbon-800 transition-colors"
                              title="Edit command template"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingKey(null)}
                              className="p-1.5 rounded-lg text-carbon-400 hover:text-white hover:bg-carbon-800 transition-colors"
                              title="Cancel editing"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2.5 mt-2 pt-2 border-t border-carbon-750">
                          <div>
                            <label className="block text-[11px] text-carbon-400 font-mono mb-1">
                              Shell Command Template (supports {'{placeholder}'} substitutions):
                            </label>
                            <textarea
                              rows={5}
                              value={editingCommand}
                              onChange={(e) => setEditingCommand(e.target.value)}
                              className="w-full bg-black/90 border border-carbon-700 rounded-lg p-2.5 font-mono text-xs text-dorito-300 focus:outline-none focus:border-dorito-500 leading-relaxed"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] text-carbon-400 font-mono mb-1">
                                Description:
                              </label>
                              <input
                                type="text"
                                value={editingDesc}
                                onChange={(e) => setEditingDesc(e.target.value)}
                                className="w-full bg-black/70 border border-carbon-700 rounded-lg px-2.5 py-1.5 text-xs text-carbon-200 focus:outline-none focus:border-dorito-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-carbon-400 font-mono mb-1">
                                Timeout (seconds):
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={600}
                                value={editingTimeout}
                                onChange={(e) => setEditingTimeout(parseInt(e.target.value) || 10)}
                                className="w-full bg-black/70 border border-carbon-700 rounded-lg px-2.5 py-1.5 text-xs text-carbon-200 focus:outline-none focus:border-dorito-500 font-mono"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingKey(null)}
                              className="px-3 py-1.5 rounded-lg border border-carbon-700 hover:bg-carbon-800 text-carbon-400 hover:text-white text-xs font-mono transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={cmdSaving}
                              onClick={() => handleSaveCommand(cmd.key)}
                              className="px-4 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-mono font-medium text-xs transition-colors disabled:opacity-50 shadow-md shadow-dorito-500/20"
                            >
                              {cmdSaving ? 'Saving...' : 'Save Override'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-[11px] text-carbon-400 mb-2 leading-relaxed font-sans">
                            {cmd.description}
                          </p>
                          <pre className="p-2.5 rounded-lg bg-black/80 border border-carbon-800 font-mono text-[11px] text-carbon-300 max-h-28 overflow-y-auto whitespace-pre-wrap select-all leading-relaxed">
                            {cmd.command}
                          </pre>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
