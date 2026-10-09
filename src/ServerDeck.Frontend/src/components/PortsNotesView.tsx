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
  ShieldAlert
} from 'lucide-react';
import { Host, HostPort, SshTunnel } from '../types';
import { api } from '../api';

interface PortsNotesViewProps {
  selectedHost: Host | null;
}

export const PortsNotesView: React.FC<PortsNotesViewProps> = ({ selectedHost }) => {
  const [ports, setPorts] = useState<HostPort[]>([]);
  const [noteTitle, setNoteTitle] = useState('Server Notes');
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
      setNoteTitle(noteData.title || 'Server Notes');
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
      alert(`Failed to add port: ${err.message}`);
    }
  };

  const handleDeletePort = async (portId: string) => {
    if (!selectedHost) return;
    try {
      await api.extras.deletePort(selectedHost.id, portId);
      loadData();
    } catch (err: any) {
      alert(`Failed to delete port: ${err.message}`);
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
      alert(`Failed to save notes: ${err.message}`);
    }
  };

  const handleAddTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || !tunnelName.trim()) return;

    try {
      await api.extras.createTunnel(selectedHost.id, {
        name: tunnelName.trim(),
        localPort,
        remoteHost: remoteHost.trim(),
        remotePort,
      });
      setAddTunnelModal(false);
      setTunnelName('');
      loadData();
    } catch (err: any) {
      alert(`Failed to create tunnel: ${err.message}`);
    }
  };

  const handleToggleTunnel = async (t: SshTunnel) => {
    if (!selectedHost) return;
    try {
      if (t.isActive) {
        await api.extras.stopTunnel(selectedHost.id, t.id);
      } else {
        await api.extras.startTunnel(selectedHost.id, t.id);
      }
      loadData();
    } catch (err: any) {
      alert(`Failed to toggle tunnel: ${err.message}`);
    }
  };

  const handleDeleteTunnel = async (tunnelId: string) => {
    if (!selectedHost) return;
    if (!confirm('Delete SSH tunnel?')) return;
    try {
      await api.extras.deleteTunnel(selectedHost.id, tunnelId);
      loadData();
    } catch (err: any) {
      alert(`Failed to delete tunnel: ${err.message}`);
    }
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-carbon-400 font-mono">
        Select a host from the top navigation to view port registry and notes
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-carbon-700/80 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-white tracking-tight">Port Registry & Notes</h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-semibold">
            SHIMOKITAZAWA STAGE GATEWAY
          </span>
        </div>
        <p className="text-xs sm:text-sm text-carbon-400 mt-1 font-mono">
          Network port registry, SSH tunneling, and documentation for {selectedHost.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Port Registry */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-dorito-500" />
              <h2 className="text-lg font-bold text-white font-sans">Port Registry</h2>
            </div>
            <button
              onClick={() => setAddPortModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shadow-md shadow-dorito-500/20 transition-all font-mono"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Port</span>
            </button>
          </div>

          <div className="rounded-xl bg-carbon-900 border border-carbon-700 overflow-hidden shadow-lg">
            {ports.length === 0 ? (
              <div className="p-8 text-center text-carbon-500 text-xs font-mono">
                No ports registered yet. Add ports (e.g. 3000: Grafana, 5432: Postgres) to document your architecture.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-carbon-850 text-carbon-300 font-bold border-b border-carbon-700">
                    <tr>
                      <th className="py-2.5 px-4">Port</th>
                      <th className="py-2.5 px-3">Service</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-carbon-800">
                    {ports.map((p) => (
                      <tr key={p.id} className="hover:bg-carbon-850/60 transition-colors">
                        <td className="py-2.5 px-4 text-dorito-400 font-bold">
                          {p.port} <span className="text-[10px] text-carbon-500 font-normal uppercase">({p.protocol})</span>
                        </td>
                        <td className="py-2.5 px-3 text-white font-sans font-medium">{p.serviceName}</td>
                        <td className="py-2.5 px-3 text-carbon-400 font-sans text-[11px] truncate max-w-xs">
                          {p.description || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleDeletePort(p.id)}
                            className="p-1 text-carbon-500 hover:text-rose-400 transition-colors"
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
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-white font-sans">SSH Port Forwarding (Tunnels)</h2>
              </div>
              <button
                onClick={() => setAddTunnelModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-carbon-200 hover:text-dorito-400 text-xs font-mono font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Tunnel</span>
              </button>
            </div>

            <div className="rounded-xl bg-carbon-900 border border-carbon-700 overflow-hidden shadow-lg p-3 space-y-2 font-mono">
              {tunnels.length === 0 ? (
                <div className="p-6 text-center text-carbon-500 text-xs">
                  No tunnels configured. Forward remote ports (e.g. databases, internal web UIs) directly to NijiPanel.
                </div>
              ) : (
                tunnels.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg bg-carbon-850 border border-carbon-700 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white font-sans">{t.name}</div>
                      <div className="font-mono text-carbon-400 text-[11px] mt-0.5">
                        Local :{t.localPort} → {t.remoteHost}:{t.remotePort}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleTunnel(t)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          t.isActive
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {t.isActive ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{t.isActive ? 'Stop' : 'Start'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteTunnel(t.id)}
                        className="p-1.5 text-carbon-400 hover:text-rose-400"
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
              <StickyNote className="w-5 h-5 text-dorito-500" />
              <h2 className="text-lg font-bold text-white font-sans">Notes & Documentation</h2>
            </div>
            <button
              onClick={handleSaveNote}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shadow-md shadow-dorito-500/20 transition-all font-mono"
            >
              {noteSaved ? <Check className="w-3.5 h-3.5 text-emerald-950" /> : <Save className="w-3.5 h-3.5" />}
              <span>{noteSaved ? 'Saved!' : 'Save Notes'}</span>
            </button>
          </div>

          <div className="rounded-xl bg-carbon-900 border border-carbon-700 p-4 shadow-lg flex flex-col h-[520px]">
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Notes title"
              className="bg-transparent border-b border-carbon-700 pb-2 mb-3 text-sm font-bold text-white focus:outline-none focus:border-dorito-500 font-sans"
            />
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Document configuration details, tokens, backup directories, cron schedules, or helpful command snippets..."
              className="flex-1 w-full bg-carbon-850/60 border border-carbon-700 rounded-lg p-3 text-xs sm:text-sm text-carbon-100 placeholder-carbon-500 focus:outline-none focus:border-dorito-500 font-mono resize-none leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Add Port Modal */}
      {addPortModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-1 font-sans">Register Port</h3>
            <p className="text-xs text-carbon-400 mb-4 font-mono">Record port assignments and service mappings for documentation</p>

            <form onSubmit={handleAddPort} className="space-y-3 font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-carbon-300 mb-1">Port</label>
                  <input
                    type="number"
                    value={newPort}
                    onChange={(e) => setNewPort(parseInt(e.target.value) || 80)}
                    required
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-carbon-300 mb-1">Protocol</label>
                  <select
                    value={newProto}
                    onChange={(e) => setNewProto(e.target.value)}
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-carbon-300 mb-1">Service Name</label>
                <input
                  type="text"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  placeholder="PostgreSQL / Grafana / API Gateway"
                  required
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs text-carbon-300 mb-1">Description / Purpose</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Main production database for microservices"
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddPortModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-carbon-850 text-carbon-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-dorito-500 text-carbon-950 font-bold text-xs hover:bg-dorito-600 shadow-md shadow-dorito-500/20"
                >
                  Save Port
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Tunnel Modal */}
      {addTunnelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-1 font-sans">Create SSH Tunnel</h3>
            <p className="text-xs text-carbon-400 mb-4 font-mono">Forward remote server port to NijiPanel local network interface</p>

            <form onSubmit={handleAddTunnel} className="space-y-3 font-mono">
              <div>
                <label className="block text-xs text-carbon-300 mb-1">Tunnel Name</label>
                <input
                  type="text"
                  value={tunnelName}
                  onChange={(e) => setTunnelName(e.target.value)}
                  placeholder="Remote Postgres Access"
                  required
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-carbon-300 mb-1">Local Port</label>
                  <input
                    type="number"
                    value={localPort}
                    onChange={(e) => setLocalPort(parseInt(e.target.value) || 8080)}
                    required
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-carbon-300 mb-1">Remote Port</label>
                  <input
                    type="number"
                    value={remotePort}
                    onChange={(e) => setRemotePort(parseInt(e.target.value) || 8080)}
                    required
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-carbon-300 mb-1">Remote Target Host</label>
                <input
                  type="text"
                  value={remoteHost}
                  onChange={(e) => setRemoteHost(e.target.value)}
                  placeholder="127.0.0.1"
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddTunnelModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-carbon-850 text-carbon-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-dorito-500 text-carbon-950 font-bold text-xs hover:bg-dorito-600 shadow-md shadow-dorito-500/20"
                >
                  Create Tunnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
