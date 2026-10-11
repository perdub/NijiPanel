import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  Play,
  RotateCw,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trash2,
  Filter,
  Terminal,
  Server,
  ChevronDown
} from 'lucide-react';
import { Host, ConnectionDiagnosticResult, ConnectionLogEntry } from '../types';
import { api } from '../api';

interface ConnectionDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  host: Host | null;
  allHosts?: Host[];
  onSelectHost?: (host: Host) => void;
}

export const ConnectionDiagnosticsModal: React.FC<ConnectionDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  host: initialHost,
  allHosts = [],
  onSelectHost,
}) => {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'logs'>('diagnostics');
  const [currentHost, setCurrentHost] = useState<Host | null>(initialHost);
  const [diagnosticResult, setDiagnosticResult] = useState<ConnectionDiagnosticResult | null>(null);
  const [runningDiag, setRunningDiag] = useState(false);
  const [logs, setLogs] = useState<ConnectionLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'ERROR' | 'INFO' | 'SUCCESS'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setCurrentHost(initialHost);
    setDiagnosticResult(null);
  }, [initialHost]);

  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === 'logs') {
      fetchLogs();
    } else if (activeTab === 'diagnostics' && currentHost && !diagnosticResult && !runningDiag) {
      runDiagnostics();
    }
  }, [isOpen, activeTab, currentHost?.id]);

  const runDiagnostics = async () => {
    if (!currentHost) return;
    setRunningDiag(true);
    setDiagnosticResult(null);
    try {
      const res = await api.hosts.diagnose(currentHost.id);
      setDiagnosticResult(res);
    } catch (err: any) {
      setDiagnosticResult({
        success: false,
        latencyMs: 0,
        steps: [
          {
            name: 'API Request',
            status: 'failed',
            message: err.message || 'Diagnostic request failed',
            durationMs: 0,
          },
        ],
        error: err.message || 'Diagnostic probe failed',
        suggestion: 'Check if NijiPanel backend is reachable.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setRunningDiag(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.hosts.getLogs(currentHost?.id, 150);
      setLogs(res || []);
    } catch (err) {
      console.error('Failed to fetch connection logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm(currentHost ? `Clear logs for host "${currentHost.name}"?` : 'Clear all connection logs across all hosts?')) {
      return;
    }
    try {
      await api.hosts.clearLogs(currentHost?.id);
      setLogs([]);
    } catch (err: any) {
      alert(`Failed to clear logs: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredLogs = logs.filter((l) => {
    if (logFilter !== 'all' && l.level !== logFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.message.toLowerCase().includes(q) ||
      l.event.toLowerCase().includes(q) ||
      l.hostName.toLowerCase().includes(q) ||
      (l.details && l.details.toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0a0a0a] border border-carbon-700 shadow-2xl overflow-hidden rounded-none">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-carbon-800 bg-[#111111] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-carbon-900 border border-carbon-700 text-dorito-400">
              <Activity className="w-4 h-4 text-dorito-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white tracking-tight font-sans">
                  Connection Diagnostics & Logs
                </h2>
                {currentHost && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-carbon-900 border border-carbon-700 text-carbon-300">
                    {currentHost.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-carbon-400 font-mono">
                {currentHost
                  ? `${currentHost.username}@${currentHost.host}:${currentHost.port} (${currentHost.authType})`
                  : 'Fleet-wide connection event audit stream'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {allHosts.length > 0 && (
              <div className="relative">
                <select
                  value={currentHost?.id || 'all'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'all') {
                      setCurrentHost(null);
                      setActiveTab('logs');
                    } else {
                      const found = allHosts.find((h) => h.id === val);
                      if (found) {
                        setCurrentHost(found);
                        onSelectHost?.(found);
                      }
                    }
                  }}
                  className="bg-carbon-900 border border-carbon-700 text-carbon-300 text-xs px-2.5 py-1.5 font-mono focus:outline-none focus:border-dorito-500 rounded-none cursor-pointer"
                >
                  <option value="all">All Hosts (Fleet Logs)</option>
                  {allHosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.host})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-carbon-400 hover:text-white hover:bg-carbon-800 transition-colors rounded-none"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & Action Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-carbon-800 bg-[#0d0d0d] shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('diagnostics')}
              disabled={!currentHost}
              className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors border ${
                activeTab === 'diagnostics'
                  ? 'bg-carbon-800 text-white border-carbon-600'
                  : 'text-carbon-400 hover:text-white border-transparent'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Live Diagnostics
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1.5 text-xs font-mono font-medium transition-colors border flex items-center gap-1.5 ${
                activeTab === 'logs'
                  ? 'bg-carbon-800 text-white border-carbon-600'
                  : 'text-carbon-400 hover:text-white border-transparent'
              }`}
            >
              <span>Connection Logs</span>
              {logs.length > 0 && (
                <span className="px-1 py-0.2 text-[10px] bg-carbon-900 border border-carbon-700 text-carbon-300">
                  {logs.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'diagnostics' && currentHost && (
              <button
                onClick={runDiagnostics}
                disabled={runningDiag}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium bg-dorito-500 hover:bg-dorito-600 text-black transition-colors disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${runningDiag ? 'animate-spin' : ''}`} />
                <span>{runningDiag ? 'Diagnosing...' : 'Run Diagnostics'}</span>
              </button>
            )}

            {activeTab === 'logs' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchLogs}
                  disabled={loadingLogs}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-carbon-900 hover:bg-carbon-800 border border-carbon-700 text-carbon-300 transition-colors"
                  title="Refresh logs"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                <button
                  onClick={() => {
                    const text = logs
                      .map((l) => `[${l.timestamp}] [${l.level}] [${l.hostName}] [${l.event}]: ${l.message} ${l.details || ''}`)
                      .join('\n');
                    copyToClipboard(text, 'all-logs');
                  }}
                  disabled={logs.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-carbon-900 hover:bg-carbon-800 border border-carbon-700 text-carbon-300 transition-colors disabled:opacity-50"
                  title="Copy all logs"
                >
                  {copiedKey === 'all-logs' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copiedKey === 'all-logs' ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={handleClearLogs}
                  disabled={logs.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-carbon-900 hover:bg-carbon-800 border border-carbon-700 text-rose-400 transition-colors disabled:opacity-50"
                  title="Clear log buffer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-mono text-xs">
          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              {/* Target info card */}
              <div className="p-3 bg-[#0d0d0d] border border-carbon-800 flex flex-wrap items-center justify-between gap-3 text-carbon-300">
                <div className="flex items-center gap-3">
                  <Server className="w-4 h-4 text-dorito-500" />
                  <div>
                    <span className="text-white font-semibold font-sans">{currentHost?.name}</span>
                    <span className="text-carbon-500 ml-2">
                      ({currentHost?.username}@{currentHost?.host}:{currentHost?.port})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-carbon-500">Auth:</span>
                  <span className="px-1.5 py-0.5 bg-carbon-900 border border-carbon-700 text-carbon-300 uppercase">
                    {currentHost?.authType}
                  </span>
                </div>
              </div>

              {/* Status Banner */}
              {runningDiag && (
                <div className="p-4 bg-carbon-900/50 border border-carbon-700 flex items-center gap-3 text-carbon-300 animate-pulse">
                  <RotateCw className="w-5 h-5 text-dorito-500 animate-spin shrink-0" />
                  <div>
                    <div className="font-semibold text-white">Running live connection probe...</div>
                    <div className="text-[11px] text-carbon-400 mt-0.5">
                      Testing DNS, TCP socket, SSH handshake, authentication, and execution environment
                    </div>
                  </div>
                </div>
              )}

              {!runningDiag && diagnosticResult && (
                <div>
                  <div
                    className={`p-4 border flex items-start gap-3 ${
                      diagnosticResult.success
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {diagnosticResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">
                          {diagnosticResult.success ? 'Connection Diagnostics Passed' : 'Connection Failed'}
                        </span>
                        <span className="text-[11px] font-mono opacity-80">
                          {diagnosticResult.latencyMs} ms
                        </span>
                      </div>
                      <p className="text-xs mt-1 text-carbon-200">
                        {diagnosticResult.error ||
                          diagnosticResult.suggestion ||
                          'Server is reachable and responding correctly to SSH commands.'}
                      </p>

                      {diagnosticResult.serverBanner && (
                        <div className="mt-2 text-[11px] text-carbon-400 font-mono">
                          Remote SSH banner: <span className="text-white">{diagnosticResult.serverBanner}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Suggestion Card if Failed */}
                  {!diagnosticResult.success && diagnosticResult.suggestion && (
                    <div className="mt-3 p-3.5 bg-carbon-900 border border-carbon-700/80 text-carbon-300">
                      <div className="flex items-center gap-2 text-dorito-400 font-semibold mb-1">
                        <HelpCircle className="w-4 h-4" />
                        <span>Recommended Troubleshooting Steps</span>
                      </div>
                      <p className="text-xs text-carbon-300 leading-relaxed">
                        {diagnosticResult.suggestion}
                      </p>
                    </div>
                  )}

                  {/* Step Breakdown Cards */}
                  <div className="mt-4 space-y-2">
                    <div className="text-[11px] uppercase tracking-wider text-carbon-500 font-semibold px-1">
                      Step-by-Step Diagnostic Breakdown
                    </div>
                    {diagnosticResult.steps.map((step, idx) => {
                      const isPassed = step.status === 'passed';
                      const isFailed = step.status === 'failed';
                      const isWarn = step.status === 'warning';

                      return (
                        <div
                          key={idx}
                          className="p-3 bg-[#0c0c0c] border border-carbon-800 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5">
                            {isPassed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : isFailed ? (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            ) : isWarn ? (
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <HelpCircle className="w-4 h-4 text-carbon-500 shrink-0" />
                            )}
                            <div>
                              <div className="text-white font-medium text-xs">{step.name}</div>
                              <div className="text-[11px] text-carbon-400 mt-0.5">{step.message}</div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`text-[10px] uppercase font-mono px-1.5 py-0.5 border ${
                                isPassed
                                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                                  : isFailed
                                  ? 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                                  : 'bg-amber-950/40 text-amber-400 border-amber-800/40'
                              }`}
                            >
                              {step.status}
                            </span>
                            <div className="text-[10px] text-carbon-500 mt-1">{step.durationMs} ms</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => {
                        const report = `[NijiPanel Diagnostic Report]
Host: ${currentHost?.name} (${currentHost?.host}:${currentHost?.port})
Auth: ${currentHost?.authType}
Status: ${diagnosticResult.success ? 'PASSED' : 'FAILED'}
Latency: ${diagnosticResult.latencyMs} ms
Error: ${diagnosticResult.error || 'none'}
Banner: ${diagnosticResult.serverBanner || 'none'}
Steps:
${diagnosticResult.steps.map((s) => ` - [${s.status.toUpperCase()}] ${s.name}: ${s.message} (${s.durationMs}ms)`).join('\n')}`;
                        copyToClipboard(report, 'diag-report');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-carbon-300 hover:text-white transition-colors"
                    >
                      {copiedKey === 'diag-report' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'diag-report' ? 'Report Copied' : 'Copy Diagnostic Report'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              {/* Filter controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[#0d0d0d] border border-carbon-800">
                <div className="flex items-center gap-1">
                  {(['all', 'ERROR', 'WARN', 'SUCCESS', 'INFO'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setLogFilter(lvl as any)}
                      className={`px-2 py-1 text-[11px] font-mono border transition-colors ${
                        logFilter === lvl
                          ? 'bg-carbon-800 text-white border-carbon-600'
                          : 'text-carbon-400 hover:text-white border-transparent'
                      }`}
                    >
                      {lvl.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="bg-black border border-carbon-700 px-2.5 py-1 text-xs text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 font-mono w-44"
                  />
                </div>
              </div>

              {/* Logs terminal box */}
              <div className="bg-[#050505] border border-carbon-800 p-3 min-h-[320px] max-h-[500px] overflow-y-auto space-y-1.5 font-mono text-[11px] select-text">
                {loadingLogs && (
                  <div className="py-8 text-center text-carbon-500 animate-pulse">
                    Loading connection logs...
                  </div>
                )}

                {!loadingLogs && filteredLogs.length === 0 && (
                  <div className="py-12 text-center text-carbon-500">
                    No connection log events recorded yet. Run diagnostics or refresh host status.
                  </div>
                )}

                {!loadingLogs &&
                  filteredLogs.map((entry) => {
                    const isError = entry.level === 'ERROR';
                    const isSuccess = entry.level === 'SUCCESS';
                    const isWarn = entry.level === 'WARN';

                    const timeStr = new Date(entry.timestamp).toLocaleTimeString();

                    return (
                      <div
                        key={entry.id}
                        className="py-1 px-1.5 hover:bg-carbon-900/60 border-l-2 transition-colors flex flex-col gap-0.5"
                        style={{
                          borderLeftColor: isError
                            ? '#f43f5e'
                            : isSuccess
                            ? '#10b981'
                            : isWarn
                            ? '#f59e0b'
                            : '#06b6d4',
                        }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-carbon-500">[{timeStr}]</span>

                          <span
                            className={`font-semibold px-1 py-0.2 text-[10px] ${
                              isError
                                ? 'text-rose-400 bg-rose-950/40'
                                : isSuccess
                                ? 'text-emerald-400 bg-emerald-950/40'
                                : isWarn
                                ? 'text-amber-400 bg-amber-950/40'
                                : 'text-cyan-400 bg-cyan-950/40'
                            }`}
                          >
                            [{entry.level}]
                          </span>

                          <span className="text-dorito-400/90 font-medium">
                            [{entry.event}]
                          </span>

                          {!currentHost && (
                            <span className="text-carbon-400 bg-carbon-900 px-1 text-[10px]">
                              {entry.hostName}
                            </span>
                          )}

                          <span className="text-carbon-200 break-all">{entry.message}</span>
                        </div>

                        {entry.details && (
                          <div className="text-[10px] text-carbon-400 pl-4 font-mono break-all bg-black/40 p-1 border-l border-carbon-800 mt-0.5">
                            {entry.details}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-t border-carbon-800 bg-[#0d0d0d] shrink-0 text-carbon-500 text-[11px] font-mono">
          <span>IBM Carbon 0px Rule • Agentless SSH Diagnostics</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-carbon-300 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
