import React, { useState, useEffect } from 'react';
import { Host, CronJobItem, CronExecutionResult } from '../types';
import { api } from '../api';
import {
  Clock,
  Play,
  Plus,
  Trash2,
  Edit2,
  FileCode,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Terminal,
  ToggleLeft,
  ToggleRight,
  Copy,
  Check
} from 'lucide-react';

interface CronViewProps {
  hosts: Host[];
  selectedHost: Host | null;
  onSelectHost: (host: Host) => void;
}

const PRESETS = [
  { label: 'Every 5 min', value: '*/5 * * * *', desc: 'Runs every 5 minutes' },
  { label: 'Every 15 min', value: '*/15 * * * *', desc: 'Runs every 15 minutes' },
  { label: 'Hourly', value: '0 * * * *', desc: 'At minute 0 past every hour' },
  { label: 'Daily (Midnight)', value: '0 0 * * *', desc: 'Every day at 00:00' },
  { label: 'Daily (2:00 AM)', value: '0 2 * * *', desc: 'Every day at 02:00' },
  { label: 'Weekly (Sunday)', value: '0 0 * * 0', desc: 'Every Sunday at midnight' },
  { label: 'Monthly (1st)', value: '0 0 1 * *', desc: 'At midnight on day 1 of month' },
  { label: 'At Reboot', value: '@reboot', desc: 'Run once at startup' },
];

