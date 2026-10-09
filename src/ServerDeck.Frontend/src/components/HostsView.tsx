import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  Terminal,
  Layers,
  FolderTree,
  Cpu,
  HardDrive,
  Activity,
  Wifi,
  Copy,
  Check,
  Trash2,
  Edit,
  Shield,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Host, HostStats } from '../types';
import { api } from '../api';
import { DoritoLogo } from './DoritoLogo';

interface HostsViewProps {
  hosts: Host[];
  onRefresh: () => void;
  onSelectHost: (hostId: string) => void;
  onOpenTab: (tab: string, hostId?: string) => void;
  masterPublicKey: string;
}

export const HostsView: React.FC<HostsViewProps> = ({
  hosts,
  onRefresh,
  onSelectHost,
  onOpenTab,
  masterPublicKey
}) => {
  const [statsMap, setStatsMap] = useState<Record<string, HostStats>>({});
  const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({});
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editHost, setEditHost] = useState<Host | null>(null);
  const [setupCommandModalOpen, setSetupCommandModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState(22);
  const [formUsername, setFormUsername] = useState('root');
  const [formAuthType, setFormAuthType] = useState<'global_key' | 'key' | 'password'>('global_key');
  const [formCredential, setFormCredential] = useState('');
  const [formPassphrase, setFormPassphrase] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchHostStats = async (hostId: string) => {
    setLoadingStats((prev) => ({ ...prev, [hostId]: true }));
    try {
      const stats = await api.hosts.stats(hostId);
      setStatsMap((prev) => ({ ...prev, [hostId]: stats }));
    } catch {
      setStatsMap((prev) => ({
        ...prev,
        [hostId]: { isOnline: false, error: 'Connection failed' }
      }));
    } finally {
      setLoadingStats((prev) => ({ ...prev, [hostId]: false }));
    }
  };

  useEffect(() => {
    hosts.forEach((h) => {
      fetchHostStats(h.id);
    });
  }, [hosts]);

  const handleOpenAdd = () => {
    setEditHost(null);
    setFormName('');
    setFormHost('');
    setFormPort(22);
    setFormUsername('root');
    setFormAuthType('global_key');
    setFormCredential('');
    setFormPassphrase('');
    setFormNotes('');
    setFormError(null);
    setAddModalOpen(true);
  };

  const handleOpenEdit = (h: Host) => {
    setEditHost(h);
    setFormName(h.name);
    setFormHost(h.host);
    setFormPort(h.port);
    setFormUsername(h.username);
    setFormAuthType(h.authType);
    setFormCredential('');
    setFormPassphrase('');
    setFormNotes(h.notes || '');
    setFormError(null);
    setAddModalOpen(true);
  };

  const handleDeleteHost = async (h: Host) => {
    if (!confirm(`Remove host "${h.name}" from NijiPanel?`)) return;
    try {
      await api.hosts.delete(h.id);
      onRefresh();
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formName.trim() || !formHost.trim()) {
      setFormError('Please enter host name and IP address or domain');
      return;
    }

    setSubmitting(true);
    try {
      if (editHost) {
        await api.hosts.update(editHost.id, {
          name: formName,
          host: formHost,
          port: formPort,
          username: formUsername,
          authType: formAuthType,
          credential: formCredential || undefined,
          passphrase: formPassphrase || undefined,
          notes: formNotes,
        });
      } else {
        await api.hosts.create({
          name: formName,
          host: formHost,
          port: formPort,
          username: formUsername,
          authType: formAuthType,
          credential: formCredential,
          passphrase: formPassphrase,
          notes: formNotes,
        });
      }
      setAddModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Error saving host');
    } finally {
      setSubmitting(false);
    }
  };

  const oneLinerCommand = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${masterPublicKey.trim()}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'NijiPanel key installed successfully!'`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-carbon-700/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Hosts</h1>
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-none sm:rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-bold">
              Kessoku Fleet ({hosts.length})
            </span>
          </div>
          <p className="text-xs text-carbon-400 mt-1 font-mono">
            Agentless SSH monitoring and orchestration • Drummer rhythm engine
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSetupCommandModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-mono font-medium text-dorito-400 transition-colors shadow-sm"
          >
            <Shield className="w-3.5 h-3.5 text-dorito-500" />
            <span>Quick One-liner</span>
          </button>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-mono font-medium text-carbon-300 transition-colors"
            title="Refresh all host metrics"
          >
            <RefreshCw className="w-3.5 h-3.5 text-carbon-400" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs sm:text-sm shadow-md shadow-dorito-500/20 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Host</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {hosts.length === 0 && (
        <div className="rounded-xl border border-dashed border-carbon-700 bg-carbon-900/60 p-12 text-center">
          <div className="mb-4 inline-block">
            <DoritoLogo size={64} className="mx-auto drop-shadow-[0_4px_16px_rgba(255,209,0,0.3)]" />
          </div>
          <h3 className="text-lg font-bold text-white">No hosts connected in NijiPanel yet</h3>
          <p className="text-xs sm:text-sm text-carbon-400 max-w-md mx-auto mt-2 mb-6">
            Add your first server over pure SSH to inspect Docker containers, Compose stacks, files, and live shell in rhythmic harmony.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setSetupCommandModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-carbon-850 border border-carbon-700 text-xs sm:text-sm font-mono font-medium text-dorito-400 hover:bg-carbon-800 transition-colors"
            >
              Copy Setup Command
            </button>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-lg bg-dorito-500 text-carbon-950 font-bold text-xs sm:text-sm hover:bg-dorito-600 transition-colors shadow-md shadow-dorito-500/20"
            >
              Add Host
            </button>
          </div>
        </div>
      )}

      {/* Hosts Cards Grid: IBM Carbon Design System */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {hosts.map((host) => {
          const stats = statsMap[host.id];
          const isLoading = loadingStats[host.id];
          const isOnline = stats?.isOnline ?? false;

          return (
            <div
              key={host.id}
              className="group rounded-xl bg-carbon-900 border border-carbon-700 hover:border-dorito-500/60 p-4 sm:p-5 shadow-lg transition-all flex flex-col justify-between relative overflow-hidden"
            >
              {/* Top Accent Strip on hover */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-dorito-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

              <div>
                {/* Header: Name, Status & Carbon Badges */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                        }`}
                      />
                      <h3 className="font-bold text-white text-base truncate tracking-tight">
                        {host.name}
                      </h3>
                      <span
                        className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded-none border ${
                          isOnline
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                      >
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                    <p className="text-xs text-carbon-400 mt-1 font-mono truncate">
                      {host.username}@{host.host}:{host.port}
                    </p>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 shrink-0">
                    <button
                      onClick={() => fetchHostStats(host.id)}
                      disabled={isLoading}
                      className="p-1.5 rounded-lg text-carbon-400 hover:text-white hover:bg-carbon-800 transition-colors"
                      title="Refresh status"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-dorito-500' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(host)}
                      className="p-1.5 rounded-lg text-carbon-400 hover:text-dorito-400 hover:bg-carbon-800 transition-colors"
                      title="Edit host parameters"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteHost(host)}
                      className="p-1.5 rounded-lg text-carbon-400 hover:text-rose-400 hover:bg-carbon-800 transition-colors"
                      title="Delete host"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Carbon Status Tags: OS, Uptime, Auth */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3.5 text-[10px] font-mono text-carbon-300">
                  <span className="px-2 py-0.5 rounded-none bg-carbon-850 border border-carbon-700 truncate max-w-[170px]">
                    {stats?.osInfo || 'Linux'}
                  </span>
                  {stats?.uptime && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-carbon-850 border border-carbon-700">
                      <Clock className="w-2.5 h-2.5 text-carbon-400" />
                      {stats.uptime}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-none bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-semibold uppercase">
                    {host.authType === 'global_key' ? 'Master Key' : host.authType === 'key' ? 'Custom Key' : 'Password'}
                  </span>
                </div>

                {/* Live Dashboards: Nijika Dorito Yellow & Warm Amber Gauges */}
                <div className="space-y-2.5 py-3 border-y border-carbon-700/80 mb-3.5">
                  {/* CPU Gauge (Signature Dorito Yellow) */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-carbon-400 flex items-center gap-1.5 font-mono text-[11px]">
                        <Cpu className="w-3.5 h-3.5 text-dorito-500" /> CPU
                      </span>
                      <span className="font-mono text-dorito-400 font-semibold text-xs">
                        {stats?.cpuUsage || '0%'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-carbon-800 rounded-none overflow-hidden border border-carbon-700/50">
                      <div
                        className="h-full bg-dorito-500 transition-all duration-500 shadow-[0_0_8px_rgba(255,209,0,0.5)]"
                        style={{ width: `${Math.min(100, Math.max(0, stats?.cpuPercent ?? 5))}%` }}
                      />
                    </div>
                  </div>

                  {/* RAM Gauge (Warm Amber) */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-carbon-400 flex items-center gap-1.5 font-mono text-[11px]">
                        <Activity className="w-3.5 h-3.5 text-dorito-600" /> RAM
                      </span>
                      <span className="font-mono text-amber-400 font-semibold text-xs">
                        {stats?.memoryUsage || '0 GB'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-carbon-800 rounded-none overflow-hidden border border-carbon-700/50">
                      <div
                        className="h-full bg-dorito-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, stats?.memoryPercent ?? 10))}%` }}
                      />
                    </div>
                  </div>

                  {/* Disk Gauge (Dorito Spice Orange) */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-carbon-400 flex items-center gap-1.5 font-mono text-[11px]">
                        <HardDrive className="w-3.5 h-3.5 text-amber-500" /> Disk (/)
                      </span>
                      <span className="font-mono text-orange-400 font-semibold text-xs">
                        {stats?.diskUsage || '0 GB'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-carbon-800 rounded-none overflow-hidden border border-carbon-700/50">
                      <div
                        className="h-full bg-amber-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, stats?.diskPercent ?? 15))}%` }}
                      />
                    </div>
                  </div>

                  {/* Network Bandwidth & Load Average */}
                  <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-carbon-400">
                    <span className="flex items-center gap-1 truncate text-carbon-300">
                      <Wifi className="w-3 h-3 text-dorito-400" />
                      {stats?.networkUsage || 'RX: 0 GB | TX: 0 GB'}
                    </span>
                    <span className="font-mono text-carbon-400 text-[10px]">
                      LA: <span className="text-carbon-200">{stats?.loadAverage || '0.00'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation Action Buttons: Carbon Style */}
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
                <button
                  onClick={() => {
                    onSelectHost(host.id);
                    onOpenTab('docker', host.id);
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-dorito-400 hover:border-dorito-500/40 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-dorito-500" />
                  <span>Docker</span>
                </button>

                <button
                  onClick={() => {
                    onSelectHost(host.id);
                    onOpenTab('files', host.id);
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
                >
                  <FolderTree className="w-3.5 h-3.5 text-amber-500" />
                  <span>Files</span>
                </button>

                <button
                  onClick={() => {
                    onSelectHost(host.id);
                    onOpenTab('terminal', host.id);
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SSH</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Host Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-1 font-sans">
              {editHost ? 'Edit Host' : 'Add Host to NijiPanel'}
            </h3>
            <p className="text-xs text-carbon-400 mb-5 font-mono">
              Direct connection via SSH without agent installation.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-carbon-300 mb-1">Host Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Production VPS / Home Server"
                  required
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 focus:ring-1 focus:ring-dorito-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-mono text-carbon-300 mb-1">IP Address or Domain</label>
                  <input
                    type="text"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    placeholder="192.168.1.100 or example.com"
                    required
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 focus:ring-1 focus:ring-dorito-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-carbon-300 mb-1">SSH Port</label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(parseInt(e.target.value) || 22)}
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-carbon-300 mb-1">Username</label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="root"
                  required
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-carbon-300 mb-1">Authentication Method</label>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <button
                    type="button"
                    onClick={() => setFormAuthType('global_key')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                      formAuthType === 'global_key'
                        ? 'bg-dorito-500/15 border-dorito-500 text-dorito-400 font-bold'
                        : 'bg-carbon-850 border-carbon-700 text-carbon-400 hover:text-white'
                    }`}
                  >
                    Master Key
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAuthType('key')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                      formAuthType === 'key'
                        ? 'bg-dorito-500/15 border-dorito-500 text-dorito-400 font-bold'
                        : 'bg-carbon-850 border-carbon-700 text-carbon-400 hover:text-white'
                    }`}
                  >
                    Custom Key
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAuthType('password')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                      formAuthType === 'password'
                        ? 'bg-dorito-500/15 border-dorito-500 text-dorito-400 font-bold'
                        : 'bg-carbon-850 border-carbon-700 text-carbon-400 hover:text-white'
                    }`}
                  >
                    Password
                  </button>
                </div>
              </div>

              {formAuthType === 'password' && (
                <div>
                  <label className="block text-xs font-mono text-carbon-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={formCredential}
                    onChange={(e) => setFormCredential(e.target.value)}
                    placeholder={editHost ? 'Leave empty to keep current password' : 'Password'}
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  />
                </div>
              )}

              {formAuthType === 'key' && (
                <div className="space-y-3 font-mono">
                  <div>
                    <label className="block text-xs text-carbon-300 mb-1">Private Key (OpenSSH / PEM)</label>
                    <textarea
                      rows={4}
                      value={formCredential}
                      onChange={(e) => setFormCredential(e.target.value)}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                      className="w-full bg-carbon-850 border border-carbon-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-dorito-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-carbon-300 mb-1">Key Passphrase</label>
                    <input
                      type="password"
                      value={formPassphrase}
                      onChange={(e) => setFormPassphrase(e.target.value)}
                      placeholder="Leave empty if key is unencrypted"
                      className="w-full bg-carbon-850 border border-carbon-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                    />
                  </div>
                </div>
              )}

              {formAuthType === 'global_key' && (
                <div className="p-3 rounded-xl bg-dorito-500/10 border border-dorito-500/30 text-xs text-dorito-300 font-mono">
                  NijiPanel global master key will be used. Make sure the public key is present in <code>~/.ssh/authorized_keys</code> on the target server.
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-carbon-300 mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Primary web server, database, etc."
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-carbon-850 text-carbon-300 hover:bg-carbon-800 text-sm font-medium transition-colors font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-sm transition-colors disabled:opacity-50 shadow-md shadow-dorito-500/20"
                >
                  {submitting ? 'Saving...' : editHost ? 'Save Changes' : 'Add Host'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Liner Setup Command Modal */}
      {setupCommandModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-dorito-500/20 border border-dorito-500/30 flex items-center justify-center text-dorito-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">1-Click Server Setup Command</h3>
                <p className="text-xs text-carbon-400 font-mono">
                  Execute this command on your server to authorize NijiPanel with your master key
                </p>
              </div>
            </div>

            <div className="relative mb-4">
              <pre className="p-4 rounded-xl bg-black/80 border border-carbon-700 text-xs font-mono text-dorito-400 overflow-x-auto whitespace-pre-wrap break-all select-all">
                {oneLinerCommand}
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <p className="text-[11px] text-carbon-400 font-mono">
                Creates <code>~/.ssh</code>, sets safe permissions <code>700/600</code>, and appends the master key.
              </p>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => copyToClipboard(oneLinerCommand)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shadow-md shadow-dorito-500/20 transition-all font-mono"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-800" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy Command'}</span>
                </button>
                <button
                  onClick={() => setSetupCommandModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-carbon-850 hover:bg-carbon-800 text-carbon-300 text-xs font-medium transition-colors font-mono"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
