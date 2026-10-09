import React, { useState, useEffect, useRef } from 'react';
import {
  Network,
  StickyNote,
  Plus,
  Trash2,
  Save,
  Play,
  Square,
  Check,
  Terminal,
  Radio,
  Copy,
  Search,
  RefreshCw,
  X,
  ExternalLink,
  Shield,
  Activity,
  Globe,
  Lock,
  BookmarkPlus,
  ArrowRight
} from 'lucide-react';
import { Host, HostPort, SshTunnel, LiveSocket } from '../types';
import { api } from '../api';

const KNOWN_PORT_SERVICES: Record<number, string> = {
  20: 'FTP-DATA',
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  67: 'DHCP',
  68: 'DHCP-Client',
  80: 'HTTP',
  110: 'POP3',
  123: 'NTP',
  143: 'IMAP',
  323: 'Chrony NTP',
  443: 'HTTPS',
  465: 'SMTPS',
  587: 'SMTP-Submission',
  631: 'CUPS Printing',
  993: 'IMAPS',
  995: 'POP3S',
  1194: 'OpenVPN',
  1433: 'MS-SQL',
  1521: 'Oracle-DB',
  2049: 'NFS',
  2375: 'Docker HTTP',
  2376: 'Docker TLS',
  3000: 'Grafana / Dev',
  3306: 'MySQL / MariaDB',
  3389: 'RDP',
  5000: 'Flask / Registry',
  51820: 'WireGuard',
  5432: 'PostgreSQL',
  6379: 'Redis',
  8000: 'HTTP Alt',
  8080: 'HTTP Proxy / App',
  8443: 'HTTPS Alt',
  9000: 'Portainer / MinIO',
  9090: 'Prometheus',
  9100: 'Node Exporter',
  9200: 'Elasticsearch',
  27017: 'MongoDB',
};

const WEB_PORTS = new Set([80, 443, 3000, 5000, 8000, 8080, 8443, 9000, 9090]);

interface PortsNotesViewProps {
  selectedHost: Host | null;
}

