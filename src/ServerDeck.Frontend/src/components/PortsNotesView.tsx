import React, { useState, useEffect } from 'react';
import {
  Network,
  StickyNote,
  Plus,
  Trash2,
  Save,
  Play,
  Square,
  Check,
  ShieldAlert,
  Terminal,
  Radio,
  Copy,
  Search,
  RefreshCw,
  X,
  ExternalLink
} from 'lucide-react';
import { Host, HostPort, SshTunnel, LiveSocket } from '../types';
import { api } from '../api';

interface PortsNotesViewProps {
  selectedHost: Host | null;
}

export const PortsNotesView: React.FC<PortsNotesViewProps> = ({ selectedHost }) => {
  const [viewMode, setViewMode] = useState<'registry' | 'live'>('registry');

  // Registry & Notes states
  const [ports, setPorts] = useState<HostPort[]>([]);
  const [noteTitle, setNoteTitle] = useState('Server Notes');
  const [noteContent, setNoteContent] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [tunnels, setTunnels] = useState<SshTunnel[]>([]);

  // Live Sockets states
  const [liveSockets, setLiveSockets] = useState<LiveSocket[]>([]);
  const [loadingSockets, setLoadingSockets] = useState(false);
  const [socketsError, setSocketsError] = useState<string | null>(null);
  const [socketSearch, setSocketSearch] = useState('');
  const [socketProtoFilter, setSocketProtoFilter] = useState<'all' | 'tcp' | 'udp'>('all');

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add Port form
  const [addPortModal, setAddPortModal] = useState(false);
  const [newPort, setNewPort] = useState(8080);
  const [newProto, setNewProto] = useState('tcp');
  const [newService, setNewService] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Add Tunnel form
  const [addTunnelModal, setAddTunnelModal] = useState(false);
  const [tunnelName, setTunnelName] = useState('');
  const [localPort, setLocalPort] = useState(8080);
  const [remoteHost, setRemoteHost] = useState('127.0.0.1');
  const [remotePort, setRemotePort] = useState(8080);

  const loadData = async () => {
    if (!selectedHost) return;
    try {
      const [portsData, noteData, tunnelsData] = await Promise.all([
        api.extras.ports(selectedHost.id),
        api.extras.note(selectedHost.id),
        api.extras.tunnels(selectedHost.id),
      ]);
      setPorts(portsData);
      setNoteTitle(noteData.title || 'Server Notes');
      setNoteContent(noteData.content || '');
      setTunnels(tunnelsData);
    } catch (err) {
      console.error(err);
    }
  };

  const loadLiveSockets = async () => {
    if (!selectedHost) return;
    setLoadingSockets(true);
    setSocketsError(null);
    try {
      const data = await api.extras.liveSockets(selectedHost.id);
      setLiveSockets(data);
    } catch (err: any) {
      setSocketsError(err.message || 'Failed to fetch live sockets via ss -tulpn');
    } finally {
      setLoadingSockets(false);
    }
  };

  useEffect(() => {
    loadData();
    if (viewMode === 'live') {
      loadLiveSockets();
    }
  }, [selectedHost?.id, viewMode]);

  const handleCopyCommand = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddPort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || !newService.trim()) return;

    try {
      await api.extras.addPort(selectedHost.id, {
        port: newPort,
        protocol: newProto,
        serviceName: newService.trim(),
        description: newDesc.trim() || undefined,
      });
      setAddPortModal(false);
      setNewService('');
      setNewDesc('');
      loadData();
    } catch (err: any) {
      alert(`Failed to add port: ${err.message}`);
    }
  };

  const handleDeletePort = async (portId: string) => {
    if (!selectedHost) return;
    try {
      await api.extras.deletePort(selectedHost.id, portId);
      loadData();
    } catch (err: any) {
      alert(`Failed to delete port: ${err.message}`);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedHost) return;
    try {
      await api.extras.saveNote(selectedHost.id, {
        title: noteTitle,
        content: noteContent,
      });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch (err: any) {
      alert(`Failed to save notes: ${err.message}`);
    }
  };

  const handleAddTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || !tunnelName.trim()) return;

    try {
      await api.extras.createTunnel(selectedHost.id, {
        name: tunnelName.trim(),
        localPort,
        remoteHost: remoteHost.trim(),
        remotePort,
      });
      setAddTunnelModal(false);
      setTunnelName('');
      loadData();
    } catch (err: any) {
      alert(`Failed to create tunnel: ${err.message}`);
    }
  };

  const handleToggleTunnel = async (t: SshTunnel) => {
    if (!selectedHost) return;
    try {
      if (t.isActive) {
        await api.extras.stopTunnel(selectedHost.id, t.id);
      } else {
        await api.extras.startTunnel(selectedHost.id, t.id);
      }
      loadData();
    } catch (err: any) {
      alert(`Failed to toggle tunnel: ${err.message}`);
    }
  };

  const handleDeleteTunnel = async (tunnelId: string) => {
    if (!selectedHost) return;
    if (!confirm('Delete SSH tunnel?')) return;
    try {
      await api.extras.deleteTunnel(selectedHost.id, tunnelId);
      loadData();
    } catch (err: any) {
      alert(`Failed to delete tunnel: ${err.message}`);
    }
  };

  // Helper to open Add Port from Live Socket
  const handleQuickRegisterSocket = (s: LiveSocket) => {
    setNewPort(s.port);
    setNewProto(s.protocol.toLowerCase());
    setNewService(s.processName || `Service :${s.port}`);
    setNewDesc(`Detected listening on ${s.localAddress} (PID ${s.pid || 'N/A'})`);
    setAddPortModal(true);
  };

  // Helper to open Add Tunnel from Live Socket
  const handleQuickTunnelSocket = (s: LiveSocket) => {
    setTunnelName(`${s.processName || 'Port'}-${s.port}`);
    setLocalPort(s.port);
    setRemoteHost('127.0.0.1');
    setRemotePort(s.port);
    setAddTunnelModal(true);
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-carbon-400 font-mono">
        Select a host from the top navigation to view port registry and notes
      </div>
    );
  }

  // Filtered live sockets
  const filteredSockets = liveSockets.filter((s) => {
    const matchesSearch =
      s.port.toString().includes(socketSearch) ||
      s.localAddress.toLowerCase().includes(socketSearch.toLowerCase()) ||
      (s.processName && s.processName.toLowerCase().includes(socketSearch.toLowerCase())) ||
      (s.pid && s.pid.toString().includes(socketSearch));
    if (!matchesSearch) return false;

    if (socketProtoFilter === 'tcp') return s.protocol.toLowerCase() === 'tcp';
    if (socketProtoFilter === 'udp') return s.protocol.toLowerCase() === 'udp';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="border-b border-carbon-700/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Port Registry & Live Sockets</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-semibold">
              SSH TUNNEL CLI GENERATOR
            </span>
          </div>
          <p className="text-xs sm:text-sm text-carbon-400 mt-1 font-mono">
            Network port registry, live `ss -tulpn` socket inspector, and 1-click CLI tunnel generator for {selectedHost.name}
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-carbon-900 border border-carbon-750 p-1 rounded-xl self-start sm:self-auto font-mono text-xs">
          <button
            onClick={() => setViewMode('registry')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'registry'
                ? 'bg-dorito-500 text-carbon-950 font-bold shadow-sm'
                : 'text-carbon-300 hover:text-white hover:bg-carbon-800'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Registry & Notes</span>
          </button>

          <button
            onClick={() => setViewMode('live')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'live'
                ? 'bg-dorito-500 text-carbon-950 font-bold shadow-sm'
                : 'text-carbon-300 hover:text-white hover:bg-carbon-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Live Socket Inspector</span>
            {liveSockets.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-carbon-800 text-dorito-400">
                {liveSockets.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ---------------- MODE 1: REGISTRY & NOTES ---------------- */}
      {viewMode === 'registry' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Port Registry & Tunnels */}
          <div className="space-y-6">
            {/* Registered Ports */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-dorito-500" />
                  <h2 className="text-lg font-bold text-white font-sans">Port Registry</h2>
                </div>
                <button
                  onClick={() => setAddPortModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shadow-md shadow-dorito-500/20 transition-all font-mono"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Port</span>
                </button>
              </div>

              <div className="rounded-xl bg-carbon-900 border border-carbon-700 overflow-hidden shadow-lg">
                {ports.length === 0 ? (
                  <div className="p-8 text-center text-carbon-500 text-xs font-mono">
                    No ports registered yet. Add ports (e.g. 3000: Grafana, 5432: Postgres) to document your architecture.
                  </div>
                ) : (
                  <div className="divide-y divide-carbon-800 font-mono text-xs">
                    {ports.map((p) => {
                      const tunnelCliCmd = `ssh -L ${p.port}:127.0.0.1:${p.port} ${selectedHost.username}@${selectedHost.host} -p ${selectedHost.port}`;
                      const isCopied = copiedId === `port-${p.id}`;

                      return (
                        <div key={p.id} className="p-3 hover:bg-carbon-850/60 transition-colors space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-dorito-400 font-bold text-sm">
                                :{p.port}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-carbon-800 text-carbon-400 text-[10px] uppercase">
                                {p.protocol}
                              </span>
                              <span className="text-white font-sans font-medium text-xs">
                                {p.serviceName}
                              </span>
                            </div>

                            <button
                              onClick={() => handleDeletePort(p.id)}
                              className="p-1 text-carbon-500 hover:text-rose-400 transition-colors"
                              title="Delete registered port"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {p.description && (
                            <p className="text-carbon-400 font-sans text-[11px]">
                              {p.description}
                            </p>
                          )}

                          {/* 1-Click CLI SSH Tunnel Command Block */}
                          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-carbon-950 border border-carbon-800 text-[11px] text-carbon-300">
                            <div className="flex items-center gap-1.5 truncate">
                              <Terminal className="w-3.5 h-3.5 text-dorito-500 shrink-0" />
                              <code className="truncate text-carbon-200 select-all font-mono">
                                {tunnelCliCmd}
                              </code>
                            </div>
                            <button
                              onClick={() => handleCopyCommand(`port-${p.id}`, tunnelCliCmd)}
                              className="px-2 py-1 rounded bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-white transition-colors shrink-0 flex items-center gap-1 text-[10px]"
                              title="Copy CLI command"
                            >
                              {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{isCopied ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* SSH Port Forwarding Section */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                  <h2 className="text-lg font-bold text-white font-sans">SSH Port Forwarding (Tunnels)</h2>
                </div>
                <button
                  onClick={() => setAddTunnelModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-carbon-200 hover:text-dorito-400 text-xs font-mono font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Tunnel</span>
                </button>
              </div>

              <div className="rounded-xl bg-carbon-900 border border-carbon-700 overflow-hidden shadow-lg p-3 space-y-3 font-mono">
                {tunnels.length === 0 ? (
                  <div className="p-6 text-center text-carbon-500 text-xs">
                    No tunnels configured. Forward remote ports (e.g. databases, internal web UIs) directly to NijiPanel.
                  </div>
                ) : (
                  tunnels.map((t) => {
                    const tunnelCliCmd = `ssh -L ${t.localPort}:${t.remoteHost}:${t.remotePort} ${selectedHost.username}@${selectedHost.host} -p ${selectedHost.port}`;
                    const isCopied = copiedId === `tunnel-${t.id}`;

                    return (
                      <div
                        key={t.id}
                        className="p-3 rounded-lg bg-carbon-850 border border-carbon-700 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-white font-sans">{t.name}</div>
                            <div className="font-mono text-carbon-400 text-[11px] mt-0.5">
                              Local :{t.localPort} → {t.remoteHost}:{t.remotePort}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleTunnel(t)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                t.isActive
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {t.isActive ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              <span>{t.isActive ? 'Stop' : 'Start'}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteTunnel(t.id)}
                              className="p-1.5 text-carbon-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 1-Click CLI SSH Command Generator */}
                        <div className="flex items-center justify-between gap-2 p-2 rounded bg-carbon-950 border border-carbon-800 text-[11px]">
                          <div className="flex items-center gap-1.5 truncate">
                            <Terminal className="w-3.5 h-3.5 text-dorito-500 shrink-0" />
                            <code className="truncate text-carbon-200 select-all font-mono">
                              {tunnelCliCmd}
                            </code>
                          </div>
                          <button
                            onClick={() => handleCopyCommand(`tunnel-${t.id}`, tunnelCliCmd)}
                            className="px-2 py-1 rounded bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-white transition-colors shrink-0 flex items-center gap-1 text-[10px]"
                            title="Copy ready CLI command"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Server Notes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-dorito-500" />
                <h2 className="text-lg font-bold text-white font-sans">Notes & Documentation</h2>
              </div>
              <button
                onClick={handleSaveNote}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shadow-md shadow-dorito-500/20 transition-all font-mono"
              >
                {noteSaved ? <Check className="w-3.5 h-3.5 text-emerald-950" /> : <Save className="w-3.5 h-3.5" />}
                <span>{noteSaved ? 'Saved!' : 'Save Notes'}</span>
              </button>
            </div>

            <div className="rounded-xl bg-carbon-900 border border-carbon-700 p-4 shadow-lg flex flex-col h-[520px]">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Notes title"
                className="bg-transparent border-b border-carbon-700 pb-2 mb-3 text-sm font-bold text-white focus:outline-none focus:border-dorito-500 font-sans"
              />
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Document configuration details, tokens, backup directories, cron schedules, or helpful command snippets..."
                className="flex-1 w-full bg-carbon-850/60 border border-carbon-700 rounded-lg p-3 text-xs sm:text-sm text-carbon-100 placeholder-carbon-500 focus:outline-none focus:border-dorito-500 font-mono resize-none leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODE 2: LIVE SOCKET INSPECTOR (ss -tulpn) ---------------- */}
      {viewMode === 'live' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-carbon-900 border border-carbon-700">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-carbon-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={socketSearch}
                  onChange={(e) => setSocketSearch(e.target.value)}
                  placeholder="Filter by port, process name (e.g. sshd, docker), or IP..."
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-carbon-500 font-mono focus:border-dorito-500 focus:outline-none"
                />
                {socketSearch && (
                  <button
                    onClick={() => setSocketSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-carbon-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-carbon-850 border border-carbon-700 rounded-lg p-0.5 text-xs font-mono">
                <button
                  onClick={() => setSocketProtoFilter('all')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    socketProtoFilter === 'all'
                      ? 'bg-carbon-700 text-white font-semibold'
                      : 'text-carbon-400 hover:text-carbon-200'
                  }`}
                >
                  All Sockets ({liveSockets.length})
                </button>
                <button
                  onClick={() => setSocketProtoFilter('tcp')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    socketProtoFilter === 'tcp'
                      ? 'bg-carbon-700 text-cyan-400 font-semibold'
                      : 'text-carbon-400 hover:text-cyan-400'
                  }`}
                >
                  TCP ({liveSockets.filter((s) => s.protocol.toLowerCase() === 'tcp').length})
                </button>
                <button
                  onClick={() => setSocketProtoFilter('udp')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    socketProtoFilter === 'udp'
                      ? 'bg-carbon-700 text-amber-400 font-semibold'
                      : 'text-carbon-400 hover:text-amber-400'
                  }`}
                >
                  UDP ({liveSockets.filter((s) => s.protocol.toLowerCase() === 'udp').length})
                </button>
              </div>

              <button
                onClick={loadLiveSockets}
                disabled={loadingSockets}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 rounded-lg text-xs font-mono text-carbon-200 transition-colors shadow-sm"
                title="Execute ss -tulpn via SSH"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSockets ? 'animate-spin text-dorito-500' : ''}`} />
                <span>Refresh ss</span>
              </button>
            </div>
          </div>

          {socketsError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-mono">
              {socketsError}
            </div>
          )}

          {/* Sockets Table */}
          <div className="rounded-xl bg-carbon-900 border border-carbon-700 overflow-hidden shadow-lg">
            <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-carbon-850 text-carbon-400 font-bold border-b border-carbon-700 sticky top-0 z-10 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Protocol</th>
                    <th className="py-2.5 px-3">Port</th>
                    <th className="py-2.5 px-3">Local Address</th>
                    <th className="py-2.5 px-3">Process / PID</th>
                    <th className="py-2.5 px-3">CLI SSH Tunnel Command</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-carbon-800 text-carbon-300">
                  {loadingSockets && liveSockets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-carbon-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-dorito-500" />
                        <span>Querying listening sockets over SSH (ss -tulpn)...</span>
                      </td>
                    </tr>
                  ) : filteredSockets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-carbon-500">
                        No live sockets found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSockets.map((s, idx) => {
                      const tunnelCliCmd = `ssh -L ${s.port}:127.0.0.1:${s.port} ${selectedHost.username}@${selectedHost.host} -p ${selectedHost.port}`;
                      const isCopied = copiedId === `live-${idx}`;

                      return (
                        <tr key={`${s.protocol}-${s.port}-${s.localAddress}-${idx}`} className="hover:bg-carbon-850/60 transition-colors">
                          {/* Protocol & State */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                s.protocol.toLowerCase() === 'tcp'
                                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {s.protocol}
                            </span>
                            <span className="ml-1 text-[10px] text-carbon-500">{s.state}</span>
                          </td>

                          {/* Port */}
                          <td className="py-2.5 px-3 font-bold text-dorito-400 text-sm whitespace-nowrap">
                            :{s.port}
                          </td>

                          {/* Local Address */}
                          <td className="py-2.5 px-3 text-carbon-300 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded bg-carbon-850 border border-carbon-800 text-[11px]">
                              {s.localAddress}
                            </span>
                          </td>

                          {/* Process & PID */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {s.processName ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-white">{s.processName}</span>
                                {s.pid && (
                                  <span className="text-[10px] text-carbon-400">
                                    (PID {s.pid})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-carbon-500 text-[11px]">—</span>
                            )}
                          </td>

                          {/* CLI Tunnel Command Generator */}
                          <td className="py-2.5 px-3 max-w-[280px]">
                            <div className="flex items-center gap-1.5 p-1.5 rounded bg-carbon-950 border border-carbon-800 text-[11px]">
                              <code className="truncate text-carbon-300 select-all font-mono">
                                {tunnelCliCmd}
                              </code>
                              <button
                                onClick={() => handleCopyCommand(`live-${idx}`, tunnelCliCmd)}
                                className="px-1.5 py-0.5 rounded bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-white transition-colors shrink-0 flex items-center gap-1 text-[10px]"
                                title="1-Click Copy CLI Command"
                              >
                                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                <span>{isCopied ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </td>

                          {/* Quick Actions */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleQuickRegisterSocket(s)}
                                className="px-2 py-1 rounded bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-dorito-400 border border-carbon-750 text-[11px] transition-colors"
                                title="Add to Port Registry"
                              >
                                + Registry
                              </button>
                              <button
                                onClick={() => handleQuickTunnelSocket(s)}
                                className="px-2 py-1 rounded bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-amber-400 border border-carbon-750 text-[11px] transition-colors"
                                title="Forward via SSH Tunnel"
                              >
                                + Tunnel
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Port Modal */}
      {addPortModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-1 font-sans">Register Port</h3>
            <p className="text-xs text-carbon-400 mb-4 font-mono">Record port assignments and service mappings for documentation</p>

            <form onSubmit={handleAddPort} className="space-y-3 font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-carbon-300 mb-1">Port</label>
                  <input
                    type="number"
                    value={newPort}
                    onChange={(e) => setNewPort(parseInt(e.target.value) || 80)}
                    required
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-carbon-300 mb-1">Protocol</label>
                  <select
                    value={newProto}
                    onChange={(e) => setNewProto(e.target.value)}
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-carbon-300 mb-1">Service Name</label>
                <input
                  type="text"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  placeholder="e.g. Grafana, PostgreSQL, Nginx"
                  required
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs text-carbon-300 mb-1">Description / Notes</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Internal monitoring, auth required, etc."
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddPortModal(false)}
                  className="px-4 py-2 rounded-lg bg-carbon-800 text-carbon-300 hover:bg-carbon-750 text-xs font-medium font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs font-mono"
                >
                  Save Port
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Tunnel Modal */}
      {addTunnelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-1 font-sans">New SSH Port Forwarding Tunnel</h3>
            <p className="text-xs text-carbon-400 mb-4 font-mono">Forward a remote service through encrypted SSH tunnel directly to NijiPanel host</p>

            <form onSubmit={handleAddTunnel} className="space-y-3 font-mono">
              <div>
                <label className="block text-xs text-carbon-300 mb-1">Tunnel Name</label>
                <input
                  type="text"
                  value={tunnelName}
                  onChange={(e) => setTunnelName(e.target.value)}
                  placeholder="e.g. Remote Redis / Postgres DB"
                  required
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-carbon-300 mb-1">Local Port</label>
                  <input
                    type="number"
                    value={localPort}
                    onChange={(e) => setLocalPort(parseInt(e.target.value) || 8080)}
                    required
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-carbon-300 mb-1">Remote Port</label>
                  <input
                    type="number"
                    value={remotePort}
                    onChange={(e) => setRemotePort(parseInt(e.target.value) || 8080)}
                    required
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-carbon-300 mb-1">Remote Target Host</label>
                <input
                  type="text"
                  value={remoteHost}
                  onChange={(e) => setRemoteHost(e.target.value)}
                  placeholder="127.0.0.1 or internal LAN IP"
                  required
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                />
              </div>

              {/* Ready CLI command preview */}
              <div className="p-2.5 rounded-lg bg-carbon-950 border border-carbon-800 text-[11px] space-y-1">
                <span className="text-carbon-400 text-[10px] uppercase font-bold block">
                  Equivalent Terminal Command:
                </span>
                <code className="text-dorito-400 select-all block break-all font-mono">
                  ssh -L {localPort}:{remoteHost}:{remotePort} {selectedHost.username}@{selectedHost.host} -p {selectedHost.port}
                </code>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddTunnelModal(false)}
                  className="px-4 py-2 rounded-lg bg-carbon-800 text-carbon-300 hover:bg-carbon-750 text-xs font-medium font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs font-mono"
                >
                  Create Tunnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
