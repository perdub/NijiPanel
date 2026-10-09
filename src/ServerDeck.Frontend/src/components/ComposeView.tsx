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
  X,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
  Network,
  Layers,
  ArrowRight,
  HardDrive,
  KeyRound,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Plus,
  Save,
  Check,
  Code2,
  Loader2
} from 'lucide-react';
import { Host, ComposeProject, ComposeStackDetail, ComposeServiceDetail } from '../types';
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

  // Visual Studio / Graph Mode
  const [studioStack, setStudioStack] = useState<ComposeStackDetail | null>(null);
  const [loadingStudio, setLoadingStudio] = useState(false);
  const [studioActiveTab, setStudioActiveTab] = useState<'graph' | 'yaml'>('graph');
  const [yamlEditorContent, setYamlEditorContent] = useState('');
  const [savingYaml, setSavingYaml] = useState(false);

  // Validation State
  const [validating, setValidating] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    filePath: string;
    valid: boolean;
    output: string;
    error?: string;
  } | null>(null);

  // Service Edit Drawer/Modal inside Studio
  const [selectedService, setSelectedService] = useState<ComposeServiceDetail | null>(null);

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
      if (studioStack && studioStack.filePath === filePath) {
        openVisualStudio(filePath);
      }
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

  const handleValidate = async (filePath: string) => {
    if (!selectedHost) return;
    setValidating(filePath);
    try {
      const res = await api.compose.validate(selectedHost.id, { filePath });
      setValidationResult({
        filePath,
        valid: res.valid,
        output: res.output || 'Compose configuration dry-run verified successfully.',
        error: res.error,
      });
    } catch (err: any) {
      setValidationResult({
        filePath,
        valid: false,
        output: '',
        error: err.message,
      });
    } finally {
      setValidating(null);
    }
  };

  const openVisualStudio = async (filePath: string) => {
    if (!selectedHost) return;
    setLoadingStudio(true);
    try {
      const details = await api.compose.details(selectedHost.id, filePath);
      setStudioStack(details);
      setYamlEditorContent(details.rawYaml);
      setStudioActiveTab('graph');
    } catch (err: any) {
      alert(`Failed to load stack details: ${err.message}`);
    } finally {
      setLoadingStudio(false);
    }
  };

  const handleSaveYaml = async () => {
    if (!selectedHost || !studioStack) return;
    setSavingYaml(true);
    try {
      await api.files.write(selectedHost.id, studioStack.filePath, yamlEditorContent);
      // Re-load details
      const updated = await api.compose.details(selectedHost.id, studioStack.filePath);
      setStudioStack(updated);
      alert('docker-compose.yml saved successfully.');
    } catch (err: any) {
      alert(`Failed to save YAML: ${err.message}`);
    } finally {
      setSavingYaml(false);
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
            <h1 className="text-lg font-bold text-white tracking-tight">Docker Compose</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-semibold">
              STUDIO & ORCHESTRATION
            </span>
          </div>
          <p className="text-xs sm:text-sm text-carbon-400 mt-1 font-mono">
            Visual topology, stack validation, and orchestration on {selectedHost.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {studioStack && (
            <button
              onClick={() => setStudioStack(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-mono text-carbon-300 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Stacks</span>
            </button>
          )}

          <button
            onClick={fetchProjects}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-mono font-medium text-carbon-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-dorito-500' : ''}`} />
            <span>Scan Stacks</span>
          </button>
        </div>
      </div>

      {/* VISUAL STUDIO VIEW (when stack selected) */}
      {studioStack ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Studio Subheader Toolbar */}
          <div className="rounded-2xl bg-carbon-900 border border-carbon-700 p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-dorito-500 shadow-[0_0_8px_rgba(255,209,0,0.6)]" />
                <h2 className="text-lg font-bold text-white font-sans">{studioStack.projectName}</h2>
                <span className="text-xs font-mono text-carbon-400 bg-carbon-850 px-2 py-0.5 rounded border border-carbon-700">
                  {studioStack.services.length} Services
                </span>
              </div>
              <p className="text-xs text-carbon-400 font-mono mt-1 truncate">{studioStack.filePath}</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
              {/* Tab Toggle: Visual Graph vs Raw YAML */}
              <div className="flex items-center p-1 rounded-lg bg-carbon-850 border border-carbon-700">
                <button
                  onClick={() => setStudioActiveTab('graph')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                    studioActiveTab === 'graph'
                      ? 'bg-dorito-500 text-carbon-950 font-bold'
                      : 'text-carbon-400 hover:text-white'
                  }`}
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>Graph View</span>
                </button>
                <button
                  onClick={() => setStudioActiveTab('yaml')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                    studioActiveTab === 'yaml'
                      ? 'bg-dorito-500 text-carbon-950 font-bold'
                      : 'text-carbon-400 hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>YAML Studio</span>
                </button>
              </div>

              {/* Validate Compose Button */}
              <button
                onClick={() => handleValidate(studioStack.filePath)}
                disabled={validating === studioStack.filePath}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-200 border border-carbon-700 hover:border-dorito-500 transition-colors font-medium"
                title="Run docker compose config --dry-run validation"
              >
                {validating === studioStack.filePath ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-dorito-500" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Validate</span>
              </button>

              {/* Stack Actions */}
              <button
                onClick={() => handleAction(studioStack.filePath, studioStack.projectName, 'up')}
                disabled={runningAction === `${studioStack.filePath}-up`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Up</span>
              </button>

              <button
                onClick={() => handleAction(studioStack.filePath, studioStack.projectName, 'restart')}
                disabled={runningAction === `${studioStack.filePath}-restart`}
                className="p-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-dorito-400 border border-carbon-700"
                title="Restart Stack"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleLogs(studioStack.filePath, studioStack.projectName)}
                className="p-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-dorito-400 border border-carbon-700"
                title="Stack Logs"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* TAB 1: VISUAL GRAPH VIEW */}
          {studioActiveTab === 'graph' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {studioStack.services.map((srv) => {
                  const envEntries = Object.entries(srv.environment);
                  return (
                    <div
                      key={srv.name}
                      onClick={() => setSelectedService(srv)}
                      className="group rounded-2xl bg-carbon-900 border border-carbon-700 hover:border-dorito-500/70 p-5 shadow-lg transition-all flex flex-col justify-between cursor-pointer hover:shadow-[0_4px_24px_rgba(255,209,0,0.12)] relative"
                    >
                      <div>
                        {/* Service Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-carbon-850 border border-carbon-700 text-dorito-400">
                              <Layers className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-base tracking-tight font-sans group-hover:text-dorito-400 transition-colors">
                                {srv.name}
                              </h3>
                              <span className="text-[10px] font-mono text-carbon-400">
                                restart: {srv.restart || 'no'}
                              </span>
                            </div>
                          </div>

                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-carbon-850 text-carbon-400 border border-carbon-750">
                            Service Block
                          </span>
                        </div>

                        {/* Image */}
                        <div className="mb-3.5 p-2.5 rounded-xl bg-black/60 border border-carbon-800 font-mono text-xs text-dorito-300 truncate">
                          <span className="text-carbon-500 text-[10px] block uppercase">Image</span>
                          <span className="truncate">{srv.image || 'build / local'}</span>
                        </div>

                        {/* Bound Ports */}
                        {srv.ports.length > 0 && (
                          <div className="mb-3">
                            <span className="text-[10px] font-mono text-carbon-400 uppercase font-semibold flex items-center gap-1 mb-1">
                              <Network className="w-3 h-3 text-cyan-400" />
                              <span>Ports</span>
                            </span>
                            <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                              {srv.ports.map((p, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded bg-carbon-850 border border-carbon-700 text-cyan-400"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Mounted Volumes */}
                        {srv.volumes.length > 0 && (
                          <div className="mb-3">
                            <span className="text-[10px] font-mono text-carbon-400 uppercase font-semibold flex items-center gap-1 mb-1">
                              <HardDrive className="w-3 h-3 text-emerald-400" />
                              <span>Mounted Volumes ({srv.volumes.length})</span>
                            </span>
                            <div className="space-y-1 font-mono text-[11px]">
                              {srv.volumes.slice(0, 2).map((v, idx) => (
                                <div
                                  key={idx}
                                  className="px-2 py-0.5 rounded bg-carbon-850 border border-carbon-700 text-carbon-300 truncate"
                                  title={v}
                                >
                                  {v}
                                </div>
                              ))}
                              {srv.volumes.length > 2 && (
                                <span className="text-carbon-500 text-[10px] font-mono">
                                  +{srv.volumes.length - 2} more volumes
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Environment Variables */}
                        {envEntries.length > 0 && (
                          <div className="mb-3">
                            <span className="text-[10px] font-mono text-carbon-400 uppercase font-semibold flex items-center gap-1 mb-1">
                              <KeyRound className="w-3 h-3 text-amber-400" />
                              <span>Environment ({envEntries.length})</span>
                            </span>
                            <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                              {envEntries.slice(0, 3).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="px-2 py-0.5 rounded bg-carbon-850 text-carbon-400 border border-carbon-750 truncate max-w-[150px]"
                                  title={`${k}=${v}`}
                                >
                                  {k}
                                </span>
                              ))}
                              {envEntries.length > 3 && (
                                <span className="text-carbon-500 text-[10px]">+{envEntries.length - 3}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Dependencies: depends_on */}
                        {srv.dependsOn.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-carbon-800">
                            <span className="text-[10px] font-mono text-carbon-400 flex items-center gap-1">
                              <ArrowRight className="w-3 h-3 text-dorito-400" />
                              <span>depends on:</span>
                              {srv.dependsOn.map((d) => (
                                <span
                                  key={d}
                                  className="px-1.5 py-0.2 rounded bg-dorito-500/15 border border-dorito-500/30 text-dorito-400 font-bold"
                                >
                                  {d}
                                </span>
                              ))}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-carbon-800 flex items-center justify-between text-xs font-mono text-carbon-400 mt-3">
                        <span className="text-[11px] group-hover:text-dorito-400 transition-colors">
                          Click to inspect
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: RAW YAML STUDIO EDITOR */}
          {studioActiveTab === 'yaml' && (
            <div className="rounded-2xl bg-carbon-900 border border-carbon-700 p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-carbon-400">
                  Editing {studioStack.filePath}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleValidate(studioStack.filePath)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-200 border border-carbon-700 text-xs font-mono"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Dry-Run Check</span>
                  </button>
                  <button
                    onClick={handleSaveYaml}
                    disabled={savingYaml}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-400 text-carbon-950 font-bold text-xs font-mono"
                  >
                    {savingYaml ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save File</span>
                  </button>
                </div>
              </div>

              <textarea
                value={yamlEditorContent}
                onChange={(e) => setYamlEditorContent(e.target.value)}
                className="w-full h-[60vh] bg-black/90 text-carbon-200 font-mono text-xs p-4 rounded-xl border border-carbon-750 focus:outline-none focus:border-dorito-500 focus:ring-1 focus:ring-dorito-500 leading-relaxed resize-none"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      ) : (
        /* PROJECTS LIST VIEW */
        <div className="space-y-3">
          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-carbon-700 bg-carbon-900/60 p-12 text-center text-carbon-400">
              <FolderGit2 className="w-12 h-12 text-carbon-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No Compose projects discovered</h3>
              <p className="text-xs text-carbon-400 max-w-sm mx-auto mt-1 mb-4 font-mono">
                Standard paths (/opt, /home, /root, /var/www) were scanned. You can deploy applications from the App Store tab.
              </p>
            </div>
          ) : (
            projects.map((p) => (
              <div
                key={p.filePath}
                className="rounded-xl bg-carbon-900 border border-carbon-700 hover:border-dorito-500/50 p-4 sm:p-5 shadow-lg transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <span className="w-2.5 h-2.5 rounded-full bg-dorito-500 shadow-[0_0_8px_rgba(255,209,0,0.6)]" />
                    <h3 className="font-bold text-white text-base truncate font-sans">{p.name}</h3>
                    <span className="text-[10px] font-mono text-carbon-300 bg-carbon-850 px-2 py-0.5 rounded border border-carbon-700">
                      {p.services.length} services
                    </span>
                  </div>

                  <p className="text-xs text-carbon-400 font-mono truncate mb-2">{p.filePath}</p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.services.map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-carbon-850 text-dorito-400 text-[11px] font-mono border border-carbon-700/80"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stack Actions: Carbon style */}
                <div className="flex items-center gap-2 flex-wrap self-end md:self-auto shrink-0 font-mono text-xs">
                  {/* Visual Studio Button */}
                  <button
                    onClick={() => openVisualStudio(p.filePath)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dorito-500/15 hover:bg-dorito-500/25 text-dorito-400 border border-dorito-500/30 font-medium transition-colors"
                    title="Open Visual Topology Studio"
                  >
                    <Network className="w-3.5 h-3.5 text-dorito-400" />
                    <span>Visual Studio</span>
                  </button>

                  {/* Validate Compose Button */}
                  <button
                    onClick={() => handleValidate(p.filePath)}
                    disabled={validating === p.filePath}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-200 border border-carbon-700 hover:border-dorito-500 transition-colors font-medium"
                    title="Validate Compose configuration (dry-run)"
                  >
                    {validating === p.filePath ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-dorito-500" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>Validate</span>
                  </button>

                  <button
                    onClick={() => handleAction(p.filePath, p.name, 'up')}
                    disabled={runningAction === `${p.filePath}-up`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-medium transition-colors"
                    title="Start stack (up -d)"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Up</span>
                  </button>

                  <button
                    onClick={() => handleAction(p.filePath, p.name, 'down')}
                    disabled={runningAction === `${p.filePath}-down`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 font-medium transition-colors"
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
                    className="p-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-300 hover:text-dorito-400 border border-carbon-700 transition-colors"
                    title="Edit in Monaco File Manager"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SERVICE INSPECT MODAL */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
              <div>
                <h3 className="font-bold text-white text-lg font-sans">
                  Service: {selectedService.name}
                </h3>
                <span className="text-xs text-dorito-400 font-mono">
                  {selectedService.image || 'Image undefined'}
                </span>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-1.5 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 font-mono text-xs pr-1">
              <div>
                <h4 className="text-carbon-400 uppercase font-semibold mb-1 text-[11px]">
                  Restart Policy
                </h4>
                <div className="p-2.5 rounded-lg bg-carbon-850 border border-carbon-750 text-carbon-200">
                  {selectedService.restart}
                </div>
              </div>

              <div>
                <h4 className="text-carbon-400 uppercase font-semibold mb-1 text-[11px]">
                  Port Bindings
                </h4>
                <div className="p-2.5 rounded-lg bg-carbon-850 border border-carbon-750 text-carbon-200 space-y-1">
                  {selectedService.ports.length === 0 ? (
                    <span className="italic text-carbon-500">No ports published</span>
                  ) : (
                    selectedService.ports.map((p, i) => <div key={i}>{p}</div>)
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-carbon-400 uppercase font-semibold mb-1 text-[11px]">
                  Volumes
                </h4>
                <div className="p-2.5 rounded-lg bg-carbon-850 border border-carbon-750 text-carbon-200 space-y-1">
                  {selectedService.volumes.length === 0 ? (
                    <span className="italic text-carbon-500">No volumes mounted</span>
                  ) : (
                    selectedService.volumes.map((v, i) => <div key={i}>{v}</div>)
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-carbon-400 uppercase font-semibold mb-1 text-[11px]">
                  Environment
                </h4>
                <div className="p-2.5 rounded-lg bg-carbon-850 border border-carbon-750 text-carbon-200 space-y-1 max-h-48 overflow-y-auto">
                  {Object.entries(selectedService.environment).length === 0 ? (
                    <span className="italic text-carbon-500">No environment variables</span>
                  ) : (
                    Object.entries(selectedService.environment).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-dorito-400 shrink-0">{k}:</span>
                        <span className="text-carbon-300 truncate">{v}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedService.dependsOn.length > 0 && (
                <div>
                  <h4 className="text-carbon-400 uppercase font-semibold mb-1 text-[11px]">
                    Depends On
                  </h4>
                  <div className="flex gap-2">
                    {selectedService.dependsOn.map((d) => (
                      <span
                        key={d}
                        className="px-2 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-bold"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-carbon-700 mt-4 flex justify-end">
              <button
                onClick={() => setSelectedService(null)}
                className="px-4 py-2 rounded-xl bg-carbon-850 hover:bg-carbon-800 text-carbon-200 text-xs font-mono"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VALIDATION RESULT MODAL */}
      {validationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
              <div className="flex items-center gap-2.5">
                {validationResult.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                )}
                <div>
                  <h3 className="font-bold text-white text-base font-sans">
                    {validationResult.valid ? 'Compose Configuration Valid' : 'Compose Validation Failed'}
                  </h3>
                  <span className="text-xs text-carbon-400 font-mono truncate block max-w-md">
                    {validationResult.filePath}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setValidationResult(null)}
                className="p-1.5 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs">
              <div
                className={`p-3 rounded-xl border ${
                  validationResult.valid
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                }`}
              >
                {validationResult.valid
                  ? 'All services, networks, volumes, and syntax conform to Docker Compose specifications.'
                  : 'Errors were detected while checking Compose syntax with docker compose config --dry-run.'}
              </div>

              <div>
                <label className="text-[11px] text-carbon-400 uppercase font-semibold mb-1 block">
                  CLI Output:
                </label>
                <pre className="p-3 rounded-xl bg-black/90 border border-carbon-700 text-carbon-200 overflow-x-auto text-[11px] whitespace-pre-wrap max-h-72">
                  {validationResult.output || validationResult.error || 'No additional output.'}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-carbon-700 mt-4 flex justify-end">
              <button
                onClick={() => setValidationResult(null)}
                className="px-4 py-2 rounded-xl bg-carbon-850 hover:bg-carbon-800 text-carbon-200 text-xs font-mono"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Output Console Modal */}
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
