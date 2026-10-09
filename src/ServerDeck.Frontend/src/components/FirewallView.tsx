import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Check,
  Unlock,
  Lock,
  Search,
  Server,
  Terminal,
  Activity,
  Layers
} from 'lucide-react';
import { Host, FirewallStatus, FirewallRule, Fail2banStatus, CreateFirewallRuleRequest } from '../types';
import { api } from '../api';

interface FirewallViewProps {
  selectedHost: Host | null;
}

export const FirewallView: React.FC<FirewallViewProps> = ({ selectedHost }) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'fail2ban'>('rules');
  const [firewallStatus, setFirewallStatus] = useState<FirewallStatus | null>(null);
  const [fail2banStatus, setFail2banStatus] = useState<Fail2banStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add rule modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newPort, setNewPort] = useState('');
  const [newProto, setNewProto] = useState('tcp');
  const [newAction, setNewAction] = useState('allow');
  const [newFrom, setNewFrom] = useState('');

  // Manual unban state
  const [manualUnbanIp, setManualUnbanIp] = useState('');
  const [filterQuery, setFilterQuery] = useState('');

  const fetchData = async () => {
    if (!selectedHost) return;
    setLoading(true);
    setError(null);
    try {
      const [fw, f2b] = await Promise.all([
        api.firewall.getRules(selectedHost.id).catch(() => null),
        api.firewall.getFail2ban(selectedHost.id).catch(() => null),
      ]);
      if (fw) setFirewallStatus(fw);
      if (f2b) setFail2banStatus(f2b);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch firewall status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedHost?.id]);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || !newPort.trim()) return;

    setActionLoading(true);
    setError(null);
    try {
      const req: CreateFirewallRuleRequest = {
        port: newPort.trim(),
        protocol: newProto,
        action: newAction,
        from: newFrom.trim() || undefined,
      };
      const res = await api.firewall.addRule(selectedHost.id, req);
      if (res.success) {
        setSuccessMsg(res.message);
        setAddModalOpen(false);
        setNewPort('');
        setNewFrom('');
        fetchData();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add firewall rule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRule = async (ruleNumber: number) => {
    if (!selectedHost) return;
    if (!confirm(`Are you sure you want to delete firewall rule #${ruleNumber}?`)) return;

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.firewall.deleteRule(selectedHost.id, ruleNumber);
      if (res.success) {
        setSuccessMsg(res.message);
        fetchData();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete rule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbanIp = async (ip: string, jail?: string) => {
    if (!selectedHost) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.firewall.unbanIp(selectedHost.id, ip, jail);
      if (res.success) {
        setSuccessMsg(res.message);
        fetchData();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unban IP');
    } finally {
      setActionLoading(false);
    }
  };

  if (!selectedHost) {
    return (
      <div className="bg-carbon-900 border border-carbon-700 rounded-xl p-10 text-center text-carbon-400">
        <Server className="w-10 h-10 mx-auto mb-3 opacity-30 text-dorito-500" />
        <h3 className="text-base font-bold text-white mb-1">No Host Selected</h3>
        <p className="text-xs font-mono">Please select or connect a server from the top bar to inspect firewall rules.</p>
      </div>
    );
  }

  const filteredRules = (firewallStatus?.rules || []).filter((r) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      r.to.toLowerCase().includes(q) ||
      r.from.toLowerCase().includes(q) ||
      r.action.toLowerCase().includes(q) ||
      r.protocol.toLowerCase().includes(q)
    );
  });

  const filteredBannedIps = (fail2banStatus?.bannedIps || []).filter((ip) => {
    if (!filterQuery) return true;
    return ip.toLowerCase().includes(filterQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Host Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-carbon-700">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-dorito-500" />
            <h2 className="text-xl font-bold text-white tracking-tight">Security & Firewall Sentinel</h2>
            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-semibold uppercase">
              {selectedHost.name}
            </span>
          </div>
          <p className="text-xs text-carbon-400 mt-1 font-mono">
            UFW port policies, active packet filters & Fail2ban intrusion defense
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-mono text-carbon-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-dorito-500' : ''}`} />
            <span>Refresh</span>
          </button>

          {activeTab === 'rules' && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs font-mono shadow-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Port Rule</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Errors */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs Switcher: UFW vs Fail2ban */}
      <div className="flex items-center space-x-1 border-b border-carbon-700">
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-colors ${
            activeTab === 'rules'
              ? 'border-dorito-500 text-dorito-400 font-bold bg-carbon-850/50'
              : 'border-transparent text-carbon-400 hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Firewall Rules (UFW)</span>
          {firewallStatus && (
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                firewallStatus.isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-carbon-800 text-carbon-400 border border-carbon-700'
              }`}
            >
              {firewallStatus.isActive ? 'Active' : 'Inactive'}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('fail2ban')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-colors ${
            activeTab === 'fail2ban'
              ? 'border-dorito-500 text-dorito-400 font-bold bg-carbon-850/50'
              : 'border-transparent text-carbon-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Fail2ban Sentinel</span>
          {fail2banStatus && (
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                fail2banStatus.isRunning
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  : 'bg-carbon-800 text-carbon-400 border border-carbon-700'
              }`}
            >
              {fail2banStatus.currentlyBanned} Banned
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: FIREWALL RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {/* Quick Summary Pill */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-carbon-900 border border-carbon-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-carbon-400 uppercase">Engine Status</span>
                <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      firewallStatus?.isActive ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <span>{firewallStatus?.statusText || 'Checking...'}</span>
                </div>
              </div>
              <ShieldCheck className="w-5 h-5 text-emerald-400 opacity-60" />
            </div>

            <div className="p-3.5 rounded-xl bg-carbon-900 border border-carbon-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-carbon-400 uppercase">Active Rules</span>
                <div className="text-sm font-bold text-dorito-400 mt-0.5 font-mono">
                  {firewallStatus?.rules.length ?? 0} Rules
                </div>
              </div>
              <Layers className="w-5 h-5 text-dorito-500 opacity-60" />
            </div>

            <div className="p-3.5 rounded-xl bg-carbon-900 border border-carbon-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-carbon-400 uppercase">Backend Provider</span>
                <div className="text-sm font-bold text-white mt-0.5 uppercase font-mono">
                  {firewallStatus?.backend || 'UFW'}
                </div>
              </div>
              <Terminal className="w-5 h-5 text-carbon-400 opacity-60" />
            </div>
          </div>

          {/* Search / Filter */}
          <div className="relative">
            <Search className="w-4 h-4 text-carbon-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ports, rules, or IP ranges..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-carbon-900 border border-carbon-700 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500"
            />
          </div>

          {/* Rules Table */}
          <div className="rounded-xl border border-carbon-700 bg-carbon-900 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-carbon-850 border-b border-carbon-700 text-carbon-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">To (Port / Service)</th>
                    <th className="py-2.5 px-4">Proto</th>
                    <th className="py-2.5 px-4">From (Source)</th>
                    <th className="py-2.5 px-4">Direction</th>
                    <th className="py-2.5 px-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-carbon-800 text-carbon-200">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-carbon-500 text-xs font-sans">
                        {firewallStatus?.isActive
                          ? 'No active firewall rules defined'
                          : 'Firewall is currently inactive or not returning rules'}
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((rule) => {
                      const isAllow = rule.action.toUpperCase().includes('ALLOW');
                      return (
                        <tr key={rule.number} className="hover:bg-carbon-850/60 transition-colors">
                          <td className="py-2.5 px-3 text-center text-carbon-500">{rule.number}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isAllow
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {rule.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-white">{rule.to}</td>
                          <td className="py-2.5 px-4 uppercase text-carbon-300">{rule.protocol}</td>
                          <td className="py-2.5 px-4 text-carbon-300">{rule.from}</td>
                          <td className="py-2.5 px-4 text-carbon-400">{rule.direction || 'IN'}</td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteRule(rule.number)}
                              disabled={actionLoading}
                              className="p-1 rounded text-carbon-500 hover:text-rose-400 hover:bg-carbon-800 transition-colors"
                              title={`Delete rule #${rule.number}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FAIL2BAN SENTINEL */}
      {activeTab === 'fail2ban' && (
        <div className="space-y-4">
          {/* Status summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-carbon-900 border border-carbon-700">
              <span className="text-[10px] font-mono text-carbon-400 uppercase">Fail2ban Status</span>
              <div className="text-sm font-bold text-white mt-1 flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    fail2banStatus?.isRunning ? 'bg-emerald-400' : 'bg-rose-500'
                  }`}
                />
                <span>
                  {fail2banStatus?.isInstalled
                    ? fail2banStatus.isRunning
                      ? 'Sentinel Active'
                      : 'Installed (Stopped)'
                    : 'Not Installed'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-carbon-900 border border-carbon-700">
              <span className="text-[10px] font-mono text-carbon-400 uppercase">Currently Banned</span>
              <div className="text-xl font-black text-rose-400 mt-0.5 font-mono">
                {fail2banStatus?.currentlyBanned ?? 0}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-carbon-900 border border-carbon-700">
              <span className="text-[10px] font-mono text-carbon-400 uppercase">Total Interceptions</span>
              <div className="text-xl font-black text-dorito-400 mt-0.5 font-mono">
                {fail2banStatus?.totalBanned ?? 0}
              </div>
            </div>
          </div>

          {/* Active Jails */}
          {fail2banStatus?.jails && fail2banStatus.jails.length > 0 && (
            <div className="p-3.5 rounded-xl bg-carbon-900 border border-carbon-700 flex items-center gap-2 text-xs font-mono">
              <span className="text-carbon-400">Active Jails:</span>
              <div className="flex flex-wrap gap-1.5">
                {fail2banStatus.jails.map((j) => (
                  <span
                    key={j}
                    className="px-2 py-0.5 rounded bg-carbon-800 border border-carbon-700 text-dorito-400 text-[11px] font-semibold"
                  >
                    {j}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Manual Unban Form */}
          <div className="p-4 rounded-xl bg-carbon-900 border border-carbon-700 flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              placeholder="Enter IP address to manually unban (e.g. 192.168.1.50)..."
              value={manualUnbanIp}
              onChange={(e) => setManualUnbanIp(e.target.value)}
              className="flex-1 bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 w-full"
            />
            <button
              onClick={() => {
                if (manualUnbanIp.trim()) {
                  handleUnbanIp(manualUnbanIp.trim());
                  setManualUnbanIp('');
                }
              }}
              disabled={actionLoading || !manualUnbanIp.trim()}
              className="px-4 py-2 rounded-lg bg-carbon-800 hover:bg-carbon-750 border border-carbon-600 text-xs font-mono text-dorito-400 font-bold hover:text-white transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unban IP</span>
            </button>
          </div>

          {/* Banned IPs Table */}
          <div className="rounded-xl border border-carbon-700 bg-carbon-900 overflow-hidden shadow-lg">
            <div className="px-4 py-3 border-b border-carbon-700 bg-carbon-850 flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Banned IP Addresses ({fail2banStatus?.bannedIps?.length ?? 0})
              </h3>
            </div>

            <div className="divide-y divide-carbon-800">
              {filteredBannedIps.length === 0 ? (
                <div className="py-10 text-center text-carbon-500 text-xs font-sans">
                  {fail2banStatus?.isRunning
                    ? 'No IPs are currently banned by Fail2ban'
                    : 'Fail2ban is not actively running on this host'}
                </div>
              ) : (
                filteredBannedIps.map((ip) => (
                  <div
                    key={ip}
                    className="p-3.5 flex items-center justify-between hover:bg-carbon-850/60 transition-colors font-mono text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span className="font-bold text-white">{ip}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Banned
                      </span>
                    </div>

                    <button
                      onClick={() => handleUnbanIp(ip)}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-dorito-400 text-xs font-medium border border-carbon-700 transition-colors"
                      title="1-Click Unban"
                    >
                      <Unlock className="w-3 h-3" />
                      <span>Unban</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Rule Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative">
            <h3 className="text-base font-bold text-white mb-1">Add Firewall Rule</h3>
            <p className="text-xs text-carbon-400 mb-4 font-mono">
              Apply inbound packet filtering policy via UFW
            </p>

            <form onSubmit={handleAddRule} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-carbon-300 mb-1">Port or Port Range</label>
                <input
                  type="text"
                  placeholder="e.g. 80, 443, or 8000:8080"
                  value={newPort}
                  onChange={(e) => setNewPort(e.target.value)}
                  required
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-carbon-300 mb-1">Protocol</label>
                  <select
                    value={newProto}
                    onChange={(e) => setNewProto(e.target.value)}
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-dorito-500"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="any">ANY</option>
                  </select>
                </div>

                <div>
                  <label className="block text-carbon-300 mb-1">Action</label>
                  <select
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value)}
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-dorito-500"
                  >
                    <option value="allow">ALLOW</option>
                    <option value="deny">DENY</option>
                    <option value="reject">REJECT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-carbon-300 mb-1">Source IP / Subnet (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty for Anywhere, or e.g. 192.168.1.0/24"
                  value={newFrom}
                  onChange={(e) => setNewFrom(e.target.value)}
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-carbon-800">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-carbon-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !newPort.trim()}
                  className="px-4 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold transition-colors shadow-md disabled:opacity-40"
                >
                  {actionLoading ? 'Applying...' : 'Apply Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
