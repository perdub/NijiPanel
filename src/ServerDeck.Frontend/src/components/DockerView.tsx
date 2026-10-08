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
  AlertTriangle,
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
    if (action === 'rm' && !confirm('Удалить контейнер?')) return;

    setActionLoading((prev) => ({ ...prev, [containerId]: true }));
    try {
      await api.docker.action(selectedHost.id, containerId, action);
      await fetchContainers();
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
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
      alert(`Ошибка инспекции: ${err.message}`);
    }
  };

  const handleOpenLogs = async (containerId: string, name: string) => {
    if (!selectedHost) return;
    try {
      const { logs } = await api.docker.logs(selectedHost.id, containerId, 250);
      setLogsModal({ id: containerId, name, content: logs || 'Логи пусты.' });
    } catch (err: any) {
      alert(`Ошибка загрузки логов: ${err.message}`);
    }
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-slate-400">
        Выберите сервер в верхнем меню для просмотра контейнеров
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Docker Контейнеры</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-mono">
            {selectedHost.name} ({selectedHost.host})
          </p>
        </div>

        <button
          onClick={fetchContainers}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700 text-xs sm:text-sm font-medium text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Обновить</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по имени, образу или ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-deck-900 border border-deck-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-deck-900 border border-deck-800 self-start sm:self-auto">
          <button
            onClick={() => setFilterState('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterState === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Все ({containers.length})
          </button>
          <button
            onClick={() => setFilterState('running')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterState === 'running' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Работают ({containers.filter((c) => c.state === 'running').length})
          </button>
          <button
            onClick={() => setFilterState('exited')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterState === 'exited' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Остановлены ({containers.filter((c) => c.state === 'exited').length})
          </button>
        </div>
      </div>

      {/* Containers List / Table */}
      {filteredContainers.length === 0 ? (
        <div className="rounded-2xl border border-deck-800 bg-deck-900/60 p-12 text-center text-slate-400">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium">Контейнеры не найдены</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredContainers.map((c) => {
            const isRunning = c.state.toLowerCase() === 'running';
            const isBusy = actionLoading[c.id];

            return (
              <div
                key={c.id}
                className="rounded-2xl bg-deck-900 border border-deck-800/90 hover:border-deck-700/80 p-4 sm:p-5 shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        isRunning
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {c.state}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">{c.names}</h3>
                    <span className="text-[11px] font-mono text-slate-500 bg-deck-850 px-2 py-0.5 rounded">
                      {c.id.substring(0, 12)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 truncate mb-1.5 font-mono">{c.image}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono">
                    {c.ports && <span className="truncate text-blue-400/90">Порты: {c.ports}</span>}
                    <span>Статус: {c.status}</span>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0">
                  {isRunning ? (
                    <>
                      <button
                        onClick={() => handleAction(c.id, 'stop')}
                        disabled={isBusy}
                        className="p-2 rounded-xl bg-deck-850 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 border border-deck-700 transition-colors"
                        title="Остановить"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAction(c.id, 'restart')}
                        disabled={isBusy}
                        className="p-2 rounded-xl bg-deck-850 hover:bg-amber-600/20 text-slate-400 hover:text-amber-400 border border-deck-700 transition-colors"
                        title="Перезагрузить"
                      >
                        <RotateCw className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAction(c.id, 'start')}
                      disabled={isBusy}
                      className="p-2 rounded-xl bg-deck-850 hover:bg-emerald-600/20 text-slate-400 hover:text-emerald-400 border border-deck-700 transition-colors"
                      title="Запустить"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenLogs(c.id, c.names)}
                    className="p-2 rounded-xl bg-deck-850 hover:bg-deck-800 text-slate-400 hover:text-white border border-deck-700 transition-colors"
                    title="Логи"
                  >
                    <FileText className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleOpenInspect(c.id)}
                    className="p-2 rounded-xl bg-deck-850 hover:bg-deck-800 text-slate-400 hover:text-blue-400 border border-deck-700 transition-colors"
                    title="Инспектировать"
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleAction(c.id, 'rm')}
                    disabled={isBusy}
                    className="p-2 rounded-xl bg-deck-850 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 border border-deck-700 transition-colors"
                    title="Удалить"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-deck-900 border border-deck-700 rounded-2xl shadow-2xl p-5 relative flex flex-col h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-deck-800 mb-3">
              <div className="truncate">
                <h3 className="font-bold text-white text-base truncate">Логи: {logsModal.name}</h3>
                <span className="text-xs text-slate-400 font-mono">{logsModal.id.substring(0, 12)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenLogs(logsModal.id, logsModal.name)}
                  className="p-1.5 rounded-lg bg-deck-850 text-slate-300 hover:text-white border border-deck-700"
                  title="Обновить логи"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setLogsModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <pre className="flex-1 overflow-auto bg-black/90 p-4 rounded-xl font-mono text-xs text-slate-300 whitespace-pre-wrap break-all leading-relaxed select-text">
              {logsModal.content}
            </pre>
          </div>
        </div>
      )}

      {/* Inspect Modal */}
      {inspectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-deck-900 border border-deck-700 rounded-2xl shadow-2xl p-5 relative flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-deck-800 mb-4">
              <div>
                <h3 className="font-bold text-white text-base">Инспекция: {inspectModal.name}</h3>
                <p className="text-xs text-slate-400 font-mono">{inspectModal.id.substring(0, 12)}</p>
              </div>
              <button
                onClick={() => setInspectModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Переменные окружения (ENV)</h4>
                <div className="bg-black/60 rounded-xl p-3 border border-deck-800 space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
                  {inspectModal.env.map((env, i) => (
                    <div key={i} className="text-slate-300 truncate">
                      <span className="text-blue-400">{env.split('=')[0]}=</span>
                      <span className="text-slate-400">{env.split('=').slice(1).join('=')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Примонтированные тома (Mounts)</h4>
                <div className="bg-black/60 rounded-xl p-3 border border-deck-800 space-y-1 font-mono text-xs">
                  {inspectModal.mounts.length > 0 ? (
                    inspectModal.mounts.map((m, i) => <div key={i} className="text-slate-300 truncate">{m}</div>)
                  ) : (
                    <div className="text-slate-500">Нет монтирований</div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Проброшенные порты</h4>
                <div className="bg-black/60 rounded-xl p-3 border border-deck-800 space-y-1 font-mono text-xs">
                  {inspectModal.ports.length > 0 ? (
                    inspectModal.ports.map((p, i) => <div key={i} className="text-slate-300">{p}</div>)
                  ) : (
                    <div className="text-slate-500">Нет портов</div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Сырой JSON (docker inspect)</h4>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inspectModal.rawJson);
                      setCopiedInspect(true);
                      setTimeout(() => setCopiedInspect(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    {copiedInspect ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedInspect ? 'Скопировано!' : 'Скопировать JSON'}</span>
                  </button>
                </div>
                <pre className="bg-black/80 p-3 rounded-xl border border-deck-800 text-[11px] font-mono text-slate-300 max-h-48 overflow-auto">
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
