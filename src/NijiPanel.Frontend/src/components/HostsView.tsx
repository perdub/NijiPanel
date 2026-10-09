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
  AlertCircle,
  Zap,
  Gauge,
  TrendingUp,
  X,
  Play,
  LayoutList,
  LayoutGrid,
  Compass,
  Network
} from 'lucide-react';
import { Host, HostStats, HostMetricsHistory, BenchmarkResult, HostNetworkInfo } from '../types';
import { api } from '../api';
import { DoritoLogo } from './DoritoLogo';
import { SparklineChart } from './SparklineChart';
import { NetworkInspectorModal } from './NetworkInspectorModal';

interface HostsViewProps {
  hosts: Host[];
  onRefresh: () => void;
  onSelectHost: (hostId: string) => void;
  onOpenTab: (tab: string, hostId?: string) => void;
  masterPublicKey: string;
  onOpenOnboarding?: () => void;
}

// Module-level cache for instantaneous view switching (stale-while-revalidate)
const cachedStatsMap: Record<string, HostStats> = {};
const cachedMetricsMap: Record<string, HostMetricsHistory> = {};

export const HostsView: React.FC<HostsViewProps> = ({
  hosts,
  onRefresh,
  onSelectHost,
  onOpenTab,
  masterPublicKey,
  onOpenOnboarding,
}) => {
  const [statsMap, setStatsMap] = useState<Record<string, HostStats>>(() => ({ ...cachedStatsMap }));
  const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({});
  const [metricsMap, setMetricsMap] = useState<Record<string, HostMetricsHistory>>(() => ({ ...cachedMetricsMap }));
  const [benchmarkingHostId, setBenchmarkingHostId] = useState<string | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editHost, setEditHost] = useState<Host | null>(null);
  const [setupCommandModalOpen, setSetupCommandModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Form states
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState(22);
  const [formUsername, setFormUsername] = useState('root');
  const [formAuthType, setFormAuthType] = useState<'global_key' | 'key' | 'password'>('global_key');
  const [formCredential, setFormCredential] = useState('');
  const [formPassphrase, setFormPassphrase] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formHardening, setFormHardening] = useState(false);
  const [formBootstrap, setFormBootstrap] = useState(true);
  const [hardeningHostId, setHardeningHostId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Network Inspector states
  const [networkInspectorOpen, setNetworkInspectorOpen] = useState(false);
  const [networkInspectorHost, setNetworkInspectorHost] = useState<{ id?: string; name: string; host: string } | null>(null);
  const [formTestingNetwork, setFormTestingNetwork] = useState(false);
  const [formNetworkData, setFormNetworkData] = useState<HostNetworkInfo | null>(null);

  const handleInspectFormNetwork = async () => {
    if (!formHost.trim()) {
      alert('Please specify host IP or domain first.');
      return;
    }
    setFormTestingNetwork(true);
    try {
      const data = await api.hosts.inspectNetwork({
        host: formHost,
        port: formPort,
        username: formUsername,
        authType: formAuthType,
        credential: formCredential,
        passphrase: formPassphrase,
      });
      setFormNetworkData(data);
      setNetworkInspectorHost({ name: formName || formHost, host: formHost });
      setNetworkInspectorOpen(true);
    } catch (err: any) {
      alert(`Network inspection failed: ${err.message}`);
    } finally {
      setFormTestingNetwork(false);
    }
  };

  const handleRandomizePort = async (host: Host) => {
    if (!confirm(`Harden host '${host.name}' by changing SSH port ${host.port} to a random high port (20000-59000)?\n\nNijiPanel will test sshd syntax ('sshd -t'), open the new port in UFW/iptables, and reload SSH.`)) {
      return;
    }
    setHardeningHostId(host.id);
    try {
      const res = await api.hosts.randomizePort(host.id);
      if (res.success) {
        alert(`Port hardened successfully!\nOld Port: ${res.oldPort}\nNew Port: ${res.newPort}\n\n${res.message}`);
        onRefresh();
      } else {
        alert(`Hardening failed: ${res.message}\n${res.details || ''}`);
      }
    } catch (err: any) {
      alert(`Hardening failed: ${err.message}`);
    } finally {
      setHardeningHostId(null);
    }
  };

  const fetchHostStats = async (hostId: string) => {
    // Only show full loading spinner if we don't already have cached stats
    if (!cachedStatsMap[hostId]) {
      setLoadingStats((prev) => ({ ...prev, [hostId]: true }));
    }
    try {
      const [stats, history] = await Promise.all([
        api.hosts.stats(hostId),
        api.hosts.metricsHistory(hostId).catch(() => null),
      ]);
      cachedStatsMap[hostId] = stats;
      setStatsMap((prev) => ({ ...prev, [hostId]: stats }));
      if (history) {
        cachedMetricsMap[hostId] = history;
        setMetricsMap((prev) => ({ ...prev, [hostId]: history }));
      }
    } catch {
      if (!cachedStatsMap[hostId]) {
        setStatsMap((prev) => ({
          ...prev,
          [hostId]: { isOnline: false, error: 'Connection failed' }
        }));
      }
    } finally {
      setLoadingStats((prev) => ({ ...prev, [hostId]: false }));
    }
  };

  const handleRunBenchmark = async (host: Host) => {
    setBenchmarkingHostId(host.id);
    setBenchmarkError(null);
    try {
      const res = await api.hosts.benchmark(host.id);
      setBenchmarkResult(res);
    } catch (err: any) {
      setBenchmarkError(err.message || 'Benchmark execution failed');
    } finally {
      setBenchmarkingHostId(null);
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
    setFormHardening(false);
    setFormError(null);
    setAddModalOpen(true);
    api.settings.getBootstrapScript().then((res) => setFormBootstrap(res.enabled ?? true)).catch(() => {});
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
    setFormHardening(false);
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

        if (formHardening) {
          try {
            await api.hosts.randomizePort(editHost.id);
          } catch (hErr: any) {
            console.warn('Post-update hardening error', hErr);
          }
        }
      } else {
        const created = await api.hosts.create({
          name: formName,
          host: formHost,
          port: formPort,
          username: formUsername,
          authType: formAuthType,
          credential: formCredential,
          passphrase: formPassphrase,
          notes: formNotes,
          hardeningRandomPort: formHardening,
        } as any);

        if (formHardening && created?.id) {
          try {
            await api.hosts.randomizePort(created.id);
          } catch (hErr: any) {
            console.warn('Post-create hardening error', hErr);
          }
        }
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
            <h1 className="text-xl font-medium text-white tracking-tight">Hosts & Fleet</h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-carbon-800 text-carbon-300 border border-carbon-700">
              {hosts.length} nodes
            </span>
          </div>
          <p className="text-xs text-carbon-400 mt-1 font-mono">
            Agentless SSH infrastructure • Real-time resource metrics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-carbon-900 border border-carbon-800 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={'p-1.5 rounded text-xs transition-colors ' + (viewMode === 'table' ? 'bg-carbon-800 text-white' : 'text-carbon-400 hover:text-white')}
              title="Dense Fleet Table"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={'p-1.5 rounded text-xs transition-colors ' + (viewMode === 'grid' ? 'bg-carbon-800 text-white' : 'text-carbon-400 hover:text-white')}
              title="Metrics Grid Cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setSetupCommandModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-carbon-900 hover:bg-carbon-800 border border-carbon-800 text-xs font-mono font-medium text-dorito-400 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-dorito-500" />
            <span>Quick One-liner</span>
          </button>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-carbon-900 hover:bg-carbon-800 border border-carbon-800 text-xs font-mono font-medium text-carbon-300 transition-colors"
            title="Refresh all host metrics"
          >
            <RefreshCw className="w-3.5 h-3.5 text-carbon-400" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-dorito-500 hover:bg-dorito-600 text-black font-semibold text-xs transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
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
          <h3 className="text-lg font-medium text-white">No hosts connected in NijiPanel yet</h3>
          <p className="text-xs sm:text-sm text-carbon-400 max-w-md mx-auto mt-2 mb-6">
            Add your first server over pure SSH to inspect Docker containers, Compose stacks, files, and live shell in rhythmic harmony.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {onOpenOnboarding && (
              <button
                onClick={onOpenOnboarding}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-dorito-500/40 text-xs sm:text-sm font-mono font-medium text-dorito-400 transition-colors shadow-sm"
              >
                <Compass className="w-4 h-4 text-dorito-500" />
                <span>Launch Setup Wizard</span>
              </button>
            )}
            <button
              onClick={() => setSetupCommandModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-carbon-850 border border-carbon-700 text-xs sm:text-sm font-mono font-medium text-carbon-300 hover:text-white hover:bg-carbon-800 transition-colors"
            >
              Copy Setup Command
            </button>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-lg bg-dorito-500 text-carbon-950 font-medium text-xs sm:text-sm hover:bg-dorito-600 transition-colors shadow-md shadow-dorito-500/20"
            >
              Add Host
            </button>
          </div>
        </div>
      )}

            {/* Hosts View: Dense Table or Grid */}
      {viewMode === 'table' ? (
        <div className="rounded-lg border border-carbon-800 bg-[#0a0a0a] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#111111] border-b border-carbon-800 text-carbon-400 font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Status & Node</th>
                  <th className="py-2.5 px-3 font-medium">Endpoint</th>
                  <th className="py-2.5 px-3 font-medium">OS / Uptime</th>
                  <th className="py-2.5 px-3 font-medium">CPU</th>
                  <th className="py-2.5 px-3 font-medium">RAM</th>
                  <th className="py-2.5 px-3 font-medium">Disk</th>
                  <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-850/60 font-mono">
                {hosts.map((host) => {
                  const stats = statsMap[host.id];
                  const isLoading = loadingStats[host.id];
                  const isOnline = stats?.isOnline ?? false;

                  return (
                    <tr
                      key={host.id}
                      className="hover:bg-[#141414] transition-colors group cursor-pointer"
                      onClick={() => onSelectHost(host.id)}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={'w-2 h-2 rounded-full shrink-0 ' + (isOnline ? 'bg-emerald-500' : 'bg-rose-500')}
                          />
                          <span className="font-semibold text-white font-sans text-xs tracking-tight">
                            {host.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-carbon-300 text-[11px]">
                        {host.username}@{host.host}:{host.port}
                      </td>
                      <td className="py-2.5 px-3 text-carbon-400 text-[11px]">
                        <span>{stats?.osInfo || 'Linux'}</span>
                        {stats?.uptime && <span className="text-carbon-500 ml-1.5">• {stats.uptime}</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-carbon-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-dorito-500"
                              style={{ width: stats?.cpuUsage || '0%' }}
                            />
                          </div>
                          <span className="text-dorito-400 text-[11px] font-medium w-8">
                            {stats?.cpuUsage || '0%'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-carbon-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500"
                              style={{ width: `${Math.min(100, Math.max(0, stats?.memoryPercent ?? 0))}%` }}
                            />
                          </div>
                          <span className="text-amber-400 text-[11px] font-medium truncate max-w-[80px]">
                            {stats?.memoryUsage?.split('/')[0] || '0 GB'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-carbon-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500"
                              style={{ width: `${Math.min(100, Math.max(0, stats?.diskPercent ?? 0))}%` }}
                            />
                          </div>
                          <span className="text-orange-400 text-[11px] font-medium w-8">
                            {stats?.diskPercent ? `${stats.diskPercent}%` : '0%'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              onSelectHost(host.id);
                              onOpenTab('terminal', host.id);
                            }}
                            className="p-1 rounded text-carbon-400 hover:text-emerald-400 hover:bg-carbon-800"
                            title="Interactive SSH Terminal"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              onSelectHost(host.id);
                              onOpenTab('docker', host.id);
                            }}
                            className="p-1 rounded text-carbon-400 hover:text-dorito-400 hover:bg-carbon-800"
                            title="Docker Containers"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              onSelectHost(host.id);
                              onOpenTab('services', host.id);
                            }}
                            className="p-1 rounded text-carbon-400 hover:text-cyan-400 hover:bg-carbon-800"
                            title="Services & Systemd"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              onSelectHost(host.id);
                              onOpenTab('files', host.id);
                            }}
                            className="p-1 rounded text-carbon-400 hover:text-amber-400 hover:bg-carbon-800"
                            title="File Manager"
                          >
                            <FolderTree className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setFormNetworkData(null);
                              setNetworkInspectorHost({ id: host.id, name: host.name, host: host.host });
                              setNetworkInspectorOpen(true);
                            }}
                            className="p-1 rounded text-carbon-400 hover:text-cyan-400 hover:bg-carbon-800"
                            title="Inspect Network Topology & GeoIP"
                          >
                            <Network className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRandomizePort(host)}
                            disabled={hardeningHostId === host.id}
                            className="p-1 rounded text-carbon-400 hover:text-dorito-400 hover:bg-carbon-800 disabled:opacity-50"
                            title="Randomize SSH port"
                          >
                            <Shield className={'w-3.5 h-3.5 ' + (hardeningHostId === host.id ? 'animate-spin text-dorito-500' : '')} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(host)}
                            className="p-1 rounded text-carbon-400 hover:text-dorito-400 hover:bg-carbon-800"
                            title="Edit host parameters"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteHost(host)}
                            className="p-1 rounded text-carbon-400 hover:text-rose-400 hover:bg-carbon-800"
                            title="Delete host"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {hosts.map((host) => {
          const stats = statsMap[host.id];
          const isLoading = loadingStats[host.id];
          const isOnline = stats?.isOnline ?? false;

          return (
            <div
              key={host.id}
              className="rounded-lg bg-[#0d0d0d] border border-carbon-800 hover:border-carbon-700 p-4 shadow-sm transition-all flex flex-col justify-between relative"
            >


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
                      <h3 className="font-medium text-white text-base truncate tracking-tight">
                        {host.name}
                      </h3>
                      <span className="text-[10px] font-mono text-carbon-400 uppercase">{isOnline ? "Online" : "Offline"}</span>
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
                      onClick={() => {
                        setFormNetworkData(null);
                        setNetworkInspectorHost({ id: host.id, name: host.name, host: host.host });
                        setNetworkInspectorOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-carbon-400 hover:text-cyan-400 hover:bg-carbon-800 transition-colors"
                      title="Inspect Network Topology & GeoIP"
                    >
                      <Network className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRandomizePort(host)}
                      disabled={hardeningHostId === host.id}
                      className="p-1.5 rounded-lg text-carbon-400 hover:text-dorito-400 hover:bg-carbon-800 transition-colors disabled:opacity-50"
                      title="Hardening: Randomize SSH port (20000-59000)"
                    >
                      <Shield className={`w-3.5 h-3.5 ${hardeningHostId === host.id ? 'animate-spin text-dorito-500' : ''}`} />
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
                  <span className="px-2 py-0.5 rounded px-2 py-0.5 bg-carbon-900 border border-carbon-700 truncate max-w-[170px]">
                    {stats?.osInfo || 'Linux'}
                  </span>
                  {stats?.uptime && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded px-2 py-0.5 bg-carbon-900 border border-carbon-700">
                      <Clock className="w-2.5 h-2.5 text-carbon-400" />
                      {stats.uptime}
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded bg-carbon-900 border border-carbon-800 text-carbon-400 uppercase">
                    {host.authType === 'global_key' ? 'Master Key' : host.authType === 'key' ? 'Custom Key' : 'Password'}
                  </span>
                </div>

                {/* Live Dashboards: Beszel-Style Gauges & Sparkline Area Charts */}
                {(() => {
                  const metrics = metricsMap[host.id];
                  const cpuHistory = metrics?.history?.map((h) => h.cpuPercent) || [];
                  const ramHistory = metrics?.history?.map((h) => h.ramPercent) || [];
                  const rxHistory = metrics?.history?.map((h) => h.netRxKbps) || [];
                  const txHistory = metrics?.history?.map((h) => h.netTxKbps) || [];
                  const prediction = metrics?.prediction;

                  return (
                    <div className="space-y-3 py-3 border-y border-carbon-700/80 mb-3.5">
                      {/* CPU Metric & Sparkline */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-carbon-400 flex items-center gap-1.5 font-mono text-[11px]">
                            <Cpu className="w-3.5 h-3.5 text-dorito-500" /> CPU
                          </span>
                          <span className="font-mono text-dorito-400 font-semibold text-xs">
                            {stats?.cpuUsage || '0%'}
                          </span>
                        </div>
                        <SparklineChart
                          data={cpuHistory}
                          color="#ffd100"
                          height={32}
                          minVal={0}
                          maxVal={100}
                          unit="%"
                        />
                      </div>

                      {/* RAM Metric & Sparkline */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-carbon-400 flex items-center gap-1.5 font-mono text-[11px]">
                            <Activity className="w-3.5 h-3.5 text-dorito-600" /> RAM
                          </span>
                          <span className="font-mono text-amber-400 font-semibold text-xs">
                            {stats?.memoryUsage || '0 GB'}
                          </span>
                        </div>
                        <SparklineChart
                          data={ramHistory}
                          color="#f59e0b"
                          height={32}
                          minVal={0}
                          maxVal={100}
                          unit="%"
                        />
                      </div>

                      {/* Disk Metric & Predictive Fill Plate */}
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

                        {/* Beszel-Style Disk Fill Prediction Plate */}
                        <div
                          className={`mt-2 px-2.5 py-1 rounded text-[10px] font-mono border flex items-center justify-between transition-colors ${
                            prediction?.isStable
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <TrendingUp className="w-3 h-3" />
                            Disk Fill Prediction:
                          </span>
                          <span className="font-bold">
                            {prediction?.formattedPrediction || 'Disk stable'}
                          </span>
                        </div>
                      </div>

                      {/* Network Dual Sparkline (RX Cyan / TX Emerald) */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-carbon-400 flex items-center gap-1.5 font-mono text-[11px]">
                            <Wifi className="w-3.5 h-3.5 text-cyan-400" /> Network I/O
                          </span>
                          <span className="font-mono text-carbon-400 text-[10px]">
                            LA: <span className="text-carbon-200">{stats?.loadAverage || '0.00'}</span>
                          </span>
                        </div>
                        <SparklineChart
                          data={rxHistory}
                          secondaryData={txHistory}
                          color="#06b6d4"
                          secondaryColor="#10b981"
                          height={30}
                          unit=" KB/s"
                        />
                        <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-carbon-400">
                          <span className="truncate text-carbon-300">
                            {stats?.networkUsage || 'RX: 0 GB | TX: 0 GB'}
                          </span>
                          <span className="text-carbon-500">RX cyan / TX emerald</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Navigation Action Buttons: Carbon Style */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1 font-mono">
                <button
                  onClick={() => {
                    onSelectHost(host.id);
                    onOpenTab('services', host.id);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                  title="Systemd, Users & OS Updates"
                >
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Services</span>
                </button>

                <button
                  onClick={() => {
                    onSelectHost(host.id);
                    onOpenTab('docker', host.id);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-dorito-400 hover:border-dorito-500/40 transition-colors"
                  title="Docker Containers"
                >
                  <Layers className="w-3.5 h-3.5 text-dorito-500" />
                  <span>Docker</span>
                </button>

                <button
                  onClick={() => {
                    onSelectHost(host.id);
                    onOpenTab('files', host.id);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
                  title="File Manager"
                >
                  <FolderTree className="w-3.5 h-3.5 text-amber-500" />
                  <span>Files</span>
                </button>

                <button
                  onClick={() => {
                    onSelectHost(host.id);
                    onOpenTab('terminal', host.id);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
                  title="SSH Interactive Terminal"
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SSH</span>
                </button>

                <button
                  onClick={() => {
                    setFormNetworkData(null);
                    setNetworkInspectorHost({ id: host.id, name: host.name, host: host.host });
                    setNetworkInspectorOpen(true);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                  title="Network Topology & GeoIP Inspector"
                >
                  <Network className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Net</span>
                </button>

                <button
                  onClick={() => handleRunBenchmark(host)}
                  disabled={benchmarkingHostId === host.id}
                  className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-dorito-400 hover:border-dorito-500/40 transition-colors disabled:opacity-50"
                  title="Run Fast Hardware Benchmark"
                >
                  {benchmarkingHostId === host.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-dorito-500" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 text-dorito-500" />
                  )}
                  <span>{benchmarkingHostId === host.id ? 'Testing' : 'Bench'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Add / Edit Host Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-medium text-white mb-1 font-sans">
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

              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl bg-carbon-850 border border-carbon-700/80 hover:border-dorito-500/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={formHardening}
                    onChange={(e) => setFormHardening(e.target.checked)}
                    className="w-4 h-4 rounded bg-carbon-800 border-carbon-700 text-dorito-500 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs text-white font-mono font-medium block">
                      Hardening: Auto-switch SSH port to random high port (20000-59000)
                    </span>
                    <span className="text-[10px] text-carbon-400 font-mono block">
                      Tests config with sshd -t, opens port in UFW/iptables, and restarts sshd.
                    </span>
                  </div>
                </label>
              </div>

              {!editHost && (
                <div className="pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl bg-carbon-850 border border-carbon-700/80 hover:border-dorito-500/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={formBootstrap}
                      onChange={(e) => setFormBootstrap(e.target.checked)}
                      className="w-4 h-4 rounded bg-carbon-800 border-carbon-700 text-dorito-500 focus:ring-0"
                    />
                    <div>
                      <span className="text-xs text-white font-mono font-medium block">
                        Auto-Provision: Install initial software stack (Docker, Neofetch, etc.)
                      </span>
                      <span className="text-[10px] text-carbon-400 font-mono block">
                        Executes configured global bootstrap script via SSH in background upon host creation.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleInspectFormNetwork}
                  disabled={formTestingNetwork || !formHost}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-carbon-850 hover:bg-carbon-800 text-cyan-400 border border-carbon-700 text-xs font-mono transition-colors disabled:opacity-50"
                  title="Probe network interfaces and GeoIP before saving"
                >
                  <Network className={`w-3.5 h-3.5 ${formTestingNetwork ? 'animate-spin' : ''}`} />
                  <span>{formTestingNetwork ? 'Probing...' : 'Test Network & GeoIP'}</span>
                </button>

                <div className="flex items-center gap-2">
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
                    className="px-5 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-medium text-sm transition-colors disabled:opacity-50 shadow-md shadow-dorito-500/20"
                  >
                    {submitting ? 'Saving...' : editHost ? 'Save Changes' : 'Add Host'}
                  </button>
                </div>
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
                <h3 className="text-lg font-medium text-white">1-Click Server Setup Command</h3>
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
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-medium text-xs shadow-md shadow-dorito-500/20 transition-all font-mono"
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

      {/* Benchmark Results Scorecard Modal */}
      {benchmarkResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
            {/* Top Accent Strip */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-dorito-500 via-amber-500 to-emerald-500"></div>

            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-dorito-500/10 border border-dorito-500/30 text-dorito-400">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-medium text-white tracking-tight">
                    Hardware Benchmark Scorecard
                  </h3>
                  <p className="text-xs font-mono text-carbon-400">
                    Host: <span className="text-dorito-400 font-semibold">{benchmarkResult.hostName}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setBenchmarkResult(null)}
                className="p-1 rounded-lg text-carbon-400 hover:text-white hover:bg-carbon-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Score Ring / Health Hero Card */}
            <div className="p-4 rounded-xl bg-carbon-850 border border-carbon-700 mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-carbon-400 uppercase tracking-wider">Overall Health Score</span>
                <div className="text-2xl font-medium text-white mt-0.5 tracking-tight flex items-baseline gap-1 font-mono">
                  <span className={benchmarkResult.score >= 70 ? 'text-emerald-400' : 'text-amber-400'}>
                    {benchmarkResult.score}
                  </span>
                  <span className="text-sm text-carbon-500 font-normal">/ 100</span>
                </div>
                <p className="text-[11px] font-mono text-carbon-400 mt-1">
                  {benchmarkResult.score >= 80 ? '⚡ High-performance compute node' : benchmarkResult.score >= 50 ? '✓ Balanced standard server' : '⚠ Limited resource performance'}
                </p>
              </div>

              <div className="w-16 h-16 rounded-full bg-carbon-800 border-2 border-dorito-500/40 flex items-center justify-center text-dorito-400 ">
                <Gauge className="w-8 h-8 text-dorito-500" />
              </div>
            </div>

            {/* Benchmark Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 mb-4 font-mono">
              <div className="p-3 rounded-xl bg-carbon-850/70 border border-carbon-700">
                <div className="flex items-center gap-1.5 text-carbon-400 text-[10px] uppercase mb-1">
                  <HardDrive className="w-3 h-3 text-amber-500" /> Disk I/O
                </div>
                <div className="text-sm font-medium text-white truncate">
                  {benchmarkResult.diskWriteFormatted}
                </div>
                <span className="text-[9px] text-carbon-500">256MB direct</span>
              </div>

              <div className="p-3 rounded-xl bg-carbon-850/70 border border-carbon-700">
                <div className="flex items-center gap-1.5 text-carbon-400 text-[10px] uppercase mb-1">
                  <Cpu className="w-3 h-3 text-dorito-500" /> CPU Hash
                </div>
                <div className="text-sm font-medium text-white truncate">
                  {benchmarkResult.cpuFormatted}
                </div>
                <span className="text-[9px] text-carbon-500">{benchmarkResult.cpuSha256Ops.toLocaleString()} ops</span>
              </div>

              <div className="p-3 rounded-xl bg-carbon-850/70 border border-carbon-700">
                <div className="flex items-center gap-1.5 text-carbon-400 text-[10px] uppercase mb-1">
                  <Wifi className="w-3 h-3 text-cyan-400" /> Latency
                </div>
                <div className="text-sm font-medium text-white truncate">
                  {benchmarkResult.pingFormatted}
                </div>
                <span className="text-[9px] text-carbon-500">Gateway ping</span>
              </div>
            </div>

            {/* Auto-cleanup notification message */}
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400 flex items-center gap-2 mb-4">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Safe execution: All temporary files (/tmp/nijibench_*) were automatically purged.</span>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setBenchmarkResult(null)}
                className="px-4 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-medium text-xs font-mono transition-colors shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Benchmark Error Modal */}
      {benchmarkError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-carbon-900 border border-rose-500/40 rounded-2xl shadow-2xl p-6 relative">
            <div className="flex items-center gap-2.5 text-rose-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-medium text-white">Benchmark Failed</h3>
            </div>
            <p className="text-xs font-mono text-carbon-300 mb-4">{benchmarkError}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setBenchmarkError(null)}
                className="px-4 py-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-carbon-200 text-xs font-mono transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Network & GeoIP Inspector Modal */}
      <NetworkInspectorModal
        isOpen={networkInspectorOpen}
        onClose={() => setNetworkInspectorOpen(false)}
        hostId={networkInspectorHost?.id}
        hostName={networkInspectorHost?.name}
        hostAddress={networkInspectorHost?.host}
        initialNetworkInfo={formNetworkData}
      />
    </div>
  );
};
