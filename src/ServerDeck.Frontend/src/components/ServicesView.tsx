import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Users,
  Package,
  RotateCw,
  Play,
  Square,
  FileText,
  X,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  UserPlus,
  Trash2,
  ArrowUpCircle,
  RefreshCw,
  Check,
  Copy,
  AlertCircle,
  CheckCircle2,
  Ban,
  Clock,
  Terminal,
  ChevronRight,
  Download
} from 'lucide-react';
import {
  Host,
  SystemdService,
  LinuxUser,
  PackageUpdateCheckResult,
  PackageUpgradeResult
} from '../types';
import { api } from '../api';

interface ServicesViewProps {
  selectedHost: Host | null;
  hosts: Host[];
  onSelectHost?: (id: string) => void;
  initialSubTab?: 'services' | 'users' | 'packages';
}

export const ServicesView: React.FC<ServicesViewProps> = ({
  selectedHost,
  hosts,
  onSelectHost,
  initialSubTab = 'services'
}) => {
  const [subTab, setSubTab] = useState<'services' | 'users' | 'packages'>(initialSubTab);

  // 1. Systemd States
  const [services, setServices] = useState<SystemdService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'running' | 'failed' | 'inactive'>('all');
  const [actionLoadingUnit, setActionLoadingUnit] = useState<string | null>(null);

  // Journalctl Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerUnit, setDrawerUnit] = useState<string | null>(null);
  const [drawerLogs, setDrawerLogs] = useState<string>('');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerLines, setDrawerLines] = useState<number>(100);
  const [drawerPriority, setDrawerPriority] = useState<string>('');
  const [drawerCopied, setDrawerCopied] = useState(false);

  // 2. Linux Users States
  const [users, setUsers] = useState<LinuxUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'real' | 'all' | 'system'>('real');
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newShell, setNewShell] = useState('/bin/bash');
  const [newSudo, setNewSudo] = useState(false);
  const [newCreateHome, setNewCreateHome] = useState(true);
  const [creatingUser, setCreatingUser] = useState(false);

  // 3. Package Updates States
  const [pkgResult, setPkgResult] = useState<PackageUpdateCheckResult | null>(null);
  const [checkingPkgs, setCheckingPkgs] = useState(false);
  const [upgradingPkgs, setUpgradingPkgs] = useState(false);
  const [pkgUpgradeResult, setPkgUpgradeResult] = useState<PackageUpgradeResult | null>(null);
  const [pkgError, setPkgError] = useState<string | null>(null);

  // Fetch Services
  const fetchServices = async () => {
    if (!selectedHost) return;
    setLoadingServices(true);
    setServicesError(null);
    try {
      const data = await api.systemd.list(selectedHost.id);
      setServices(data);
    } catch (err: any) {
      setServicesError(err.message || 'Failed to load systemd services');
    } finally {
      setLoadingServices(false);
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    if (!selectedHost) return;
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const data = await api.users.list(selectedHost.id);
      setUsers(data);
    } catch (err: any) {
      setUsersError(err.message || 'Failed to load Linux users');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Check Packages
  const checkPackages = async () => {
    if (!selectedHost) return;
    setCheckingPkgs(true);
    setPkgError(null);
    try {
      const data = await api.packages.check(selectedHost.id);
      setPkgResult(data);
    } catch (err: any) {
      setPkgError(err.message || 'Failed to check package updates');
    } finally {
      setCheckingPkgs(false);
    }
  };

  // Load data based on current subTab
  useEffect(() => {
    if (!selectedHost) return;
    if (subTab === 'services') fetchServices();
    if (subTab === 'users') fetchUsers();
    if (subTab === 'packages' && !pkgResult) checkPackages();
  }, [selectedHost?.id, subTab]);

  // Systemd Actions
  const handleServiceAction = async (unitName: string, action: string) => {
    if (!selectedHost) return;
    setActionLoadingUnit(`${unitName}:${action}`);
    try {
      const res = await api.systemd.action(selectedHost.id, unitName, action);
      if (!res.success) {
        alert(`Action '${action}' failed: ${res.error || res.output}`);
      }
      await fetchServices();
    } catch (err: any) {
      alert(`Action '${action}' failed: ${err.message}`);
    } finally {
      setActionLoadingUnit(null);
    }
  };

  // Open Journalctl Drawer
  const openJournalctl = async (unitName: string) => {
    setDrawerUnit(unitName);
    setDrawerOpen(true);
    loadDrawerLogs(unitName, drawerLines, drawerPriority);
  };

  const loadDrawerLogs = async (unitName: string, lines: number, priority?: string) => {
    if (!selectedHost) return;
    setDrawerLoading(true);
    try {
      const res = await api.systemd.logs(selectedHost.id, unitName, lines, priority || undefined);
      setDrawerLogs(res.logs);
    } catch (err: any) {
      setDrawerLogs(`Failed to fetch logs: ${err.message}`);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCopyLogs = () => {
    if (!drawerLogs) return;
    navigator.clipboard.writeText(drawerLogs);
    setDrawerCopied(true);
    setTimeout(() => setDrawerCopied(false), 2000);
  };

  // Users Actions
  const handleToggleSudo = async (user: LinuxUser) => {
    if (!selectedHost) return;
    setUserActionLoading(user.username);
    try {
      await api.users.toggleSudo(selectedHost.id, user.username);
      await fetchUsers();
    } catch (err: any) {
      alert(`Toggle sudo failed: ${err.message}`);
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleToggleLock = async (user: LinuxUser) => {
    if (!selectedHost) return;
    setUserActionLoading(user.username);
    try {
      if (user.isLocked) {
        await api.users.unlock(selectedHost.id, user.username);
      } else {
        await api.users.lock(selectedHost.id, user.username);
      }
      await fetchUsers();
    } catch (err: any) {
      alert(`Account lock/unlock failed: ${err.message}`);
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleDeleteUser = async (user: LinuxUser) => {
    if (!selectedHost) return;
    const removeHome = confirm(`Delete user '${user.username}'? Click OK to remove home directory (${user.homeDirectory}) as well, or Cancel to abort.`);
    if (!removeHome && !confirm(`Delete user '${user.username}' while KEEPING their home directory?`)) return;

    setUserActionLoading(user.username);
    try {
      await api.users.delete(selectedHost.id, user.username, removeHome);
      await fetchUsers();
    } catch (err: any) {
      alert(`Delete user failed: ${err.message}`);
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || !newUsername.trim()) return;

    setCreatingUser(true);
    try {
      await api.users.create(selectedHost.id, {
        username: newUsername.trim(),
        password: newPassword ? newPassword : undefined,
        shell: newShell,
        sudo: newSudo,
        createHome: newCreateHome
      });
      setAddUserModalOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewSudo(false);
      await fetchUsers();
    } catch (err: any) {
      alert(`Create user failed: ${err.message}`);
    } finally {
      setCreatingUser(false);
    }
  };

  // Upgrade Packages
  const handleRunUpgrade = async () => {
    if (!selectedHost) return;
    if (!confirm(`Launch background OS package upgrade on ${selectedHost.name}? This will execute safe non-interactive upgrade via ${pkgResult?.packageManager || 'apt/dnf'}.`)) {
      return;
    }

    setUpgradingPkgs(true);
    setPkgUpgradeResult(null);
    try {
      const res = await api.packages.upgrade(selectedHost.id);
      setPkgUpgradeResult(res);
      await checkPackages();
    } catch (err: any) {
      alert(`Upgrade failed: ${err.message}`);
    } finally {
      setUpgradingPkgs(false);
    }
  };

  if (!selectedHost) {
    return (
      <div className="p-8 text-center bg-carbon-900 border border-carbon-700 rounded-xl">
        <Cpu className="w-12 h-12 text-carbon-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-white mb-1">No Host Selected</h3>
        <p className="text-xs text-carbon-400 font-mono">
          Select or add a host from the Hosts view to access Systemd, User Management, and OS Updates.
        </p>
      </div>
    );
  }

  // Filtered Services
  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.unit.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      s.description.toLowerCase().includes(serviceSearch.toLowerCase());
    if (!matchesSearch) return false;

    if (serviceFilter === 'running') return s.active.toLowerCase() === 'active' && s.sub.toLowerCase() === 'running';
    if (serviceFilter === 'failed') return s.active.toLowerCase() === 'failed' || s.sub.toLowerCase() === 'failed';
    if (serviceFilter === 'inactive') return s.active.toLowerCase() === 'inactive';
    return true;
  });

  // Service counters
  const runningCount = services.filter((s) => s.active.toLowerCase() === 'active' && s.sub.toLowerCase() === 'running').length;
  const failedCount = services.filter((s) => s.active.toLowerCase() === 'failed' || s.sub.toLowerCase() === 'failed').length;

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.groups.some((g) => g.toLowerCase().includes(userSearch.toLowerCase()));
    if (!matchesSearch) return false;

    if (userTypeFilter === 'real') return !u.isSystem;
    if (userTypeFilter === 'system') return u.isSystem;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & SubTabs Bar (IBM Carbon Style) */}
      <div className="bg-carbon-900 border border-carbon-700 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-carbon-750 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <h2 className="text-xl font-bold text-white font-sans tracking-tight">
                Host Administration & Hardening
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-carbon-800 border border-carbon-700 text-carbon-300">
                {selectedHost.name} ({selectedHost.host}:{selectedHost.port})
              </span>
            </div>
            <p className="text-xs text-carbon-400 mt-1 font-mono">
              Direct cockpit control for Systemd units, OS user accounts, and APT/DNF package updates.
            </p>
          </div>

          {/* SubTab Switcher */}
          <div className="flex items-center gap-1 bg-carbon-950 p-1 rounded-lg border border-carbon-750 self-start md:self-auto">
            <button
              onClick={() => setSubTab('services')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                subTab === 'services'
                  ? 'bg-dorito-500 text-carbon-950 font-bold shadow-sm'
                  : 'text-carbon-300 hover:text-white hover:bg-carbon-850'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Systemd Services</span>
            </button>

            <button
              onClick={() => setSubTab('users')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                subTab === 'users'
                  ? 'bg-dorito-500 text-carbon-950 font-bold shadow-sm'
                  : 'text-carbon-300 hover:text-white hover:bg-carbon-850'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Users & Groups</span>
            </button>

            <button
              onClick={() => setSubTab('packages')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                subTab === 'packages'
                  ? 'bg-dorito-500 text-carbon-950 font-bold shadow-sm'
                  : 'text-carbon-300 hover:text-white hover:bg-carbon-850'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>OS Updates</span>
              {pkgResult && pkgResult.availableUpdatesCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-carbon-950 font-bold">
                  {pkgResult.availableUpdatesCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ---------------- SUBTAB 1: SYSTEMD SERVICES ---------------- */}
        {subTab === 'services' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-carbon-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Search unit name or description..."
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-carbon-500 font-mono focus:border-dorito-500 focus:outline-none"
                  />
                  {serviceSearch && (
                    <button
                      onClick={() => setServiceSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-carbon-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-carbon-850 border border-carbon-700 rounded-lg p-0.5 text-xs font-mono">
                  <button
                    onClick={() => setServiceFilter('all')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      serviceFilter === 'all'
                        ? 'bg-carbon-700 text-white font-semibold'
                        : 'text-carbon-400 hover:text-carbon-200'
                    }`}
                  >
                    All ({services.length})
                  </button>
                  <button
                    onClick={() => setServiceFilter('running')}
                    className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                      serviceFilter === 'running'
                        ? 'bg-emerald-500/20 text-emerald-400 font-semibold'
                        : 'text-carbon-400 hover:text-emerald-400'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Running ({runningCount})
                  </button>
                  <button
                    onClick={() => setServiceFilter('failed')}
                    className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                      serviceFilter === 'failed'
                        ? 'bg-rose-500/20 text-rose-400 font-semibold'
                        : 'text-carbon-400 hover:text-rose-400'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    Failed ({failedCount})
                  </button>
                  <button
                    onClick={() => setServiceFilter('inactive')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      serviceFilter === 'inactive'
                        ? 'bg-carbon-700 text-white font-semibold'
                        : 'text-carbon-400 hover:text-carbon-200'
                    }`}
                  >
                    Inactive
                  </button>
                </div>

                <button
                  onClick={fetchServices}
                  disabled={loadingServices}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 rounded-lg text-xs font-mono text-carbon-200 transition-colors"
                  title="Reload units"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingServices ? 'animate-spin text-dorito-500' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {servicesError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{servicesError}</span>
              </div>
            )}

            {/* Services Table */}
            <div className="border border-carbon-750 rounded-xl overflow-hidden bg-carbon-950">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs text-carbon-300 font-mono">
                  <thead className="bg-carbon-900 border-b border-carbon-750 text-carbon-400 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Unit Name</th>
                      <th className="py-2.5 px-3 hidden md:table-cell">Substate</th>
                      <th className="py-2.5 px-3 hidden lg:table-cell">Description</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-carbon-800/60">
                    {loadingServices && services.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-carbon-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-dorito-500" />
                          <span>Enumerating systemd units over SSH...</span>
                        </td>
                      </tr>
                    ) : filteredServices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-carbon-500">
                          No services matching filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredServices.map((svc) => {
                        const isRunning = svc.active.toLowerCase() === 'active' && svc.sub.toLowerCase() === 'running';
                        const isFailed = svc.active.toLowerCase() === 'failed' || svc.sub.toLowerCase() === 'failed';
                        const isActionBusy = actionLoadingUnit?.startsWith(`${svc.unit}:`);

                        return (
                          <tr
                            key={svc.unit}
                            className={`hover:bg-carbon-900/60 transition-colors ${
                              isFailed ? 'bg-rose-500/5' : ''
                            }`}
                          >
                            {/* Status badge */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  isFailed
                                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                    : isRunning
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-carbon-800 text-carbon-400 border border-carbon-700'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isFailed
                                      ? 'bg-rose-500'
                                      : isRunning
                                      ? 'bg-emerald-400 animate-pulse'
                                      : 'bg-carbon-500'
                                  }`}
                                />
                                {svc.active}
                              </span>
                            </td>

                            {/* Unit name */}
                            <td className="py-2.5 px-3 font-semibold text-white truncate max-w-[200px] sm:max-w-[280px]">
                              <span title={svc.unit}>{svc.unit}</span>
                            </td>

                            {/* Substate */}
                            <td className="py-2.5 px-3 text-carbon-400 hidden md:table-cell">
                              <span className="px-1.5 py-0.5 rounded bg-carbon-850 text-[10px] border border-carbon-800">
                                {svc.sub}
                              </span>
                            </td>

                            {/* Description */}
                            <td className="py-2.5 px-3 text-carbon-400 hidden lg:table-cell truncate max-w-[320px]">
                              <span title={svc.description}>{svc.description || '—'}</span>
                            </td>

                            {/* Action Buttons */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {/* Journalctl Logs */}
                                <button
                                  onClick={() => openJournalctl(svc.unit)}
                                  className="p-1.5 rounded hover:bg-carbon-800 text-carbon-400 hover:text-dorito-400 transition-colors"
                                  title="Live journalctl logs"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>

                                {/* Restart */}
                                <button
                                  onClick={() => handleServiceAction(svc.unit, 'restart')}
                                  disabled={isActionBusy}
                                  className="p-1.5 rounded hover:bg-carbon-800 text-carbon-400 hover:text-amber-400 transition-colors disabled:opacity-50"
                                  title="Restart service"
                                >
                                  <RotateCw className={`w-3.5 h-3.5 ${isActionBusy && actionLoadingUnit?.endsWith('restart') ? 'animate-spin text-amber-400' : ''}`} />
                                </button>

                                {/* Stop / Start */}
                                {isRunning ? (
                                  <button
                                    onClick={() => handleServiceAction(svc.unit, 'stop')}
                                    disabled={isActionBusy}
                                    className="p-1.5 rounded hover:bg-rose-500/20 text-carbon-400 hover:text-rose-400 transition-colors disabled:opacity-50"
                                    title="Stop service"
                                  >
                                    <Square className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleServiceAction(svc.unit, 'start')}
                                    disabled={isActionBusy}
                                    className="p-1.5 rounded hover:bg-emerald-500/20 text-carbon-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
                                    title="Start service"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
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

        {/* ---------------- SUBTAB 2: LINUX USERS & GROUPS ---------------- */}
        {subTab === 'users' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-carbon-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search username, group, or full name..."
                    className="w-full bg-carbon-850 border border-carbon-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-carbon-500 font-mono focus:border-dorito-500 focus:outline-none"
                  />
                  {userSearch && (
                    <button
                      onClick={() => setUserSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-carbon-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Real vs System Toggle */}
                <div className="flex items-center bg-carbon-850 border border-carbon-700 rounded-lg p-0.5 text-xs font-mono">
                  <button
                    onClick={() => setUserTypeFilter('real')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      userTypeFilter === 'real'
                        ? 'bg-carbon-700 text-white font-semibold'
                        : 'text-carbon-400 hover:text-carbon-200'
                    }`}
                  >
                    Interactive Users ({users.filter((u) => !u.isSystem).length})
                  </button>
                  <button
                    onClick={() => setUserTypeFilter('all')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      userTypeFilter === 'all'
                        ? 'bg-carbon-700 text-white font-semibold'
                        : 'text-carbon-400 hover:text-carbon-200'
                    }`}
                  >
                    All ({users.length})
                  </button>
                  <button
                    onClick={() => setUserTypeFilter('system')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      userTypeFilter === 'system'
                        ? 'bg-carbon-700 text-white font-semibold'
                        : 'text-carbon-400 hover:text-carbon-200'
                    }`}
                  >
                    System ({users.filter((u) => u.isSystem).length})
                  </button>
                </div>

                <button
                  onClick={() => setAddUserModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-dorito-500 hover:bg-dorito-400 text-carbon-950 font-bold rounded-lg text-xs font-mono transition-colors shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add User</span>
                </button>

                <button
                  onClick={fetchUsers}
                  disabled={loadingUsers}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 rounded-lg text-xs font-mono text-carbon-200 transition-colors"
                  title="Reload users"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin text-dorito-500' : ''}`} />
                </button>
              </div>
            </div>

            {usersError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{usersError}</span>
              </div>
            )}

            {/* Users Table */}
            <div className="border border-carbon-750 rounded-xl overflow-hidden bg-carbon-950">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs text-carbon-300 font-mono">
                  <thead className="bg-carbon-900 border-b border-carbon-750 text-carbon-400 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Username</th>
                      <th className="py-2.5 px-3">UID:GID</th>
                      <th className="py-2.5 px-3 hidden sm:table-cell">Privileges</th>
                      <th className="py-2.5 px-3 hidden md:table-cell">Home & Shell</th>
                      <th className="py-2.5 px-3 hidden lg:table-cell">Groups</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-carbon-800/60">
                    {loadingUsers && users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-carbon-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-dorito-500" />
                          <span>Reading /etc/passwd and /etc/group...</span>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-carbon-500">
                          No users matching filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isRoot = u.username === 'root';
                        const isBusy = userActionLoading === u.username;

                        return (
                          <tr key={u.username} className="hover:bg-carbon-900/60 transition-colors">
                            {/* Username & Lock Badge */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{u.username}</span>
                                {u.isLocked && (
                                  <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] uppercase font-bold">
                                    Locked
                                  </span>
                                )}
                                {isRoot && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] uppercase font-bold">
                                    Root
                                  </span>
                                )}
                              </div>
                              {u.fullName && (
                                <div className="text-[10px] text-carbon-400 truncate max-w-[160px]">
                                  {u.fullName}
                                </div>
                              )}
                            </td>

                            {/* UID:GID */}
                            <td className="py-2.5 px-3 text-carbon-400">
                              <span className="px-1.5 py-0.5 rounded bg-carbon-850 border border-carbon-800 text-[11px]">
                                {u.uid}:{u.gid}
                              </span>
                            </td>

                            {/* Sudo / Privileges */}
                            <td className="py-2.5 px-3 hidden sm:table-cell">
                              {u.isSudo ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-bold text-[10px] uppercase">
                                  <ShieldCheck className="w-3 h-3 text-dorito-500" /> Sudoer
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-carbon-850 text-carbon-400 text-[10px]">
                                  Standard
                                </span>
                              )}
                            </td>

                            {/* Home & Shell */}
                            <td className="py-2.5 px-3 hidden md:table-cell text-carbon-400">
                              <div className="truncate max-w-[180px]" title={u.homeDirectory}>
                                {u.homeDirectory}
                              </div>
                              <div className="text-[10px] text-carbon-500 truncate">{u.shell}</div>
                            </td>

                            {/* Groups */}
                            <td className="py-2.5 px-3 hidden lg:table-cell">
                              <div className="flex flex-wrap gap-1 max-w-[260px]">
                                {u.groups.slice(0, 4).map((g) => (
                                  <span
                                    key={g}
                                    className={`px-1.5 py-0.2 rounded text-[10px] border ${
                                      g === 'sudo' || g === 'wheel'
                                        ? 'bg-dorito-500/10 border-dorito-500/30 text-dorito-400 font-bold'
                                        : 'bg-carbon-850 border-carbon-800 text-carbon-400'
                                    }`}
                                  >
                                    {g}
                                  </span>
                                ))}
                                {u.groups.length > 4 && (
                                  <span className="text-[10px] text-carbon-500">
                                    +{u.groups.length - 4}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Action Buttons */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {/* Toggle Sudo */}
                                {!isRoot && (
                                  <button
                                    onClick={() => handleToggleSudo(u)}
                                    disabled={isBusy}
                                    className={`p-1.5 rounded transition-colors ${
                                      u.isSudo
                                        ? 'hover:bg-amber-500/20 text-dorito-400 hover:text-amber-300'
                                        : 'hover:bg-carbon-800 text-carbon-400 hover:text-dorito-400'
                                    }`}
                                    title={u.isSudo ? 'Remove from sudo/wheel' : 'Grant sudo privileges'}
                                  >
                                    <Shield className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Lock / Unlock */}
                                {!isRoot && (
                                  <button
                                    onClick={() => handleToggleLock(u)}
                                    disabled={isBusy}
                                    className={`p-1.5 rounded transition-colors ${
                                      u.isLocked
                                        ? 'hover:bg-emerald-500/20 text-rose-400 hover:text-emerald-400'
                                        : 'hover:bg-carbon-800 text-carbon-400 hover:text-rose-400'
                                    }`}
                                    title={u.isLocked ? 'Unlock account' : 'Lock account (passwd -l)'}
                                  >
                                    {u.isLocked ? (
                                      <Lock className="w-3.5 h-3.5 text-rose-400" />
                                    ) : (
                                      <Unlock className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}

                                {/* Delete */}
                                {!isRoot && (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    disabled={isBusy}
                                    className="p-1.5 rounded hover:bg-rose-500/20 text-carbon-400 hover:text-rose-400 transition-colors"
                                    title="Delete user"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
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

        {/* ---------------- SUBTAB 3: OS PACKAGE UPDATES ---------------- */}
        {subTab === 'packages' && (
          <div className="space-y-4">
            {/* Action Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-carbon-850 border border-carbon-750">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-dorito-500" />
                  <h3 className="text-base font-bold text-white">
                    1-Click OS Package Manager
                  </h3>
                  {pkgResult?.packageManager && (
                    <span className="px-2 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-mono text-[11px] font-bold uppercase">
                      {pkgResult.packageManager}
                    </span>
                  )}
                </div>
                <p className="text-xs text-carbon-400 mt-1 font-mono">
                  {pkgResult ? pkgResult.summary : 'Check pending system and security updates without manual SSH commands.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={checkPackages}
                  disabled={checkingPkgs || upgradingPkgs}
                  className="flex items-center gap-1.5 px-3 py-2 bg-carbon-800 hover:bg-carbon-750 border border-carbon-700 rounded-lg text-xs font-mono text-carbon-200 transition-colors shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingPkgs ? 'animate-spin text-dorito-500' : ''}`} />
                  <span>Check Updates</span>
                </button>

                {pkgResult && pkgResult.availableUpdatesCount > 0 && (
                  <button
                    onClick={handleRunUpgrade}
                    disabled={upgradingPkgs || checkingPkgs}
                    className="flex items-center gap-1.5 px-4 py-2 bg-dorito-500 hover:bg-dorito-400 text-carbon-950 font-bold rounded-lg text-xs font-mono transition-colors shadow-lg shadow-dorito-500/10 disabled:opacity-50"
                  >
                    <ArrowUpCircle className={`w-4 h-4 ${upgradingPkgs ? 'animate-spin' : ''}`} />
                    <span>{upgradingPkgs ? 'Upgrading Fleet...' : '1-Click Upgrade All'}</span>
                  </button>
                )}
              </div>
            </div>

            {pkgError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pkgError}</span>
              </div>
            )}

            {/* Counters Overview */}
            {pkgResult && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-carbon-950 border border-carbon-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-carbon-400 font-mono uppercase">Total Upgradable</div>
                    <div className="text-xl font-bold text-white font-mono mt-0.5">
                      {pkgResult.availableUpdatesCount}
                    </div>
                  </div>
                  <Package className="w-6 h-6 text-dorito-500 opacity-60" />
                </div>

                <div className="p-3.5 rounded-xl bg-carbon-950 border border-carbon-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-carbon-400 font-mono uppercase">Security Patches</div>
                    <div className="text-xl font-bold text-amber-400 font-mono mt-0.5">
                      {pkgResult.securityUpdatesCount}
                    </div>
                  </div>
                  <ShieldCheck className="w-6 h-6 text-amber-400 opacity-60" />
                </div>

                <div className="p-3.5 rounded-xl bg-carbon-950 border border-carbon-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-carbon-400 font-mono uppercase">Package Manager</div>
                    <div className="text-xl font-bold text-emerald-400 font-mono uppercase mt-0.5">
                      {pkgResult.packageManager}
                    </div>
                  </div>
                  <Cpu className="w-6 h-6 text-emerald-400 opacity-60" />
                </div>
              </div>
            )}

            {/* Upgrade Output Viewer (if run recently) */}
            {pkgUpgradeResult && (
              <div className="p-4 rounded-xl bg-carbon-950 border border-carbon-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${pkgUpgradeResult.success ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
                    <h4 className="text-xs font-bold text-white font-mono uppercase">
                      Upgrade Execution {pkgUpgradeResult.success ? 'Completed Successfully' : 'Failed with Code ' + pkgUpgradeResult.exitCode}
                    </h4>
                  </div>
                  <button
                    onClick={() => setPkgUpgradeResult(null)}
                    className="text-carbon-400 hover:text-white text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <pre className="p-3 bg-carbon-900 border border-carbon-750 rounded-lg text-[11px] text-carbon-200 font-mono max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {pkgUpgradeResult.output || pkgUpgradeResult.error}
                </pre>
              </div>
            )}

            {/* Upgradable Packages List */}
            {pkgResult && pkgResult.packages.length > 0 && (
              <div className="border border-carbon-750 rounded-xl overflow-hidden bg-carbon-950">
                <div className="px-4 py-2.5 bg-carbon-900 border-b border-carbon-750 flex items-center justify-between">
                  <span className="text-xs font-bold text-white font-mono uppercase">
                    Packages Pending Installation ({pkgResult.packages.length})
                  </span>
                </div>
                <div className="p-4 max-h-72 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {pkgResult.packages.map((pkg) => (
                      <span
                        key={pkg}
                        className="px-2.5 py-1 rounded bg-carbon-850 border border-carbon-750 text-carbon-200 text-xs font-mono hover:border-dorito-500/40 transition-colors"
                      >
                        {pkg}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------------- JOURNALCTL DRAWER (SLIDE-OVER) ---------------- */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-carbon-900 border-l border-carbon-700 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 bg-carbon-850 border-b border-carbon-700 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-dorito-500" />
                  <h3 className="font-bold text-white font-mono text-sm truncate">
                    {drawerUnit}
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-carbon-800 border border-carbon-700 text-carbon-400">
                    journalctl -u
                  </span>
                </div>
                <div className="text-[10px] text-carbon-400 font-mono mt-0.5">
                  Host: {selectedHost.name} ({selectedHost.host})
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyLogs}
                  className="p-1.5 rounded hover:bg-carbon-800 text-carbon-400 hover:text-white transition-colors"
                  title="Copy logs"
                >
                  {drawerCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => drawerUnit && loadDrawerLogs(drawerUnit, drawerLines, drawerPriority)}
                  disabled={drawerLoading}
                  className="p-1.5 rounded hover:bg-carbon-800 text-carbon-400 hover:text-dorito-500 transition-colors"
                  title="Refresh logs"
                >
                  <RefreshCw className={`w-4 h-4 ${drawerLoading ? 'animate-spin text-dorito-500' : ''}`} />
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded hover:bg-carbon-800 text-carbon-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter controls */}
            <div className="px-4 py-2.5 bg-carbon-950 border-b border-carbon-750 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-carbon-400">
                  <span>Lines:</span>
                  <select
                    value={drawerLines}
                    onChange={(e) => {
                      const l = parseInt(e.target.value);
                      setDrawerLines(l);
                      if (drawerUnit) loadDrawerLogs(drawerUnit, l, drawerPriority);
                    }}
                    className="bg-carbon-850 border border-carbon-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 text-carbon-400">
                  <span>Priority:</span>
                  <select
                    value={drawerPriority}
                    onChange={(e) => {
                      const p = e.target.value;
                      setDrawerPriority(p);
                      if (drawerUnit) loadDrawerLogs(drawerUnit, drawerLines, p);
                    }}
                    className="bg-carbon-850 border border-carbon-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                  >
                    <option value="">All Priorities</option>
                    <option value="err">Errors (err)</option>
                    <option value="warning">Warnings (warning)</option>
                    <option value="info">Info (info)</option>
                    <option value="debug">Debug (debug)</option>
                  </select>
                </div>
              </div>

              {drawerLoading && (
                <span className="text-[11px] text-dorito-500 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Fetching...
                </span>
              )}
            </div>

            {/* Log content */}
            <div className="flex-1 p-4 bg-[#0a0b0e] overflow-auto font-mono text-[11px] text-carbon-200">
              <pre className="whitespace-pre-wrap leading-relaxed select-text">
                {drawerLogs || 'No journalctl entries found.'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- ADD USER MODAL ---------------- */}
      {addUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-white mb-1 font-sans">
              Create New Linux User
            </h3>
            <p className="text-xs text-carbon-400 mb-4 font-mono">
              Creates account on {selectedHost.name} via useradd.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-carbon-300 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. deployer or developer"
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-dorito-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-carbon-300 mb-1">
                  Password (Optional)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave empty for key-only access"
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-dorito-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-carbon-300 mb-1">
                  Login Shell
                </label>
                <select
                  value={newShell}
                  onChange={(e) => setNewShell(e.target.value)}
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-dorito-500 focus:outline-none"
                >
                  <option value="/bin/bash">/bin/bash (Default)</option>
                  <option value="/bin/sh">/bin/sh</option>
                  <option value="/bin/zsh">/bin/zsh</option>
                  <option value="/usr/sbin/nologin">/usr/sbin/nologin (No interactive shell)</option>
                </select>
              </div>

              <div className="space-y-2 pt-2 border-t border-carbon-750">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSudo}
                    onChange={(e) => setNewSudo(e.target.checked)}
                    className="w-4 h-4 rounded bg-carbon-850 border-carbon-700 text-dorito-500 focus:ring-0"
                  />
                  <span className="text-xs text-carbon-200 font-mono">
                    Grant administrative privileges (sudo / wheel)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCreateHome}
                    onChange={(e) => setNewCreateHome(e.target.checked)}
                    className="w-4 h-4 rounded bg-carbon-850 border-carbon-700 text-dorito-500 focus:ring-0"
                  />
                  <span className="text-xs text-carbon-200 font-mono">
                    Create home directory (/home/{newUsername || 'username'})
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-carbon-300 text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-4 py-2 rounded-lg bg-dorito-500 hover:bg-dorito-400 text-carbon-950 font-bold text-xs font-mono shadow-md disabled:opacity-50"
                >
                  {creatingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
