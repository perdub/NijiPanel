import React, { useState, useEffect } from 'react';
import {
  Layers,
  Play,
  Square,
  RotateCw,
  Trash2,
  FileText,
  Info,
  Search,
  RefreshCw,
  X,
  Copy,
  Check
} from 'lucide-react';
import { Host, Container, ContainerInspect } from '../types';
import { api } from '../api';

interface DockerViewProps {
  selectedHost: Host | null;
}

export const DockerView: React.FC<DockerViewProps> = ({ selectedHost }) => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterState, setFilterState] = useState<'all' | 'running' | 'exited'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Modals
  const [inspectModal, setInspectModal] = useState<ContainerInspect | null>(null);
  const [logsModal, setLogsModal] = useState<{ id: string; name: string; content: string } | null>(null);
  const [copiedInspect, setCopiedInspect] = useState(false);

  const fetchContainers = async () => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const data = await api.docker.containers(selectedHost.id);
      setContainers(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, [selectedHost]);

  const handleAction = async (containerId: string, action: string) => {
    if (!selectedHost) return;
    if (action === 'rm' && !confirm('Delete container?')) return;

    setActionLoading((prev) => ({ ...prev, [containerId]: true }));
    try {
      await api.docker.action(selectedHost.id, containerId, action);
      await fetchContainers();
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [containerId]: false }));
    }
  };

  const handleOpenInspect = async (containerId: string) => {
    if (!selectedHost) return;
    try {
      const details = await api.docker.inspect(selectedHost.id, containerId);
      setInspectModal(details);
    } catch (err: any) {
      alert(`Inspect error: ${err.message}`);
    }
  };

  const handleOpenLogs = async (containerId: string, name: string) => {
    if (!selectedHost) return;
    try {
      const { logs } = await api.docker.logs(selectedHost.id, containerId, 250);
      setLogsModal({ id: containerId, name, content: logs || 'No logs captured.' });
    } catch (err: any) {
      alert(`Logs error: ${err.message}`);
    }
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-carbon-400 font-mono">
        Select a host from the top navigation to view containers
      </div>
    );
  }

  const filteredContainers = containers.filter((c) => {
    const matchesSearch =
      c.names.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.image.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterState === 'running') return c.state.toLowerCase() === 'running';
    if (filterState === 'exited') return c.state.toLowerCase() === 'exited';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-carbon-700/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Containers</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-semibold">
              LIVE ENGINE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-carbon-400 mt-1 font-mono">
            {selectedHost.name} ({selectedHost.host})
          </p>
        </div>

        <button
          onClick={fetchContainers}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-mono font-medium text-carbon-200 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-dorito-500' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar: IBM Carbon dense style */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-carbon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by name, image, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-carbon-900 border border-carbon-700 rounded-lg pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 focus:ring-1 focus:ring-dorito-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-carbon-900 border border-carbon-700 self-start sm:self-auto font-mono text-xs">
          <button
            onClick={() => setFilterState('all')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filterState === 'all'
                ? 'bg-dorito-500 text-carbon-950 font-bold shadow-sm'
                : 'text-carbon-400 hover:text-white'
            }`}
          >
            All ({containers.length})
          </button>
          <button
            onClick={() => setFilterState('running')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filterState === 'running'
                ? 'bg-emerald-500 text-carbon-950 font-bold'
                : 'text-carbon-400 hover:text-white'
            }`}
          >
            Running ({containers.filter((c) => c.state === 'running').length})
          </button>
          <button
            onClick={() => setFilterState('exited')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filterState === 'exited'
                ? 'bg-rose-500 text-white font-bold'
                : 'text-carbon-400 hover:text-white'
            }`}
          >
            Exited ({containers.filter((c) => c.state === 'exited').length})
          </button>
        </div>
      </div>

      {/* Containers List / Table */}
      {filteredContainers.length === 0 ? (
        <div className="rounded-xl border border-carbon-700 bg-carbon-900/60 p-12 text-center text-carbon-400">
          <Layers className="w-12 h-12 text-carbon-600 mx-auto mb-3" />
          <p className="text-sm font-medium font-mono">No containers found</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredContainers.map((c) => {
            const isRunning = c.state.toLowerCase() === 'running';
            const isBusy = actionLoading[c.id];

            return (
              <div
                key={c.id}
                className="rounded-xl bg-carbon-900 border border-carbon-700 hover:border-dorito-500/50 p-4 shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase tracking-wider border ${
                        isRunning
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {c.state}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-white truncate font-sans">{c.names}</h3>
                    <span className="text-[11px] font-mono text-carbon-400 bg-carbon-850 border border-carbon-700 px-2 py-0.5 rounded-none">
                      {c.id.substring(0, 12)}
                    </span>
                  </div>

                  <p className="text-xs text-carbon-400 truncate mb-1.5 font-mono">{c.image}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-carbon-400 font-mono">
                    {c.ports && <span className="truncate text-dorito-400">Ports: {c.ports}</span>}
                    <span>Status: {c.status}</span>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0 font-mono">
                  {isRunning ? (
                    <>
                      <button
                        onClick={() => handleAction(c.id, 'stop')}
                        disabled={isBusy}
                        className="p-2 rounded-lg bg-carbon-850 hover:bg-rose-600/20 text-carbon-400 hover:text-rose-400 border border-carbon-700 transition-colors"
                        title="Stop"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAction(c.id, 'restart')}
                        disabled={isBusy}
                        className="p-2 rounded-lg bg-carbon-850 hover:bg-amber-600/20 text-carbon-400 hover:text-dorito-400 border border-carbon-700 transition-colors"
                        title="Restart"
                      >
                        <RotateCw className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAction(c.id, 'start')}
                      disabled={isBusy}
                      className="p-2 rounded-lg bg-carbon-850 hover:bg-emerald-600/20 text-carbon-400 hover:text-emerald-400 border border-carbon-700 transition-colors"
                      title="Start"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenLogs(c.id, c.names)}
                    className="p-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-400 hover:text-dorito-400 border border-carbon-700 transition-colors"
                    title="Logs"
                  >
                    <FileText className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleOpenInspect(c.id)}
                    className="p-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-400 hover:text-dorito-400 border border-carbon-700 transition-colors"
                    title="Inspect"
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleAction(c.id, 'rm')}
                    disabled={isBusy}
                    className="p-2 rounded-lg bg-carbon-850 hover:bg-rose-600/20 text-carbon-400 hover:text-rose-400 border border-carbon-700 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Logs Modal */}
      {logsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-5 relative flex flex-col h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-3">
              <div className="truncate">
                <h3 className="font-bold text-white text-base truncate font-sans">Logs: {logsModal.name}</h3>
                <span className="text-xs text-dorito-400 font-mono">{logsModal.id.substring(0, 12)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenLogs(logsModal.id, logsModal.name)}
                  className="p-1.5 rounded-lg bg-carbon-850 text-carbon-300 hover:text-white border border-carbon-700"
                  title="Refresh logs"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setLogsModal(null)}
                  className="p-1.5 rounded-lg text-carbon-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <pre className="flex-1 overflow-auto bg-black/90 p-4 rounded-xl font-mono text-xs text-dorito-100 whitespace-pre-wrap break-all leading-relaxed select-text border border-carbon-700">
              {logsModal.content}
            </pre>
          </div>
        </div>
      )}

      {/* Inspect Modal */}
      {inspectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-5 relative flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
              <div>
                <h3 className="font-bold text-white text-base font-sans">Inspect: {inspectModal.name}</h3>
                <p className="text-xs text-dorito-400 font-mono">{inspectModal.id.substring(0, 12)}</p>
              </div>
              <button
                onClick={() => setInspectModal(null)}
                className="p-1.5 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 font-mono text-xs">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-carbon-400 mb-2 font-mono">
                  Environment Variables (ENV)
                </h4>
                <div className="bg-black/60 rounded-xl p-3 border border-carbon-700 space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
                  {inspectModal.env.map((env, i) => (
                    <div key={i} className="text-carbon-300 truncate">
                      <span className="text-dorito-400">{env.split('=')[0]}=</span>
                      <span className="text-carbon-400">{env.split('=').slice(1).join('=')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-carbon-400 mb-2 font-mono">
                  Mounted Volumes (Mounts)
                </h4>
                <div className="bg-black/60 rounded-xl p-3 border border-carbon-700 space-y-1 font-mono text-xs">
                  {inspectModal.mounts.length > 0 ? (
                    inspectModal.mounts.map((m, i) => <div key={i} className="text-carbon-300 truncate">{m}</div>)
                  ) : (
                    <div className="text-carbon-500">No mounts attached</div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-carbon-400 mb-2 font-mono">
                  Exposed Ports
                </h4>
                <div className="bg-black/60 rounded-xl p-3 border border-carbon-700 space-y-1 font-mono text-xs">
                  {inspectModal.ports.length > 0 ? (
                    inspectModal.ports.map((p, i) => <div key={i} className="text-carbon-300">{p}</div>)
                  ) : (
                    <div className="text-carbon-500">No ports mapped</div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-carbon-400 font-mono">
                    Raw JSON (docker inspect)
                  </h4>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inspectModal.rawJson);
                      setCopiedInspect(true);
                      setTimeout(() => setCopiedInspect(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[11px] text-dorito-400 hover:text-dorito-300 font-mono"
                  >
                    {copiedInspect ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedInspect ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="bg-black/80 p-3 rounded-xl border border-carbon-700 text-[11px] font-mono text-dorito-100 max-h-48 overflow-auto">
                  {inspectModal.rawJson}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
