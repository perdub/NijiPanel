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
  Check,
  Terminal,
  AlertTriangle,
  Flame,
  Sparkles,
  Scissors,
  CheckCircle2,
  Loader2,
  HardDrive
} from 'lucide-react';
import { Host, Container, ContainerInspect, ContainerCrashDump, DockerPrunePreviewResponse } from '../types';
import { api } from '../api';
import { ContainerExecModal } from './ContainerExecModal';

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

  // Crash Dump Modal
  const [crashDumpModal, setCrashDumpModal] = useState<ContainerCrashDump | null>(null);
  const [loadingCrashDump, setLoadingCrashDump] = useState(false);

  // Exec Terminal Modal
  const [execModal, setExecModal] = useState<{ id: string; name: string } | null>(null);

  // Smart Prune Modal
  const [pruneModalOpen, setPruneModalOpen] = useState(false);
  const [prunePreview, setPrunePreview] = useState<DockerPrunePreviewResponse | null>(null);
  const [loadingPrunePreview, setLoadingPrunePreview] = useState(false);
  const [pruneExecuting, setPruneExecuting] = useState(false);
  const [pruneResult, setPruneResult] = useState<{ success: boolean; output: string } | null>(null);

  const [pruneOptions, setPruneOptions] = useState({
    pruneImages: true,
    pruneContainers: true,
    pruneVolumes: false,
    pruneBuildCache: true,
  });

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

  const handleOpenCrashDump = async (containerId: string) => {
    if (!selectedHost) return;
    setLoadingCrashDump(true);
    try {
      const dump = await api.docker.crashDump(selectedHost.id, containerId);
      setCrashDumpModal(dump);
    } catch (err: any) {
      alert(`Crash Dump retrieval error: ${err.message}`);
    } finally {
      setLoadingCrashDump(false);
    }
  };

  const handleOpenSmartPrune = async () => {
    if (!selectedHost) return;
    setPruneModalOpen(true);
    setPruneResult(null);
    setLoadingPrunePreview(true);
    try {
      const preview = await api.docker.prunePreview(selectedHost.id);
      setPrunePreview(preview);
    } catch (err: any) {
      alert(`Failed to load prune preview: ${err.message}`);
    } finally {
      setLoadingPrunePreview(false);
    }
  };

  const handleExecutePrune = async () => {
    if (!selectedHost) return;
    setPruneExecuting(true);
    try {
      const res = await api.docker.pruneExecute(selectedHost.id, pruneOptions);
      setPruneResult({
        success: res.success,
        output: res.output || (res.success ? 'System prune completed successfully.' : (res.error || 'Prune failed.')),
      });
      fetchContainers();
    } catch (err: any) {
      setPruneResult({
        success: false,
        output: err.message || 'Prune execution failed.',
      });
    } finally {
      setPruneExecuting(false);
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

        <div className="flex items-center gap-2">
          {/* Smart Prune Button */}
          <button
            onClick={handleOpenSmartPrune}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 hover:border-dorito-500 text-xs font-mono font-medium text-carbon-200 transition-colors"
            title="Clean unused Docker resources with reclaim preview"
          >
            <Scissors className="w-3.5 h-3.5 text-dorito-400" />
            <span>Smart Prune</span>
          </button>

          <button
            onClick={fetchContainers}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-mono font-medium text-carbon-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-dorito-500' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
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
            const isOom = !!c.isOOMKilled;
            const isCrashed = !!c.isCrashed && !isOom;

            return (
              <div
                key={c.id}
                className={`rounded-xl bg-carbon-900 border p-4 shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isOom || isCrashed
                    ? 'border-rose-500/50 hover:border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.08)]'
                    : 'border-carbon-700 hover:border-dorito-500/50'
                }`}
              >
                {/* Left info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1">
                    {/* Status / Crash / OOM badges */}
                    {isOom ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase tracking-wider bg-rose-950/90 text-rose-300 border border-rose-500/80 flex items-center gap-1 shadow-sm animate-pulse">
                        <Flame className="w-3 h-3 text-rose-400" />
                        <span>OOM-KILLED</span>
                      </span>
                    ) : isCrashed ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-950/60 text-rose-400 border border-rose-500/50 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        <span>CRASHED {c.exitCode !== undefined ? `(code ${c.exitCode})` : ''}</span>
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase tracking-wider border ${
                          isRunning
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-carbon-800 text-carbon-400 border-carbon-700'
                        }`}
                      >
                        {c.state}
                      </span>
                    )}

                    <h3 className="text-sm sm:text-base font-bold text-white truncate font-sans">{c.names}</h3>
                    <span className="text-[11px] font-mono text-carbon-400 bg-carbon-850 border border-carbon-700 px-2 py-0.5 rounded-none">
                      {c.id.substring(0, 12)}
                    </span>

                    {/* View Crash Dump Button if container crashed or OOMKilled */}
                    {(isOom || isCrashed) && (
                      <button
                        onClick={() => handleOpenCrashDump(c.id)}
                        className="px-2.5 py-0.5 rounded-md bg-rose-900/30 hover:bg-rose-900/50 border border-rose-500/40 text-rose-300 text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors"
                        title="View Crash Dump and Diagnostics"
                      >
                        <Flame className="w-3 h-3 text-rose-400" />
                        <span>View Crash Dump</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-carbon-400 truncate mb-1.5 font-mono">{c.image}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-carbon-400 font-mono">
                    {c.ports && <span className="truncate text-dorito-400">Ports: {c.ports}</span>}
                    <span>Status: {c.status}</span>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0 font-mono">
                  {/* TASK 5: In-Browser Docker Exec Terminal Button */}
                  <button
                    onClick={() => setExecModal({ id: c.id, name: c.names })}
                    className="p-2 rounded-lg bg-carbon-850 hover:bg-dorito-500/20 text-carbon-300 hover:text-dorito-400 border border-carbon-700 transition-colors"
                    title="Interactive Exec Terminal (/bin/sh)"
                  >
                    <Terminal className="w-4 h-4 text-dorito-400" />
                  </button>

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

      {/* TASK 4: CONTAINER CRASH DUMP MODAL */}
      {crashDumpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-carbon-900 border border-rose-500/60 rounded-2xl shadow-2xl p-6 relative flex flex-col h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-400">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base font-sans">
                      Crash Dump: {crashDumpModal.name}
                    </h3>
                    <span className="text-xs font-mono text-carbon-400">
                      ({crashDumpModal.containerId.substring(0, 12)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                        crashDumpModal.oomKilled
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/80 animate-pulse'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-500/50'
                      }`}
                    >
                      {crashDumpModal.oomKilled ? 'OOM-KILLED (KERNEL KILL)' : `EXIT CODE ${crashDumpModal.exitCode}`}
                    </span>
                    {crashDumpModal.finishedAt && (
                      <span className="text-[11px] font-mono text-carbon-400">
                        Terminated at: {crashDumpModal.finishedAt}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setCrashDumpModal(null)}
                className="p-1.5 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner */}
            {crashDumpModal.oomKilled && (
              <div className="mb-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs font-mono text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Out of Memory (OOM) Killer detected:</span> The Linux kernel terminated this container process because it exceeded its allocated memory limit or the host ran out of RAM.
                </div>
              </div>
            )}

            {crashDumpModal.error && (
              <div className="mb-3 p-3 rounded-xl bg-carbon-850 border border-rose-500/30 text-xs font-mono text-rose-300">
                <span className="font-bold text-rose-400 block mb-0.5">Daemon Error:</span>
                {crashDumpModal.error}
              </div>
            )}

            {/* Console logs */}
            <div className="flex items-center justify-between text-xs font-mono text-carbon-400 mb-2">
              <span>Last 50 lines before termination:</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(crashDumpModal.logs);
                  alert('Logs copied to clipboard');
                }}
                className="flex items-center gap-1 text-dorito-400 hover:text-dorito-300"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Logs</span>
              </button>
            </div>

            <pre className="flex-1 overflow-auto bg-black/90 p-4 rounded-xl font-mono text-xs text-rose-200 whitespace-pre-wrap break-all leading-relaxed select-text border border-carbon-700">
              {crashDumpModal.logs || 'No log output captured prior to crash.'}
            </pre>

            {/* Actions */}
            <div className="pt-3 border-t border-carbon-700 mt-4 flex items-center justify-between font-mono text-xs">
              <button
                onClick={() => {
                  handleAction(crashDumpModal.containerId, 'restart');
                  setCrashDumpModal(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-400 text-carbon-950 font-bold shadow-md"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Restart Container</span>
              </button>

              <button
                onClick={() => setCrashDumpModal(null)}
                className="px-4 py-2 rounded-xl bg-carbon-850 hover:bg-carbon-800 text-carbon-300 border border-carbon-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TASK 3: SMART DOCKER PRUNE PREVIEW MODAL */}
      {pruneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-carbon-850 border border-carbon-700 text-dorito-400">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base font-sans">Smart Docker Prune</h3>
                  <p className="text-xs text-carbon-400 font-mono">
                    Preview reclaimable disk space on {selectedHost.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPruneModalOpen(false)}
                className="p-1.5 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 font-mono text-xs pr-1">
              {loadingPrunePreview ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3 text-carbon-400">
                  <Loader2 className="w-8 h-8 animate-spin text-dorito-500" />
                  <span>Analyzing Docker system storage usage...</span>
                </div>
              ) : pruneResult ? (
                <div className="space-y-3">
                  <div
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                      pruneResult.success
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {pruneResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm">
                        {pruneResult.success ? 'System Cleanup Successful' : 'Prune Encountered Errors'}
                      </h4>
                      <p className="text-xs mt-1 text-carbon-300">
                        {pruneResult.success
                          ? 'Unused Docker resources were safely reclaimed.'
                          : 'Review the cleanup output below.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-carbon-400 uppercase font-semibold mb-1 block">
                      Prune Output:
                    </label>
                    <pre className="p-3 rounded-xl bg-black/90 border border-carbon-700 text-carbon-200 overflow-x-auto text-[11px] whitespace-pre-wrap max-h-60">
                      {pruneResult.output}
                    </pre>
                  </div>
                </div>
              ) : prunePreview ? (
                <div className="space-y-4">
                  {/* Total Reclaimable Banner */}
                  <div className="p-4 rounded-xl bg-carbon-850 border border-carbon-700 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-carbon-400 block uppercase">
                        Total Reclaimable Space
                      </span>
                      <span className="text-xl font-bold text-dorito-400 font-sans">
                        {prunePreview.totalReclaimable}
                      </span>
                    </div>
                    <HardDrive className="w-8 h-8 text-carbon-600" />
                  </div>

                  {/* Breakdown by categories with checkboxes */}
                  <div className="space-y-2">
                    {prunePreview.categories.map((cat) => {
                      const isImg = cat.type.toLowerCase().includes('image');
                      const isCnt = cat.type.toLowerCase().includes('container');
                      const isVol = cat.type.toLowerCase().includes('volume');
                      const isBld = cat.type.toLowerCase().includes('cache');

                      const isChecked = isImg
                        ? pruneOptions.pruneImages
                        : isCnt
                        ? pruneOptions.pruneContainers
                        : isVol
                        ? pruneOptions.pruneVolumes
                        : isBld
                        ? pruneOptions.pruneBuildCache
                        : true;

                      const handleToggle = () => {
                        if (isImg) setPruneOptions((p) => ({ ...p, pruneImages: !p.pruneImages }));
                        if (isCnt) setPruneOptions((p) => ({ ...p, pruneContainers: !p.pruneContainers }));
                        if (isVol) setPruneOptions((p) => ({ ...p, pruneVolumes: !p.pruneVolumes }));
                        if (isBld) setPruneOptions((p) => ({ ...p, pruneBuildCache: !p.pruneBuildCache }));
                      };

                      return (
                        <div
                          key={cat.type}
                          onClick={handleToggle}
                          className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-carbon-850/80 border-dorito-500/50'
                              : 'bg-carbon-900 border-carbon-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={handleToggle}
                              className="rounded border-carbon-600 text-dorito-500 focus:ring-dorito-500 w-4 h-4"
                            />
                            <div>
                              <h4 className="font-bold text-white text-sm font-sans">{cat.type}</h4>
                              <p className="text-[11px] text-carbon-400">
                                Total: {cat.totalCount} • Active: {cat.activeCount} • Current Size: {cat.size}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-carbon-500 block">Reclaimable</span>
                            <span className="text-xs font-bold text-dorito-400">{cat.reclaimable}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {pruneOptions.pruneVolumes && (
                    <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Caution: Pruning volumes removes all local volumes not used by at least one container.
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-carbon-700 mt-4 flex items-center justify-end gap-3 font-mono text-xs">
              {pruneResult ? (
                <button
                  onClick={() => setPruneModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-400 text-carbon-950 font-bold"
                >
                  Done
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setPruneModalOpen(false)}
                    disabled={pruneExecuting}
                    className="px-4 py-2 rounded-xl bg-carbon-850 hover:bg-carbon-800 text-carbon-300 border border-carbon-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecutePrune}
                    disabled={
                      pruneExecuting ||
                      (!pruneOptions.pruneImages &&
                        !pruneOptions.pruneContainers &&
                        !pruneOptions.pruneVolumes &&
                        !pruneOptions.pruneBuildCache)
                    }
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-400 disabled:opacity-50 text-carbon-950 font-bold shadow-lg"
                  >
                    {pruneExecuting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-carbon-950" />
                        <span>Reclaiming Storage...</span>
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4" />
                        <span>Execute Cleanup</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TASK 5: IN-BROWSER DOCKER EXEC TERMINAL MODAL */}
      {execModal && (
        <ContainerExecModal
          isOpen={!!execModal}
          onClose={() => setExecModal(null)}
          host={selectedHost}
          containerId={execModal.id}
          containerName={execModal.name}
        />
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
            <pre className="flex-1 overflow-auto bg-black/90 p-4 rounded-xl font-mono text-xs text-dorito-200 whitespace-pre-wrap break-all leading-relaxed select-text border border-carbon-700">
              {logsModal.content}
            </pre>
          </div>
        </div>
      )}

      {/* Inspect Modal */}
      {inspectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-5 relative flex flex-col h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-3">
              <div>
                <h3 className="font-bold text-white text-base font-sans">Inspect: {inspectModal.name}</h3>
                <span className="text-xs text-dorito-400 font-mono">{inspectModal.id.substring(0, 12)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inspectModal.rawJson);
                    setCopiedInspect(true);
                    setTimeout(() => setCopiedInspect(false), 2000);
                  }}
                  className="p-1.5 rounded-lg bg-carbon-850 text-carbon-300 hover:text-white border border-carbon-700"
                  title="Copy JSON"
                >
                  {copiedInspect ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setInspectModal(null)}
                  className="p-1.5 rounded-lg text-carbon-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto space-y-4 font-mono text-xs pr-1">
              <div className="grid grid-cols-2 gap-3 bg-carbon-850 p-3 rounded-xl border border-carbon-700">
                <div>
                  <span className="text-carbon-400 block text-[11px]">Image:</span>
                  <span className="text-white truncate block">{inspectModal.image}</span>
                </div>
                <div>
                  <span className="text-carbon-400 block text-[11px]">Status / State:</span>
                  <span className="text-white block">{inspectModal.status}</span>
                </div>
                <div>
                  <span className="text-carbon-400 block text-[11px]">Restart Policy:</span>
                  <span className="text-white block">{inspectModal.restartPolicy}</span>
                </div>
                <div>
                  <span className="text-carbon-400 block text-[11px]">Created:</span>
                  <span className="text-white block">{new Date(inspectModal.created).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <h4 className="text-carbon-400 uppercase font-semibold mb-1 text-[11px]">Ports:</h4>
                <div className="p-2.5 rounded-lg bg-carbon-850 border border-carbon-700 space-y-1">
                  {inspectModal.ports.length === 0 ? (
                    <span className="italic text-carbon-500">None</span>
                  ) : (
                    inspectModal.ports.map((p, i) => <div key={i}>{p}</div>)
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-carbon-400 uppercase font-semibold mb-1 text-[11px]">Mounts:</h4>
                <div className="p-2.5 rounded-lg bg-carbon-850 border border-carbon-700 space-y-1">
                  {inspectModal.mounts.length === 0 ? (
                    <span className="italic text-carbon-500">None</span>
                  ) : (
                    inspectModal.mounts.map((m, i) => <div key={i}>{m}</div>)
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-carbon-400 uppercase font-semibold mb-1 text-[11px]">Environment:</h4>
                <div className="p-2.5 rounded-lg bg-carbon-850 border border-carbon-700 space-y-1 max-h-40 overflow-y-auto">
                  {inspectModal.env.length === 0 ? (
                    <span className="italic text-carbon-500">None</span>
                  ) : (
                    inspectModal.env.map((e, i) => <div key={i}>{e}</div>)
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-carbon-400 uppercase font-semibold mb-1 text-[11px]">Raw JSON:</h4>
                <pre className="p-3 rounded-lg bg-black/90 border border-carbon-700 overflow-x-auto text-[11px]">
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
