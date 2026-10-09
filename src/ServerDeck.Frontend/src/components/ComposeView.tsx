import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Play,
  Square,
  RotateCw,
  Download,
  FileText,
  Edit,
  RefreshCw,
  X
} from 'lucide-react';
import { Host, ComposeProject } from '../types';
import { api } from '../api';

interface ComposeViewProps {
  selectedHost: Host | null;
  onEditFile: (path: string) => void;
}

export const ComposeView: React.FC<ComposeViewProps> = ({ selectedHost, onEditFile }) => {
  const [projects, setProjects] = useState<ComposeProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPath, setSearchPath] = useState('');
  const [actionOutput, setActionOutput] = useState<{ title: string; output: string } | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const fetchProjects = async () => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const data = await api.compose.projects(selectedHost.id, searchPath || undefined);
      setProjects(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [selectedHost]);

  const handleAction = async (filePath: string, projectName: string, action: string) => {
    if (!selectedHost) return;
    if (action === 'down' && !confirm(`Stop and remove stack "${projectName}"?`)) return;

    setRunningAction(`${filePath}-${action}`);
    try {
      const res = await api.compose.action(selectedHost.id, filePath, action);
      setActionOutput({
        title: `Result: ${projectName} (${action})`,
        output: res.output || res.error || (res.success ? 'Command executed successfully.' : 'Execution failed.'),
      });
      fetchProjects();
    } catch (err: any) {
      setActionOutput({
        title: `Error: ${projectName}`,
        output: err.message,
      });
    } finally {
      setRunningAction(null);
    }
  };

  const handleLogs = async (filePath: string, projectName: string) => {
    if (!selectedHost) return;
    try {
      const { logs } = await api.compose.logs(selectedHost.id, filePath, 250);
      setActionOutput({
        title: `Stack Logs: ${projectName}`,
        output: logs || 'Logs are empty.',
      });
    } catch (err: any) {
      alert(`Failed to retrieve logs: ${err.message}`);
    }
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-carbon-400 font-mono">
        Select a host from the top navigation to manage Docker Compose
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-carbon-700/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Docker Compose</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-semibold">
              ORCHESTRATION
            </span>
          </div>
          <p className="text-xs sm:text-sm text-carbon-400 mt-1 font-mono">
            Application stack management and service orchestration on {selectedHost.name}
          </p>
        </div>

        <button
          onClick={fetchProjects}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-mono font-medium text-carbon-200 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-dorito-500' : ''}`} />
          <span>Scan Stacks</span>
        </button>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-carbon-700 bg-carbon-900/60 p-12 text-center text-carbon-400">
          <FolderGit2 className="w-12 h-12 text-carbon-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Compose projects discovered</h3>
          <p className="text-xs text-carbon-400 max-w-sm mx-auto mt-1 mb-4 font-mono">
            Standard paths (/opt, /home, /root, /var/www) were scanned. You can create a docker-compose.yml file in the File Manager tab.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            return (
              <div
                key={p.filePath}
                className="rounded-xl bg-carbon-900 border border-carbon-700 hover:border-dorito-500/50 p-4 sm:p-5 shadow-lg transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <span className="w-2.5 h-2.5 rounded-full bg-dorito-500 shadow-[0_0_8px_rgba(255,209,0,0.6)]" />
                    <h3 className="font-bold text-white text-base truncate font-sans">{p.name}</h3>
                    <span className="text-[10px] font-mono text-carbon-300 bg-carbon-850 px-2 py-0.5 rounded-none border border-carbon-700">
                      {p.services.length} services
                    </span>
                  </div>

                  <p className="text-xs text-carbon-400 font-mono truncate mb-2">{p.filePath}</p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.services.map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-none bg-carbon-850 text-dorito-400 text-[11px] font-mono border border-carbon-700/80"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stack Actions: Carbon buttons */}
                <div className="flex items-center gap-2 flex-wrap self-end md:self-auto shrink-0 font-mono text-xs">
                  <button
                    onClick={() => handleAction(p.filePath, p.name, 'up')}
                    disabled={runningAction === `${p.filePath}-up`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-colors"
                    title="Start stack (up -d)"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Up</span>
                  </button>

                  <button
                    onClick={() => handleAction(p.filePath, p.name, 'down')}
                    disabled={runningAction === `${p.filePath}-down`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors"
                    title="Stop stack (down)"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Down</span>
                  </button>

                  <button
                    onClick={() => handleAction(p.filePath, p.name, 'restart')}
                    disabled={runningAction === `${p.filePath}-restart`}
                    className="p-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-dorito-400 border border-carbon-700 transition-colors"
                    title="Restart stack"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleAction(p.filePath, p.name, 'pull')}
                    disabled={runningAction === `${p.filePath}-pull`}
                    className="p-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-dorito-400 border border-carbon-700 transition-colors"
                    title="Pull latest images"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleLogs(p.filePath, p.name)}
                    className="p-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-dorito-400 border border-carbon-700 transition-colors"
                    title="View stack logs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onEditFile(p.filePath)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dorito-500/15 hover:bg-dorito-500/25 text-dorito-400 border border-dorito-500/30 text-xs font-medium transition-colors"
                    title="Edit in Monaco Editor"
                  >
                    <Edit className="w-3.5 h-3.5 text-dorito-500" />
                    <span>Editor</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Output / Console Modal */}
      {actionOutput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-5 relative flex flex-col h-[75vh]">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-3">
              <h3 className="font-bold text-white text-base truncate font-sans">{actionOutput.title}</h3>
              <button
                onClick={() => setActionOutput(null)}
                className="p-1.5 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-black/90 p-4 rounded-xl font-mono text-xs text-dorito-200 whitespace-pre-wrap break-all leading-relaxed select-text border border-carbon-700">
              {actionOutput.output}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