export const PortsNotesView: React.FC<PortsNotesViewProps> = ({ selectedHost }) => {
  // Mode switcher: 'active' (default), 'registry', 'notes'
  const [viewMode, setViewMode] = useState<'active' | 'registry' | 'notes'>('active');

  // Live Sockets states
  const [liveSockets, setLiveSockets] = useState<LiveSocket[]>([]);
  const [loadingSockets, setLoadingSockets] = useState(false);
  const [socketsError, setSocketsError] = useState<string | null>(null);
  const [socketSearch, setSocketSearch] = useState('');
  const [socketFilter, setSocketFilter] = useState<'all' | 'tcp' | 'udp' | 'public' | 'local' | 'web'>('all');
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(0); // 0 = off, 5, 10, 30
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Registry & Notes states
  const [ports, setPorts] = useState<HostPort[]>([]);
  const [noteTitle, setNoteTitle] = useState('Server Notes');
  const [noteContent, setNoteContent] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [tunnels, setTunnels] = useState<SshTunnel[]>([]);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add Port Modal
  const [addPortModal, setAddPortModal] = useState(false);
  const [newPort, setNewPort] = useState(8080);
  const [newProto, setNewProto] = useState('tcp');
  const [newService, setNewService] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Add Tunnel Modal
  const [addTunnelModal, setAddTunnelModal] = useState(false);
  const [tunnelName, setTunnelName] = useState('');
  const [localPort, setLocalPort] = useState(8080);
  const [remoteHost, setRemoteHost] = useState('127.0.0.1');
  const [remotePort, setRemotePort] = useState(8080);

  // Fetch live listening sockets
  const loadLiveSockets = async (forceRefresh = false) => {
    if (!selectedHost) return;
    setLoadingSockets(true);
    setSocketsError(null);
    try {
      const data = await api.extras.liveSockets(selectedHost.id, forceRefresh);
      setLiveSockets(data);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      setSocketsError(err.message || 'Failed to fetch live sockets via ss -tulpn over SSH');
    } finally {
      setLoadingSockets(false);
    }
  };

  // Fetch static registry & notes
  const loadRegistryData = async () => {
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
      console.error('Failed to load port registry/notes:', err);
    }
  };

  // On host change, always load active sockets immediately
  useEffect(() => {
    if (selectedHost) {
      loadLiveSockets(false);
      loadRegistryData();
    }
  }, [selectedHost?.id]);

  // Auto-refresh interval handler
  useEffect(() => {
    if (autoRefreshSec <= 0 || !selectedHost) return;
    const interval = setInterval(() => {
      loadLiveSockets(true);
    }, autoRefreshSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshSec, selectedHost?.id]);

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
      loadRegistryData();
    } catch (err: any) {
      alert(`Failed to add port: ${err.message}`);
    }
  };

  const handleDeletePort = async (portId: string) => {
    if (!selectedHost) return;
    try {
      await api.extras.deletePort(selectedHost.id, portId);
      loadRegistryData();
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
      loadRegistryData();
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
      loadRegistryData();
    } catch (err: any) {
      alert(`Failed to toggle tunnel: ${err.message}`);
    }
  };

  const handleDeleteTunnel = async (tunnelId: string) => {
    if (!selectedHost) return;
    if (!confirm('Delete SSH tunnel configuration?')) return;
    try {
      await api.extras.deleteTunnel(selectedHost.id, tunnelId);
      loadRegistryData();
    } catch (err: any) {
      alert(`Failed to delete tunnel: ${err.message}`);
    }
  };

  // Quick bookmark from live socket
  const handleQuickRegisterSocket = (s: LiveSocket) => {
    const known = KNOWN_PORT_SERVICES[s.port];
    setNewPort(s.port);
    setNewProto(s.protocol.toLowerCase());
    setNewService(s.processName || known || `Port :${s.port}`);
    setNewDesc(`Listening on ${s.localAddress} (PID ${s.pid || 'N/A'})`);
    setAddPortModal(true);
  };

  // Quick tunnel from live socket
  const handleQuickTunnelSocket = (s: LiveSocket) => {
    setTunnelName(`${s.processName || 'Port'}-${s.port}`);
    setLocalPort(s.port);
    setRemoteHost('127.0.0.1');
    setRemotePort(s.port);
    setAddTunnelModal(true);
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-carbon-400 font-mono border border-carbon-700 bg-carbon-900 rounded-none">
        Select a server from the top navigation bar to inspect active ports and sockets.
      </div>
    );
  }

  // Sockets classification
  const totalSockets = liveSockets.length;
  const distinctPortsCount = new Set(liveSockets.map((s) => s.port)).size;
  const tcpCount = liveSockets.filter((s) => s.protocol.toLowerCase() === 'tcp').length;
  const udpCount = liveSockets.filter((s) => s.protocol.toLowerCase() === 'udp').length;
  const publicCount = liveSockets.filter(
    (s) => s.localAddress === '0.0.0.0' || s.localAddress === '::' || s.localAddress === '*'
  ).length;
  const localCount = liveSockets.filter(
    (s) => s.localAddress.startsWith('127.') || s.localAddress === '::1'
  ).length;
  const uniqueProcesses = new Set(liveSockets.map((s) => s.processName).filter(Boolean)).size;

  // Filtered live sockets
  const filteredSockets = liveSockets.filter((s) => {
    const term = socketSearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      s.port.toString().includes(term) ||
      s.localAddress.toLowerCase().includes(term) ||
      (s.processName && s.processName.toLowerCase().includes(term)) ||
      (s.pid && s.pid.toString().includes(term)) ||
      (KNOWN_PORT_SERVICES[s.port] && KNOWN_PORT_SERVICES[s.port].toLowerCase().includes(term));
    if (!matchesSearch) return false;

    if (socketFilter === 'tcp') return s.protocol.toLowerCase() === 'tcp';
    if (socketFilter === 'udp') return s.protocol.toLowerCase() === 'udp';
    if (socketFilter === 'public')
      return s.localAddress === '0.0.0.0' || s.localAddress === '::' || s.localAddress === '*';
    if (socketFilter === 'local')
      return s.localAddress.startsWith('127.') || s.localAddress === '::1';
    if (socketFilter === 'web')
      return WEB_PORTS.has(s.port) || (s.processName && /nginx|caddy|apache|http/i.test(s.processName));

    return true;
  });

  return (
    <div className="space-y-6">
      {/* ================= PAGE HEADER & TAB NAVIGATION ================= */}
      <div className="border border-carbon-700 bg-carbon-900 p-4 sm:p-5 rounded-none flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-dorito-500/10 border border-dorito-500/30 text-dorito-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight uppercase font-mono">
                  Active Ports & Sockets
                </h1>
                <span className="px-2 py-0.5 bg-dorito-500 text-carbon-950 font-mono text-[10px] font-bold uppercase tracking-wider">
                  Live ss -tulpn
                </span>
              </div>
              <p className="text-xs text-carbon-400 font-mono mt-0.5">
                Real-time listening ports, PID process mapping, and 1-click SSH tunnels on <span className="text-white font-semibold">{selectedHost.name}</span> ({selectedHost.host})
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center border border-carbon-700 bg-carbon-950 rounded-none font-mono text-xs p-1 self-start md:self-auto">
          <button
            onClick={() => setViewMode('active')}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors rounded-none ${
              viewMode === 'active'
                ? 'bg-dorito-500 text-carbon-950 font-bold shadow-sm'
                : 'text-carbon-300 hover:text-white hover:bg-carbon-850'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Ports ({distinctPortsCount})</span>
          </button>

          <button
            onClick={() => setViewMode('registry')}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors rounded-none ${
              viewMode === 'registry'
                ? 'bg-dorito-500 text-carbon-950 font-bold shadow-sm'
                : 'text-carbon-300 hover:text-white hover:bg-carbon-850'
            }`}
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Port Registry & Tunnels</span>
            {ports.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-carbon-800 text-dorito-400">
                {ports.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode('notes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors rounded-none ${
              viewMode === 'notes'
                ? 'bg-dorito-500 text-carbon-950 font-bold shadow-sm'
                : 'text-carbon-300 hover:text-white hover:bg-carbon-850'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>Server Notes</span>
          </button>
        </div>
      </div>

      {/* ================= PRIMARY MODE: ACTIVE PORTS (ss -tulpn) ================= */}
      {viewMode === 'active' && (
        <div className="space-y-4">
          {/* Top Telemetry Cards: IBM Carbon Sharp High-Density */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <div className="border border-carbon-700 bg-carbon-900 p-3 rounded-none">
              <span className="text-[10px] text-carbon-400 uppercase font-mono block">Listening Ports</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-bold font-mono text-dorito-400">{distinctPortsCount}</span>
                <span className="text-[10px] text-carbon-400 font-mono">distinct</span>
              </div>
            </div>

            <div className="border border-carbon-700 bg-carbon-900 p-3 rounded-none">
              <span className="text-[10px] text-cyan-400 uppercase font-mono block">TCP Sockets</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-bold font-mono text-white">{tcpCount}</span>
                <span className="text-[10px] text-carbon-400 font-mono">LISTEN</span>
              </div>
            </div>

            <div className="border border-carbon-700 bg-carbon-900 p-3 rounded-none">
              <span className="text-[10px] text-amber-400 uppercase font-mono block">UDP Sockets</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-bold font-mono text-white">{udpCount}</span>
                <span className="text-[10px] text-carbon-400 font-mono">UNCONN</span>
              </div>
            </div>

            <div className="border border-carbon-700 bg-carbon-900 p-3 rounded-none">
              <span className="text-[10px] text-rose-400 uppercase font-mono block">Publicly Bound</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-bold font-mono text-rose-400">{publicCount}</span>
                <span className="text-[10px] text-carbon-400 font-mono">0.0.0.0 / ::</span>
              </div>
            </div>

            <div className="border border-carbon-700 bg-carbon-900 p-3 rounded-none">
              <span className="text-[10px] text-emerald-400 uppercase font-mono block">Localhost Loopback</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-bold font-mono text-emerald-400">{localCount}</span>
                <span className="text-[10px] text-carbon-400 font-mono">127.0.0.1</span>
              </div>
            </div>

            <div className="border border-carbon-700 bg-carbon-900 p-3 rounded-none">
              <span className="text-[10px] text-carbon-300 uppercase font-mono block">Active Daemons</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-bold font-mono text-white">{uniqueProcesses}</span>
                <span className="text-[10px] text-carbon-400 font-mono">PIDs</span>
              </div>
            </div>
          </div>

          {/* Control Bar: Search, Category Chips, Auto-Refresh & Refresh Button */}
          <div className="border border-carbon-700 bg-carbon-900 p-3 rounded-none flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-carbon-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={socketSearch}
                  onChange={(e) => setSocketSearch(e.target.value)}
                  placeholder="Filter by port (e.g. 80, 22), process (sshd), or PID..."
                  className="w-full bg-carbon-950 border border-carbon-700 rounded-none pl-9 pr-8 py-1.5 text-xs text-white placeholder-carbon-500 font-mono focus:border-dorito-500 focus:outline-none"
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

            {/* Quick Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 font-mono text-xs">
              <button
                onClick={() => setSocketFilter('all')}
                className={`px-2.5 py-1 border transition-colors rounded-none whitespace-nowrap ${
                  socketFilter === 'all'
                    ? 'bg-carbon-800 text-white border-carbon-600 font-bold'
                    : 'bg-carbon-950 text-carbon-400 border-carbon-750 hover:text-white'
                }`}
              >
                All ({totalSockets})
              </button>
              <button
                onClick={() => setSocketFilter('tcp')}
                className={`px-2.5 py-1 border transition-colors rounded-none whitespace-nowrap ${
                  socketFilter === 'tcp'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                    : 'bg-carbon-950 text-carbon-400 border-carbon-750 hover:text-cyan-400'
                }`}
              >
                TCP ({tcpCount})
              </button>
              <button
                onClick={() => setSocketFilter('udp')}
                className={`px-2.5 py-1 border transition-colors rounded-none whitespace-nowrap ${
                  socketFilter === 'udp'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                    : 'bg-carbon-950 text-carbon-400 border-carbon-750 hover:text-amber-400'
                }`}
              >
                UDP ({udpCount})
              </button>
              <button
                onClick={() => setSocketFilter('public')}
                className={`px-2.5 py-1 border transition-colors rounded-none whitespace-nowrap ${
                  socketFilter === 'public'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                    : 'bg-carbon-950 text-carbon-400 border-carbon-750 hover:text-rose-400'
                }`}
              >
                Public ({publicCount})
              </button>
              <button
                onClick={() => setSocketFilter('local')}
                className={`px-2.5 py-1 border transition-colors rounded-none whitespace-nowrap ${
                  socketFilter === 'local'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                    : 'bg-carbon-950 text-carbon-400 border-carbon-750 hover:text-emerald-400'
                }`}
              >
                Localhost ({localCount})
              </button>
              <button
                onClick={() => setSocketFilter('web')}
                className={`px-2.5 py-1 border transition-colors rounded-none whitespace-nowrap ${
                  socketFilter === 'web'
                    ? 'bg-dorito-500/20 text-dorito-300 border-dorito-500/50 font-bold'
                    : 'bg-carbon-950 text-carbon-400 border-carbon-750 hover:text-dorito-400'
                }`}
              >
                Web
              </button>
            </div>

            {/* Auto-Refresh Selector & Refresh Button */}
            <div className="flex items-center gap-2 justify-end font-mono text-xs">
              <div className="flex items-center gap-1 border border-carbon-700 bg-carbon-950 px-2 py-1 text-carbon-400">
                <span className="text-[10px] uppercase text-carbon-500">Auto:</span>
                <select
                  value={autoRefreshSec}
                  onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                  className="bg-transparent text-white focus:outline-none cursor-pointer text-xs font-mono"
                >
                  <option value={0} className="bg-carbon-900 text-white">Off</option>
                  <option value={5} className="bg-carbon-900 text-white">5s</option>
                  <option value={10} className="bg-carbon-900 text-white">10s</option>
                  <option value={30} className="bg-carbon-900 text-white">30s</option>
                </select>
                {autoRefreshSec > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                )}
              </div>

              <button
                onClick={() => loadLiveSockets(true)}
                disabled={loadingSockets}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold border border-dorito-500 transition-colors disabled:opacity-50 rounded-none shadow-sm"
                title="Execute ss -tulpn over SSH immediately"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSockets ? 'animate-spin' : ''}`} />
                <span>{loadingSockets ? 'Polling...' : 'Refresh ss'}</span>
              </button>
            </div>
          </div>

          {socketsError && (
            <div className="p-3 border border-rose-500/40 bg-rose-500/10 text-xs text-rose-400 font-mono rounded-none">
              <strong>Error inspecting sockets:</strong> {socketsError}
            </div>
          )}

          {/* Active Ports Table */}
          <div className="border border-carbon-700 bg-carbon-900 rounded-none overflow-hidden">
            <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-carbon-950 text-carbon-400 font-bold border-b border-carbon-700 sticky top-0 z-10 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Port</th>
                    <th className="py-2.5 px-3">Protocol & State</th>
                    <th className="py-2.5 px-3">Bind Address</th>
                    <th className="py-2.5 px-3">Process / Daemon</th>
                    <th className="py-2.5 px-3">1-Click SSH Tunnel Command</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-carbon-800 text-carbon-300">
                  {loadingSockets && liveSockets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-carbon-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-dorito-500" />
                        <span>Querying listening sockets on {selectedHost.name} (`ss -tulpn`)...</span>
                      </td>
                    </tr>
                  ) : filteredSockets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-carbon-500">
                        {liveSockets.length === 0 ? (
                          <div>
                            <p className="text-white font-medium mb-1">No listening sockets returned</p>
                            <p className="text-[11px] text-carbon-500">Check SSH connection permissions or click "Refresh ss" above.</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-white font-medium mb-1">No sockets matched filter "{socketSearch || socketFilter}"</p>
                            <button
                              onClick={() => {
                                setSocketSearch('');
                                setSocketFilter('all');
                              }}
                              className="text-xs text-dorito-400 underline mt-1"
                            >
                              Reset filters
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredSockets.map((s, idx) => {
                      const isPublic = s.localAddress === '0.0.0.0' || s.localAddress === '::' || s.localAddress === '*';
                      const isLocal = s.localAddress.startsWith('127.') || s.localAddress === '::1';
                      const knownService = KNOWN_PORT_SERVICES[s.port];
                      const isWeb = WEB_PORTS.has(s.port);
                      const tunnelCliCmd = `ssh -L ${s.port}:127.0.0.1:${s.port} ${selectedHost.username}@${selectedHost.host} -p ${selectedHost.port}`;
                      const isCopied = copiedId === `live-${idx}`;

                      return (
                        <tr
                          key={`${s.protocol}-${s.port}-${s.localAddress}-${idx}`}
                          className="hover:bg-carbon-850/70 transition-colors border-l-2 border-l-transparent hover:border-l-dorito-500"
                        >
                          {/* Port Number & Service Badge */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-dorito-400 text-sm tracking-tight font-mono">
                                :{s.port}
                              </span>
                              {knownService && (
                                <span className="px-1.5 py-0.2 border border-carbon-700 bg-carbon-850 text-carbon-300 text-[10px] uppercase font-mono">
                                  {knownService}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Protocol & State */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.5 border text-[10px] font-bold uppercase rounded-none ${
                                  s.protocol.toLowerCase() === 'tcp'
                                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                }`}
                              >
                                {s.protocol}
                              </span>
                              <div className="flex items-center gap-1 text-[10px] text-carbon-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>{s.state || 'LISTEN'}</span>
                              </div>
                            </div>
                          </td>

                          {/* Bind Address & Scope Indicator */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-carbon-950 border border-carbon-750 text-carbon-200 text-xs font-mono">
                                {s.localAddress}
                              </span>
                              {isPublic && (
                                <span className="px-1.5 py-0.2 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold uppercase flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  <span>Public</span>
                                </span>
                              )}
                              {isLocal && (
                                <span className="px-1.5 py-0.2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  <span>Localhost</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Process & PID */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {s.processName ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-xs">{s.processName}</span>
                                {s.pid && (
                                  <span className="px-1.5 py-0.2 bg-carbon-800 text-carbon-400 border border-carbon-700 text-[10px]">
                                    PID {s.pid}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-carbon-500 text-[11px] italic">kernel/system</span>
                            )}
                          </td>

                          {/* 1-Click SSH Port Forward Command */}
                          <td className="py-2.5 px-3 max-w-[320px]">
                            <div className="flex items-center justify-between gap-1.5 p-1.5 bg-carbon-950 border border-carbon-800 text-[11px]">
                              <code className="truncate text-carbon-300 font-mono select-all">
                                {tunnelCliCmd}
                              </code>
                              <button
                                onClick={() => handleCopyCommand(`live-${idx}`, tunnelCliCmd)}
                                className="px-2 py-0.5 bg-carbon-850 hover:bg-carbon-800 border border-carbon-750 text-carbon-200 hover:text-white transition-colors shrink-0 flex items-center gap-1 text-[10px] rounded-none"
                                title="Copy 1-Click SSH Tunnel Command"
                              >
                                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                <span>{isCopied ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </td>

                          {/* Actions: Open Web, Bookmark, Tunnel */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isWeb && isPublic && (
                                <a
                                  href={`http://${selectedHost.host}:${s.port}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 bg-carbon-800 hover:bg-carbon-750 text-dorito-400 hover:text-dorito-300 border border-carbon-700 text-[11px] transition-colors flex items-center gap-1 rounded-none"
                                  title={`Open http://${selectedHost.host}:${s.port} in new tab`}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Open Web</span>
                                </a>
                              )}
                              <button
                                onClick={() => handleQuickRegisterSocket(s)}
                                className="px-2 py-1 bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-dorito-400 border border-carbon-750 text-[11px] transition-colors rounded-none"
                                title="Save to Port Registry for Documentation"
                              >
                                + Bookmark
                              </button>
                              <button
                                onClick={() => handleQuickTunnelSocket(s)}
                                className="px-2 py-1 bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-amber-400 border border-carbon-750 text-[11px] transition-colors rounded-none"
                                title="Configure Managed SSH Tunnel"
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

            {/* Table Footer info */}
            <div className="bg-carbon-950 p-2.5 border-t border-carbon-800 flex items-center justify-between text-[11px] text-carbon-400 font-mono">
              <div>
                Showing <span className="text-white font-bold">{filteredSockets.length}</span> of <span className="text-white font-bold">{totalSockets}</span> active socket listeners
              </div>
              {lastRefreshedAt && (
                <div>
                  Last refreshed: <span className="text-carbon-300">{lastRefreshedAt.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= SECONDARY MODE: PORT REGISTRY & TUNNELS ================= */}
      {viewMode === 'registry' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Registered Documented Ports */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-dorito-500" />
                <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                  Documented Port Registry
                </h2>
              </div>
              <button
                onClick={() => setAddPortModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs border border-dorito-500 transition-all font-mono rounded-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Port Entry</span>
              </button>
            </div>

            <div className="border border-carbon-700 bg-carbon-900 rounded-none overflow-hidden">
              {ports.length === 0 ? (
                <div className="p-8 text-center text-carbon-500 text-xs font-mono">
                  No ports documented yet. Click "Add Port Entry" or use "+ Bookmark" from the Active Ports tab.
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
                            <span className="px-1.5 py-0.2 bg-carbon-800 border border-carbon-700 text-carbon-400 text-[10px] uppercase">
                              {p.protocol}
                            </span>
                            <span className="text-white font-medium text-xs font-sans">
                              {p.serviceName}
                            </span>
                          </div>

                          <button
                            onClick={() => handleDeletePort(p.id)}
                            className="p-1 text-carbon-500 hover:text-rose-400 transition-colors"
                            title="Delete port bookmark"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {p.description && (
                          <p className="text-carbon-400 font-sans text-[11px]">
                            {p.description}
                          </p>
                        )}

                        {/* 1-Click CLI SSH Command Block */}
                        <div className="flex items-center justify-between gap-2 p-2 bg-carbon-950 border border-carbon-800 text-[11px] text-carbon-300">
                          <div className="flex items-center gap-1.5 truncate">
                            <Terminal className="w-3.5 h-3.5 text-dorito-500 shrink-0" />
                            <code className="truncate text-carbon-200 select-all font-mono">
                              {tunnelCliCmd}
                            </code>
                          </div>
                          <button
                            onClick={() => handleCopyCommand(`port-${p.id}`, tunnelCliCmd)}
                            className="px-2 py-1 bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-white transition-colors shrink-0 flex items-center gap-1 text-[10px] rounded-none"
                            title="Copy SSH port forwarding command"
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

          {/* Right Column: Managed SSH Tunnels */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-dorito-500" />
                <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                  Managed SSH Tunnels
                </h2>
              </div>
              <button
                onClick={() => setAddTunnelModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-carbon-800 hover:bg-carbon-750 text-white font-bold text-xs border border-carbon-700 transition-all font-mono rounded-none"
              >
                <Plus className="w-3.5 h-3.5 text-dorito-400" />
                <span>New Tunnel</span>
              </button>
            </div>

            <div className="border border-carbon-700 bg-carbon-900 rounded-none overflow-hidden">
              {tunnels.length === 0 ? (
                <div className="p-8 text-center text-carbon-500 text-xs font-mono">
                  No background SSH tunnels configured. Click "New Tunnel" to route remote ports to local ports.
                </div>
              ) : (
                <div className="divide-y divide-carbon-800 font-mono text-xs">
                  {tunnels.map((t) => {
                    const tunnelCliCmd = `ssh -L ${t.localPort}:${t.remoteHost}:${t.remotePort} ${selectedHost.username}@${selectedHost.host} -p ${selectedHost.port}`;
                    const isCopied = copiedId === `tunnel-${t.id}`;

                    return (
                      <div key={t.id} className="p-3 hover:bg-carbon-850/60 transition-colors space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="font-semibold text-white text-xs">{t.name}</span>
                            <div className="text-carbon-400 text-[11px] mt-0.5">
                              Local :{t.localPort} → {t.remoteHost}:{t.remotePort}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleTunnel(t)}
                              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold transition-colors rounded-none border ${
                                t.isActive
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              }`}
                            >
                              {t.isActive ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              <span>{t.isActive ? 'Stop' : 'Start'}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteTunnel(t.id)}
                              className="p-1 text-carbon-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 1-Click CLI SSH Command Generator */}
                        <div className="flex items-center justify-between gap-2 p-2 bg-carbon-950 border border-carbon-800 text-[11px]">
                          <div className="flex items-center gap-1.5 truncate">
                            <Terminal className="w-3.5 h-3.5 text-dorito-500 shrink-0" />
                            <code className="truncate text-carbon-200 select-all font-mono">
                              {tunnelCliCmd}
                            </code>
                          </div>
                          <button
                            onClick={() => handleCopyCommand(`tunnel-${t.id}`, tunnelCliCmd)}
                            className="px-2 py-1 bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-white transition-colors shrink-0 flex items-center gap-1 text-[10px] rounded-none"
                            title="Copy ready CLI command"
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
        </div>
      )}

      {/* ================= SECONDARY MODE: SERVER NOTES ================= */}
      {viewMode === 'notes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-dorito-500" />
              <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                Server Documentation & Notes
              </h2>
            </div>
            <button
              onClick={handleSaveNote}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs border border-dorito-500 transition-all font-mono rounded-none"
            >
              {noteSaved ? <Check className="w-3.5 h-3.5 text-emerald-950" /> : <Save className="w-3.5 h-3.5" />}
              <span>{noteSaved ? 'Saved!' : 'Save Notes'}</span>
            </button>
          </div>

          <div className="border border-carbon-700 bg-carbon-900 p-4 rounded-none flex flex-col h-[520px]">
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
              placeholder="Record configuration details, open port documentation, backup directories, secrets, or helpful CLI snippets for this host..."
              className="flex-1 w-full bg-carbon-950 border border-carbon-700 rounded-none p-3 text-xs sm:text-sm text-carbon-100 placeholder-carbon-500 focus:outline-none focus:border-dorito-500 font-mono resize-none leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}
      {/* Add Port Modal */}
      {addPortModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-none p-5 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-1 font-mono uppercase">Register Port Bookmark</h3>
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
                    className="w-full bg-carbon-950 border border-carbon-700 rounded-none px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-carbon-300 mb-1">Protocol</label>
                  <select
                    value={newProto}
                    onChange={(e) => setNewProto(e.target.value)}
                    className="w-full bg-carbon-950 border border-carbon-700 rounded-none px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
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
                  className="w-full bg-carbon-950 border border-carbon-700 rounded-none px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs text-carbon-300 mb-1">Description / Notes</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Internal monitoring, auth required, etc."
                  className="w-full bg-carbon-950 border border-carbon-700 rounded-none px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddPortModal(false)}
                  className="px-4 py-2 bg-carbon-800 text-carbon-300 hover:bg-carbon-750 text-xs font-bold font-mono rounded-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs font-mono rounded-none"
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
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-none p-5 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-1 font-mono uppercase">New SSH Port Forwarding Tunnel</h3>
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
                  className="w-full bg-carbon-950 border border-carbon-700 rounded-none px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-sans"
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
                    className="w-full bg-carbon-950 border border-carbon-700 rounded-none px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-carbon-300 mb-1">Remote Port</label>
                  <input
                    type="number"
                    value={remotePort}
                    onChange={(e) => setRemotePort(parseInt(e.target.value) || 8080)}
                    required
                    className="w-full bg-carbon-950 border border-carbon-700 rounded-none px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
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
                  className="w-full bg-carbon-950 border border-carbon-700 rounded-none px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                />
              </div>

              {/* Ready CLI command preview */}
              <div className="p-2.5 bg-carbon-950 border border-carbon-800 text-[11px] space-y-1">
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
                  className="px-4 py-2 bg-carbon-800 text-carbon-300 hover:bg-carbon-750 text-xs font-bold font-mono rounded-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs font-mono rounded-none"
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
