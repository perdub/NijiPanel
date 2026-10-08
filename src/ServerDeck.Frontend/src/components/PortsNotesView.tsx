import React, { useState, useEffect } from 'react';
import {
  Network,
  StickyNote,
  Plus,
  Trash2,
  Save,
  Play,
  Square,
  Check,
  AlertCircle,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { Host, HostPort, HostNote, SshTunnel } from '../types';
import { api } from '../api';

interface PortsNotesViewProps {
  selectedHost: Host | null;
}

export const PortsNotesView: React.FC<PortsNotesViewProps> = ({ selectedHost }) => {
  const [ports, setPorts] = useState<HostPort[]>([]);
  const [noteTitle, setNoteTitle] = useState('Заметки по серверу');
  const [noteContent, setNoteContent] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [tunnels, setTunnels] = useState<SshTunnel[]>([]);

  // Add Port form
  const [addPortModal, setAddPortModal] = useState(false);
  const [newPort, setNewPort] = useState(8080);
  const [newProto, setNewProto] = useState('tcp');
  const [newService, setNewService] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Add Tunnel form
  const [addTunnelModal, setAddTunnelModal] = useState(false);
  const [tunnelName, setTunnelName] = useState('');
  const [localPort, setLocalPort] = useState(8080);
  const [remoteHost, setRemoteHost] = useState('127.0.0.1');
  const [remotePort, setRemotePort] = useState(8080);

  const loadData = async () => {
    if (!selectedHost) return;
    try {
      const [portsData, noteData, tunnelsData] = await Promise.all([
        api.extras.ports(selectedHost.id),
        api.extras.note(selectedHost.id),
        api.extras.tunnels(selectedHost.id),
      ]);
      setPorts(portsData);
      setNoteTitle(noteData.title || 'Заметки по серверу');
      setNoteContent(noteData.content || '');
      setTunnels(tunnelsData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedHost]);

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
      loadData();
    } catch (err: any) {
      alert(`Ошибка добавления порта: ${err.message}`);
    }
  };

  const handleDeletePort = async (portId: string) => {
    if (!selectedHost) return;
    try {
      await api.extras.deletePort(selectedHost.id, portId);
      loadData();
    } catch (err: any) {
      alert(`Ошибка удаления: ${err.message}`);
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
      alert(`Ошибка сохранения заметок: ${err.message}`);
    }
  };

  const handleAddTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || !tunnelName.trim()) return;

    try {
      await api.extras.createTunnel(selectedHost.id, {
        name: tunnelName.trim(),
        localPort,
        remoteHost,
        remotePort,
      });
      setAddTunnelModal(false);
      setTunnelName('');
      loadData();
    } catch (err: any) {
      alert(`Ошибка создания туннеля: ${err.message}`);
    }
  };

  const handleDeleteTunnel = async (tunnelId: string) => {
    if (!selectedHost) return;
    try {
      await api.extras.deleteTunnel(selectedHost.id, tunnelId);
      loadData();
    } catch (err: any) {
      alert(`Ошибка удаления: ${err.message}`);
    }
  };

  const handleToggleTunnel = async (tunnel: SshTunnel) => {
    if (!selectedHost) return;
    try {
      if (tunnel.isActive) {
        await api.extras.stopTunnel(selectedHost.id, tunnel.id);
      } else {
        const res = await api.extras.startTunnel(selectedHost.id, tunnel.id);
        if (!res.success) {
          alert(`Ошибка запуска туннеля: ${res.error}`);
        }
      }
      loadData();
    } catch (err: any) {
      alert(`Ошибка туннеля: ${err.message}`);
    }
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-slate-400">
        Выберите сервер в верхнем меню для просмотра портов и заметок
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Порты, Туннели & Заметки</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Фиксация назначения сетевых портов, SSH-проброс и база знаний для {selectedHost.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Port Registry */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Реестр портов</h2>
            </div>
            <button
              onClick={() => setAddPortModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Записать порт</span>
            </button>
          </div>

          <div className="rounded-2xl bg-deck-900 border border-deck-800 overflow-hidden shadow-lg">
            {ports.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Пока нет записанных портов. Добавьте порты (например, 3000: Grafana, 5432: Postgres), чтобы не забывать назначение.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-deck-850/60 text-slate-400 font-semibold border-b border-deck-800">
                    <tr>
                      <th className="py-2.5 px-4">Порт</th>
                      <th className="py-2.5 px-3">Сервис</th>
                      <th className="py-2.5 px-3">Описание</th>
                      <th className="py-2.5 px-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-deck-800/60 font-mono">
                    {ports.map((p) => (
                      <tr key={p.id} className="hover:bg-deck-850/40 transition-colors">
                        <td className="py-2.5 px-4 text-emerald-400 font-bold">
                          {p.port} <span className="text-[10px] text-slate-500 font-normal uppercase">({p.protocol})</span>
                        </td>
                        <td className="py-2.5 px-3 text-white font-sans font-medium">{p.serviceName}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px] truncate max-w-xs">
                          {p.description || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleDeletePort(p.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SSH Port Forwarding Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">SSH Проброс портов (Туннели)</h2>
              </div>
              <button
                onClick={() => setAddTunnelModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700 text-slate-300 text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Новый туннель</span>
              </button>
            </div>

            <div className="rounded-2xl bg-deck-900 border border-deck-800 overflow-hidden shadow-lg p-3 space-y-2">
              {tunnels.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  Нет настроенных туннелей. Пробросьте удаленный порт (например, БД или админку контейнера) на локальный порт панели.
                </div>
              ) : (
                tunnels.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-deck-850 border border-deck-700/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">{t.name}</div>
                      <div className="font-mono text-slate-400 text-[11px] mt-0.5">
                        Локальный :{t.localPort} → {t.remoteHost}:{t.remotePort}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleTunnel(t)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          t.isActive
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {t.isActive ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{t.isActive ? 'Остановить' : 'Запустить'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteTunnel(t.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Server Notes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Заметки и инструкции</h2>
            </div>
            <button
              onClick={handleSaveNote}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/20 transition-all"
            >
              {noteSaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
              <span>{noteSaved ? 'Сохранено!' : 'Сохранить заметки'}</span>
            </button>
          </div>

          <div className="rounded-2xl bg-deck-900 border border-deck-800 p-4 shadow-lg flex flex-col h-[520px]">
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Заголовок заметок"
              className="bg-transparent border-b border-deck-800 pb-2 mb-3 text-sm font-bold text-white focus:outline-none focus:border-blue-500"
            />
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Запишите сюда особенности конфигурации, секретные токены, пути к бэкапам, cron-задачи или полезные команды для этого сервера..."
              className="flex-1 w-full bg-deck-850/50 border border-deck-800 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono resize-none leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Add Port Modal */}
      {addPortModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-deck-900 border border-deck-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-1">Зафиксировать порт</h3>
            <p className="text-xs text-slate-400 mb-4">Добавьте информацию о порте, чтобы не забыть назначение сервиса</p>

            <form onSubmit={handleAddPort} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Порт</label>
                  <input
                    type="number"
                    value={newPort}
                    onChange={(e) => setNewPort(parseInt(e.target.value) || 80)}
                    required
                    className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Протокол</label>
                  <select
                    value={newProto}
                    onChange={(e) => setNewProto(e.target.value)}
                    className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Имя сервиса</label>
                <input
                  type="text"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  placeholder="PostgreSQL / Grafana / API Gateway"
                  required
                  className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Описание / Для чего используется</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Основная база данных для продакшн микросервисов"
                  className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddPortModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-deck-850 text-slate-300 text-xs font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-500"
                >
                  Сохранить порт
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Tunnel Modal */}
      {addTunnelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-deck-900 border border-deck-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-1">Создать SSH-туннель</h3>
            <p className="text-xs text-slate-400 mb-4">Пробросить удаленный порт хоста на локальный адрес панели</p>

            <form onSubmit={handleAddTunnel} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Название туннеля</label>
                <input
                  type="text"
                  value={tunnelName}
                  onChange={(e) => setTunnelName(e.target.value)}
                  placeholder="Remote Postgres Access"
                  required
                  className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Локальный порт панели</label>
                  <input
                    type="number"
                    value={localPort}
                    onChange={(e) => setLocalPort(parseInt(e.target.value) || 8080)}
                    required
                    className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Удаленный порт сервера</label>
                  <input
                    type="number"
                    value={remotePort}
                    onChange={(e) => setRemotePort(parseInt(e.target.value) || 8080)}
                    required
                    className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Удаленный хост назначения</label>
                <input
                  type="text"
                  value={remoteHost}
                  onChange={(e) => setRemoteHost(e.target.value)}
                  placeholder="127.0.0.1"
                  className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddTunnelModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-deck-850 text-slate-300 text-xs font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-500"
                >
                  Создать туннель
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
