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
  Search,
  X,
  CheckCircle2,
  AlertCircle
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
    if (action === 'down' && !confirm(`Остановить и удалить стек ${projectName}?`)) return;

    setRunningAction(`${filePath}-${action}`);
    try {
      const res = await api.compose.action(selectedHost.id, filePath, action);
      setActionOutput({
        title: `Результат: ${projectName} (${action})`,
        output: res.output || res.error || (res.success ? 'Команда выполнена успешно.' : 'Ошибка выполнения'),
      });
      fetchProjects();
    } catch (err: any) {
      setActionOutput({
        title: `Ошибка: ${projectName}`,
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
        title: `Логи стека: ${projectName}`,
        output: logs || 'Логи пусты.',
      });
    } catch (err: any) {
      alert(`Ошибка получения логов: ${err.message}`);
    }
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-slate-400">
        Выберите сервер в верхнем меню для работы с Docker Compose
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Docker Compose</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Управление стеками приложений и сервисами на {selectedHost.name}
          </p>
        </div>

        <button
          onClick={fetchProjects}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700 text-xs sm:text-sm font-medium text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Сканировать</span>
        </button>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-deck-800 bg-deck-900/40 p-12 text-center text-slate-400">
          <FolderGit2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">Compose проекты не обнаружены</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Проверены стандартные каталоги (/opt, /home, /root, /var/www). Вы можете создать файл compose в файловом менеджере.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => {
            return (
              <div
                key={p.filePath}
                className="rounded-2xl bg-deck-900 border border-deck-800 hover:border-deck-700 p-5 shadow-lg transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <h3 className="font-bold text-white text-base truncate">{p.name}</h3>
                    <span className="text-[11px] font-mono text-slate-400 bg-deck-850 px-2 py-0.5 rounded border border-deck-700/50">
                      {p.services.length} сервисов
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-mono truncate mb-2">{p.filePath}</p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.services.map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-deck-850 text-blue-400 text-[11px] font-mono border border-deck-700/40"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stack Actions */}
                <div className="flex items-center gap-2 flex-wrap self-end md:self-auto shrink-0">
                  <button
                    onClick={() => handleAction(p.filePath, p.name, 'up')}
                    disabled={runningAction === `${p.filePath}-up`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-colors"
                    title="Запустить (up -d)"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Up</span>
                  </button>

                  <button
                    onClick={() => handleAction(p.filePath, p.name, 'down')}
                    disabled={runningAction === `${p.filePath}-down`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors"
                    title="Остановить (down)"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Down</span>
                  </button>

                  <button
                    onClick={() => handleAction(p.filePath, p.name, 'restart')}
                    disabled={runningAction === `${p.filePath}-restart`}
                    className="p-2 rounded-xl bg-deck-850 hover:bg-deck-800 text-slate-300 border border-deck-700 transition-colors"
                    title="Перезапустить"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleAction(p.filePath, p.name, 'pull')}
                    disabled={runningAction === `${p.filePath}-pull`}
                    className="p-2 rounded-xl bg-deck-850 hover:bg-deck-800 text-slate-300 border border-deck-700 transition-colors"
                    title="Обновить образы (pull)"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleLogs(p.filePath, p.name)}
                    className="p-2 rounded-xl bg-deck-850 hover:bg-deck-800 text-slate-300 border border-deck-700 transition-colors"
                    title="Логи стека"
                  >
                    <FileText className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onEditFile(p.filePath)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-medium transition-colors"
                    title="Редактировать в Monaco Editor"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Редактор</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Output / Console Modal */}
      {actionOutput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-deck-900 border border-deck-700 rounded-2xl shadow-2xl p-5 relative flex flex-col h-[75vh]">
            <div className="flex items-center justify-between pb-3 border-b border-deck-800 mb-3">
              <h3 className="font-bold text-white text-base truncate">{actionOutput.title}</h3>
              <button
                onClick={() => setActionOutput(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-black/90 p-4 rounded-xl font-mono text-xs text-emerald-400 whitespace-pre-wrap break-all leading-relaxed select-text">
              {actionOutput.output}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