export const CronView: React.FC<CronViewProps> = ({
  hosts,
  selectedHost,
  onSelectHost,
}) => {
  const [jobs, setJobs] = useState<CronJobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJobItem | null>(null);
  const [showRawModal, setShowRawModal] = useState(false);
  const [rawContent, setRawContent] = useState('');
  const [rawSaving, setRawSaving] = useState(false);

  // Form states
  const [formSchedule, setFormSchedule] = useState('* * * * *');
  const [formCommand, setFormCommand] = useState('');
  const [formComment, setFormComment] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formSaving, setFormSaving] = useState(false);

  // Execution modal states
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<CronExecutionResult | null>(null);
  const [execCommand, setExecCommand] = useState<string | null>(null);

  // Clipboard copy
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadJobs = async () => {
    if (!selectedHost) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.cron.list(selectedHost.id);
      setJobs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load cron jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedHost) {
      loadJobs();
    }
  }, [selectedHost?.id]);

  const handleOpenAdd = () => {
    setFormSchedule('0 0 * * *');
    setFormCommand('');
    setFormComment('');
    setFormEnabled(true);
    setEditingJob(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (job: CronJobItem) => {
    setFormSchedule(job.schedule);
    setFormCommand(job.command);
    setFormComment(job.comment);
    setFormEnabled(job.isEnabled);
    setEditingJob(job);
    setShowAddModal(true);
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || !formCommand.trim() || !formSchedule.trim()) return;

    setFormSaving(true);
    try {
      if (editingJob) {
        await api.cron.update(selectedHost.id, editingJob.lineIndex, {
          schedule: formSchedule.trim(),
          command: formCommand.trim(),
          comment: formComment.trim(),
          isEnabled: formEnabled,
        });
      } else {
        await api.cron.add(selectedHost.id, {
          schedule: formSchedule.trim(),
          command: formCommand.trim(),
          comment: formComment.trim(),
          isEnabled: formEnabled,
        });
      }
      setShowAddModal(false);
      loadJobs();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (job: CronJobItem) => {
    if (!selectedHost) return;
    if (!confirm(`Delete cron job "${job.command}"?`)) return;

    try {
      await api.cron.delete(selectedHost.id, job.lineIndex);
      loadJobs();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleToggle = async (job: CronJobItem) => {
    if (!selectedHost) return;
    try {
      await api.cron.toggle(selectedHost.id, job.lineIndex);
      loadJobs();
    } catch (err: any) {
      alert(`Toggle failed: ${err.message}`);
    }
  };

  const handleRunNow = async (command: string) => {
    if (!selectedHost) return;
    setExecCommand(command);
    setExecuting(true);
    setExecResult(null);

    try {
      const res = await api.cron.run(selectedHost.id, command);
      setExecResult(res);
    } catch (err: any) {
      setExecResult({
        exitCode: 1,
        output: '',
        error: err.message || 'Execution error',
        durationMs: 0,
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleOpenRaw = async () => {
    if (!selectedHost) return;
    try {
      const res = await api.cron.raw(selectedHost.id);
      setRawContent(res.content);
      setShowRawModal(true);
    } catch (err: any) {
      alert(`Failed to load raw crontab: ${err.message}`);
    }
  };

  const handleSaveRaw = async () => {
    if (!selectedHost) return;
    setRawSaving(true);
    try {
      await api.cron.saveRaw(selectedHost.id, rawContent);
      setShowRawModal(false);
      loadJobs();
    } catch (err: any) {
      alert(`Save raw crontab failed: ${err.message}`);
    } finally {
      setRawSaving(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-4">
      {/* Top Bar with Server Selector & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-carbon-900 border border-carbon-700 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-dorito-500/10 border border-dorito-500/30 text-dorito-500">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wider text-slate-100 uppercase">
                Cron Job Manager
              </h2>
              
            </div>
            <p className="text-xs text-slate-400">
              Manage system scheduled tasks and recurring scripts via SSH
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedHost?.id || ''}
            onChange={(e) => {
              const h = hosts.find((x) => x.id === e.target.value);
              if (h) onSelectHost(h);
            }}
            className="flex-1 sm:flex-initial bg-carbon-850 border border-carbon-700 text-xs text-slate-200 px-3 py-2 font-mono focus:border-dorito-500 focus:outline-none"
          >
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.host})
              </option>
            ))}
          </select>

          <button
            onClick={loadJobs}
            disabled={loading || !selectedHost}
            className="p-2 bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-dorito-500' : ''}`} />
          </button>

          <button
            onClick={handleOpenRaw}
            disabled={!selectedHost}
            className="flex items-center gap-1.5 px-3 py-2 bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-slate-200 text-xs font-mono transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>Raw View</span>
          </button>

          <button
            onClick={handleOpenAdd}
            disabled={!selectedHost}
            className="flex items-center gap-1.5 px-3 py-2 bg-dorito-500 hover:bg-dorito-600 text-carbon-950 text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Job</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/60 p-3.5 flex items-center gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Jobs Table */}
      <div className="bg-carbon-900 border border-carbon-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-carbon-700 flex items-center justify-between bg-carbon-850/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-300 uppercase tracking-wider">
              Crontab Entries
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-carbon-800 border border-carbon-700 text-dorito-500">
              {jobs.length} total
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Target: <span className="text-slate-200">{selectedHost?.username || 'root'}@{selectedHost?.host}</span>
          </span>
        </div>

        {jobs.length === 0 && !loading ? (
          <div className="p-12 text-center">
            <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-slate-300 mb-1">No scheduled cron jobs found</h3>
            <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
              There are no crontab entries configured for this host user. Add your first recurring task.
            </p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dorito-500 hover:bg-dorito-600 text-carbon-950 text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Scheduled Task</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-carbon-700 bg-carbon-850/40 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-4 w-12 text-center">State</th>
                  <th className="py-2.5 px-4 w-44">Schedule</th>
                  <th className="py-2.5 px-4">Command & Description</th>
                  <th className="py-2.5 px-4 w-36 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-800/80 text-xs font-mono">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className={`hover:bg-carbon-800/40 transition-colors ${
                      !job.isEnabled ? 'opacity-60 bg-carbon-950/20' : ''
                    }`}
                  >
                    {/* Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggle(job)}
                        className="text-slate-400 hover:text-dorito-500 transition-colors"
                        title={job.isEnabled ? 'Disable Job (comment out)' : 'Enable Job'}
                      >
                        {job.isEnabled ? (
                          <ToggleRight className="w-6 h-6 text-dorito-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-600" />
                        )}
                      </button>
                    </td>

                    {/* Schedule */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 bg-carbon-800 text-dorito-500 border border-carbon-700 text-xs font-mono font-medium">
                          {job.schedule}
                        </span>
                        <div className="text-[11px] text-slate-400 font-sans">
                          {job.scheduleDescription}
                        </div>
                      </div>
                    </td>

                    {/* Command */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {job.comment && (
                          <div className="text-[11px] text-amber-400 font-sans flex items-center gap-1 font-medium">
                            <span># {job.comment}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 group">
                          <code className="text-slate-200 bg-carbon-950/80 px-2 py-1 border border-carbon-800 text-xs break-all block flex-1">
                            {job.command}
                          </code>
                          <button
                            onClick={() => copyToClipboard(job.command, job.id)}
                            className="p-1 text-slate-500 hover:text-slate-200 transition-colors opacity-0 group-hover:opacity-100"
                            title="Copy command"
                          >
                            {copiedId === job.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRunNow(job.command)}
                          className="p-1.5 bg-carbon-800 hover:bg-carbon-700 text-emerald-400 border border-carbon-700 hover:border-emerald-500/40 transition-colors"
                          title="Run now (Test execution)"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(job)}
                          className="p-1.5 bg-carbon-800 hover:bg-carbon-700 text-slate-300 border border-carbon-700 hover:border-dorito-500/40 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(job)}
                          className="p-1.5 bg-carbon-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-carbon-700 hover:border-rose-800/40 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Job Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-carbon-900 border border-carbon-700 w-full max-w-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-carbon-700 flex items-center justify-between bg-carbon-850">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-dorito-500" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
                  {editingJob ? 'Edit Scheduled Task' : 'New Scheduled Task'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="p-5 space-y-4">
              {/* Presets */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                  Quick Schedule Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormSchedule(p.value)}
                      className={`px-2.5 py-1 text-[11px] font-mono border transition-colors ${
                        formSchedule === p.value
                          ? 'bg-dorito-500 text-carbon-950 border-dorito-400 font-semibold'
                          : 'bg-carbon-850 text-slate-300 border-carbon-700 hover:border-carbon-600'
                      }`}
                      title={p.desc}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule Expression */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono text-slate-400 uppercase">
                    Cron Schedule (minute hour day month weekday)
                  </label>
                  <a
                    href="https://crontab.guru"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-dorito-500 hover:underline font-mono"
                  >
                    crontab.guru ↗
                  </a>
                </div>
                <input
                  type="text"
                  value={formSchedule}
                  onChange={(e) => setFormSchedule(e.target.value)}
                  placeholder="0 2 * * *"
                  required
                  className="w-full bg-carbon-850 border border-carbon-700 px-3 py-2 text-sm text-dorito-400 font-mono focus:border-dorito-500 focus:outline-none"
                />
              </div>

              {/* Command */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">
                  Shell Command to Execute
                </label>
                <textarea
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder="/usr/local/bin/backup.sh >> /var/log/backup.log 2>&1"
                  required
                  rows={3}
                  className="w-full bg-carbon-850 border border-carbon-700 px-3 py-2 text-xs text-slate-200 font-mono focus:border-dorito-500 focus:outline-none resize-none"
                />
              </div>

              {/* Description / Comment */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">
                  Description / Label (Optional comment)
                </label>
                <input
                  type="text"
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder="Nightly database backup & cleanup"
                  className="w-full bg-carbon-850 border border-carbon-700 px-3 py-2 text-xs text-slate-200 font-sans focus:border-dorito-500 focus:outline-none"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="cronEnabled"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className="rounded border-carbon-700 text-dorito-500 focus:ring-0 bg-carbon-850"
                />
                <label htmlFor="cronEnabled" className="text-xs text-slate-300 font-mono">
                  Enable this task immediately
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-carbon-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs text-slate-300 font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 bg-dorito-500 hover:bg-dorito-600 text-carbon-950 text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  {formSaving ? 'Saving...' : editingJob ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Raw Crontab Editor Modal */}
      {showRawModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-carbon-900 border border-carbon-700 w-full max-w-3xl shadow-2xl">
            <div className="px-5 py-4 border-b border-carbon-700 flex items-center justify-between bg-carbon-850">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-dorito-500" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
                  Raw Crontab Editor
                </h3>
              </div>
              <button
                onClick={() => setShowRawModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-400 font-mono">
                Directly edit the raw crontab file for {selectedHost?.username}@{selectedHost?.host}. Lines will be installed via <code className="text-dorito-500">crontab</code> command.
              </p>
              <textarea
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                rows={14}
                className="w-full bg-carbon-950 border border-carbon-700 p-3 text-xs text-slate-200 font-mono focus:border-dorito-500 focus:outline-none"
                placeholder="# Add cron jobs here"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRawModal(false)}
                  className="px-4 py-2 bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs text-slate-300 font-mono"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRaw}
                  disabled={rawSaving}
                  className="px-5 py-2 bg-dorito-500 hover:bg-dorito-600 text-carbon-950 text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  {rawSaving ? 'Saving...' : 'Install Crontab'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution Result Modal */}
      {(executing || execResult) && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-carbon-900 border border-carbon-700 w-full max-w-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-carbon-700 flex items-center justify-between bg-carbon-850">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
                  Execution Output
                </h3>
              </div>
              <button
                onClick={() => {
                  setExecuting(false);
                  setExecResult(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 font-mono">
              <div className="text-xs text-slate-400">
                Command: <code className="text-dorito-500 bg-carbon-950 px-2 py-0.5 border border-carbon-800">{execCommand}</code>
              </div>

              {executing ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-dorito-500" />
                  <span className="text-xs">Executing on remote host...</span>
                </div>
              ) : execResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      {execResult.exitCode === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span className={execResult.exitCode === 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        Exit Code: {execResult.exitCode}
                      </span>
                    </div>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">Duration: {execResult.durationMs}ms</span>
                  </div>

                  <div className="bg-carbon-950 border border-carbon-800 p-3 max-h-72 overflow-y-auto text-xs text-slate-200">
                    {execResult.output && (
                      <pre className="whitespace-pre-wrap">{execResult.output}</pre>
                    )}
                    {execResult.error && (
                      <pre className="whitespace-pre-wrap text-rose-400 mt-1">{execResult.error}</pre>
                    )}
                    {!execResult.output && !execResult.error && (
                      <span className="text-slate-500 italic">(No output produced)</span>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    setExecuting(false);
                    setExecResult(null);
                  }}
                  className="px-4 py-2 bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs text-slate-300 font-mono"
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
