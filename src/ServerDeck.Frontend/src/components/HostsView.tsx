import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  Terminal,
  Layers,
  FolderTree,
  Cpu,
  HardDrive,
  Activity,
  Wifi,
  Copy,
  Check,
  Trash2,
  Edit,
  ExternalLink,
  Shield,
  Clock,
  Radio,
  AlertCircle
} from 'lucide-react';
import { Host, HostStats } from '../types';
import { api } from '../api';

interface HostsViewProps {
  hosts: Host[];
  onRefresh: () => void;
  onSelectHost: (hostId: string) => void;
  onOpenTab: (tab: string, hostId?: string) => void;
  masterPublicKey: string;
}

export const HostsView: React.FC<HostsViewProps> = ({
  hosts,
  onRefresh,
  onSelectHost,
  onOpenTab,
  masterPublicKey
}) => {
  const [statsMap, setStatsMap] = useState<Record<string, HostStats>>({});
  const [loadingStats, setLoadingStats] = useState<Record<string, boolean>>({});
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editHost, setEditHost] = useState<Host | null>(null);
  const [setupCommandModalOpen, setSetupCommandModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState(22);
  const [formUsername, setFormUsername] = useState('root');
  const [formAuthType, setFormAuthType] = useState<'global_key' | 'key' | 'password'>('global_key');
  const [formCredential, setFormCredential] = useState('');
  const [formPassphrase, setFormPassphrase] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchHostStats = async (hostId: string) => {
    setLoadingStats((prev) => ({ ...prev, [hostId]: true }));
    try {
      const stats = await api.hosts.stats(hostId);
      setStatsMap((prev) => ({ ...prev, [hostId]: stats }));
    } catch (err) {
      setStatsMap((prev) => ({
        ...prev,
        [hostId]: { isOnline: false, error: 'Connection failed' }
      }));
    } finally {
      setLoadingStats((prev) => ({ ...prev, [hostId]: false }));
    }
  };

  useEffect(() => {
    hosts.forEach((h) => {
      fetchHostStats(h.id);
    });
  }, [hosts]);

  const handleOpenAdd = () => {
    setEditHost(null);
    setFormName('');
    setFormHost('');
    setFormPort(22);
    setFormUsername('root');
    setFormAuthType('global_key');
    setFormCredential('');
    setFormPassphrase('');
    setFormNotes('');
    setFormError(null);
    setAddModalOpen(true);
  };

  const handleOpenEdit = (h: Host) => {
    setEditHost(h);
    setFormName(h.name);
    setFormHost(h.host);
    setFormPort(h.port);
    setFormUsername(h.username);
    setFormAuthType(h.authType);
    setFormCredential('');
    setFormPassphrase('');
    setFormNotes(h.notes || '');
    setFormError(null);
    setAddModalOpen(true);
  };

  const handleDeleteHost = async (h: Host) => {
    if (!confirm(`Удалить сервер "${h.name}" из панели?`)) return;
    try {
      await api.hosts.delete(h.id);
      onRefresh();
    } catch (err: any) {
      alert(`Ошибка удаления: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formName.trim() || !formHost.trim()) {
      setFormError('Укажите имя и IP-адрес/домен сервера');
      return;
    }

    setSubmitting(true);
    try {
      if (editHost) {
        await api.hosts.update(editHost.id, {
          name: formName,
          host: formHost,
          port: formPort,
          username: formUsername,
          authType: formAuthType,
          credential: formCredential || undefined,
          passphrase: formPassphrase || undefined,
          notes: formNotes,
        });
      } else {
        await api.hosts.create({
          name: formName,
          host: formHost,
          port: formPort,
          username: formUsername,
          authType: formAuthType,
          credential: formCredential,
          passphrase: formPassphrase,
          notes: formNotes,
        });
      }
      setAddModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка сохранения');
    } finally {
      setSubmitting(false);
    }
  };

  const oneLinerCommand = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${masterPublicKey.trim()}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'Ключ успешно установлен!'`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Серверы</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Управление парком серверов по SSH без установки агентов
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSetupCommandModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700 text-xs sm:text-sm font-medium text-blue-400 transition-colors shadow-sm"
          >
            <Shield className="w-4 h-4" />
            <span>Команда в 1 клик</span>
          </button>

          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700 text-xs sm:text-sm font-medium text-slate-300 transition-colors"
            title="Обновить"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Обновить</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm shadow-lg shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить сервер</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {hosts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-deck-700 bg-deck-900/50 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto mb-4">
            <Server className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-white">Нет добавленных серверов</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-2 mb-6">
            Добавьте свой первый сервер по SSH, чтобы инспектировать контейнеры, файлы и выполнять команды.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setSetupCommandModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-deck-850 border border-deck-700 text-sm font-medium text-blue-400 hover:bg-deck-800 transition-colors"
            >
              Скопировать команду настройки
            </button>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Добавить сервер
            </button>
          </div>
        </div>
      )}

      {/* Hosts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {hosts.map((host) => {
          const stats = statsMap[host.id];
          const isLoading = loadingStats[host.id];
          const isOnline = stats?.isOnline ?? false;

          return (
            <div
              key={host.id}
              className="group rounded-2xl bg-deck-900 border border-deck-800 hover:border-deck-700/80 p-5 shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header: Name, Status, Actions */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                        }`}
                      />
                      <h3 className="font-semibold text-white text-base truncate">{host.name}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono truncate">
                      {host.username}@{host.host}:{host.port}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                    <button
                      onClick={() => fetchHostStats(host.id)}
                      disabled={isLoading}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-deck-800 transition-colors"
                      title="Проверить статус"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(host)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-deck-800 transition-colors"
                      title="Редактировать"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteHost(host)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-deck-800 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* OS & Uptime */}
                <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px] text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-deck-850 border border-deck-700/50 truncate max-w-[200px]">
                    {stats?.osInfo || 'Linux'}
                  </span>
                  {stats?.uptime && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-deck-850 border border-deck-700/50">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {stats.uptime}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-deck-850 border border-deck-700/50 uppercase font-mono text-[10px]">
                    {host.authType === 'global_key' ? 'Мастер-ключ' : host.authType === 'key' ? 'Свой ключ' : 'Пароль'}
                  </span>
                </div>

                {/* Live Dashboards (CPU, RAM, Disk, Net) */}
                <div className="space-y-3 py-3 border-y border-deck-800/80 mb-4">
                  {/* CPU Gauge */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-blue-400" /> Процессор
                      </span>
                      <span className="font-mono text-white font-medium">{stats?.cpuUsage || '0%'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-deck-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, stats?.cpuPercent ?? 5))}%` }}
                      />
                    </div>
                  </div>

                  {/* RAM Gauge */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" /> Память (RAM)
                      </span>
                      <span className="font-mono text-white font-medium">{stats?.memoryUsage || '0 GB'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-deck-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, stats?.memoryPercent ?? 10))}%` }}
                      />
                    </div>
                  </div>

                  {/* Disk Gauge */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Диск (Root)
                      </span>
                      <span className="font-mono text-white font-medium">{stats?.diskUsage || '0 GB'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-deck-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, stats?.diskPercent ?? 15))}%` }}
                      />
                    </div>
                  </div>

                  {/* Network Bandwidth & Load Average */}
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 truncate">
                      <Wifi className="w-3 h-3 text-cyan-400" />
                      {stats?.networkUsage || 'RX: 0 GB | TX: 0 GB'}
                    </span>
                    <span className="font-mono text-slate-500 text-[10px]">
                      LA: {stats?.loadAverage || '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => {
                    onSelectHost(host.id);
                    onOpenTab('docker', host.id);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700/60 text-xs font-medium text-slate-200 hover:text-white transition-colors"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Docker</span>
                </button>

                <button
                  onClick={() => {
                    onSelectHost(host.id);
                    onOpenTab('files', host.id);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700/60 text-xs font-medium text-slate-200 hover:text-white transition-colors"
                >
                  <FolderTree className="w-3.5 h-3.5 text-amber-400" />
                  <span>Файлы</span>
                </button>

                <button
                  onClick={() => {
                    onSelectHost(host.id);
                    onOpenTab('terminal', host.id);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700/60 text-xs font-medium text-slate-200 hover:text-white transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SSH</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Host Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-deck-900 border border-deck-700 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-1">
              {editHost ? 'Редактировать сервер' : 'Добавить сервер'}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Подключение выполняется напрямую по SSH без агентов.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Название сервера</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Production VPS / Home Server"
                  required
                  className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">IP-адрес или домен</label>
                  <input
                    type="text"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    placeholder="192.168.1.100 или example.com"
                    required
                    className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">SSH Порт</label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(parseInt(e.target.value) || 22)}
                    className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Пользователь</label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="root"
                  required
                  className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Метод аутентификации</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormAuthType('global_key')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${
                      formAuthType === 'global_key'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'bg-deck-850 border-deck-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    Мастер-ключ
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAuthType('key')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${
                      formAuthType === 'key'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'bg-deck-850 border-deck-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    Свой SSH-ключ
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAuthType('password')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${
                      formAuthType === 'password'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'bg-deck-850 border-deck-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    Пароль
                  </button>
                </div>
              </div>

              {formAuthType === 'password' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Пароль пользователя</label>
                  <input
                    type="password"
                    value={formCredential}
                    onChange={(e) => setFormCredential(e.target.value)}
                    placeholder={editHost ? 'Оставьте пустым, чтобы не менять' : 'Пароль'}
                    className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {formAuthType === 'key' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Приватный ключ (OpenSSH / PEM)</label>
                    <textarea
                      rows={4}
                      value={formCredential}
                      onChange={(e) => setFormCredential(e.target.value)}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                      className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Парольная фраза ключа (passphrase)</label>
                    <input
                      type="password"
                      value={formPassphrase}
                      onChange={(e) => setFormPassphrase(e.target.value)}
                      placeholder="Оставьте пустым, если нет пароля на ключе"
                      className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {formAuthType === 'global_key' && (
                <div className="p-3 rounded-xl bg-blue-600/10 border border-blue-500/20 text-xs text-blue-300">
                  Будет использован глобальный мастер-ключ ServerDeck. Убедитесь, что публичный ключ добавлен в файл <code>~/.ssh/authorized_keys</code> целевого сервера.
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Заметки / Описание</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Основной веб-сервер, база данных..."
                  className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-deck-850 text-slate-300 hover:bg-deck-800 text-sm font-medium transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Сохранение...' : editHost ? 'Сохранить изменения' : 'Добавить сервер'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Liner Setup Command Modal */}
      {setupCommandModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-deck-900 border border-deck-700 rounded-2xl shadow-2xl p-6 relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Команда настройки сервера в 1 клик</h3>
                <p className="text-xs text-slate-400">
                  Выполните эту команду на целевом сервере, чтобы панель сразу могла подключиться
                </p>
              </div>
            </div>

            <div className="relative mb-4">
              <pre className="p-4 rounded-xl bg-black/80 border border-deck-700 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all select-all">
                {oneLinerCommand}
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <p className="text-[11px] text-slate-500">
                Команда автоматически создаст директорию <code>~/.ssh</code>, выставит безопасные права <code>700/600</code> и добавит мастер-ключ.
              </p>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => copyToClipboard(oneLinerCommand)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/20 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Скопировано!' : 'Скопировать команду'}</span>
                </button>
                <button
                  onClick={() => setSetupCommandModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-deck-850 hover:bg-deck-800 text-slate-300 text-xs font-medium transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
