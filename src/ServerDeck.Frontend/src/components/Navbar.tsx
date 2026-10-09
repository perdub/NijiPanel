import React, { useState } from 'react';
import {
  Server,
  Layers,
  FolderGit2,
  FolderTree,
  Terminal,
  Network,
  Wrench,
  Key,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Plus,
  ShoppingBag,
  Cpu,
  Bell,
  Shield,
  Clock
} from 'lucide-react';
import { Host } from '../types';
import { DoritoLogo } from './DoritoLogo';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hosts: Host[];
  selectedHostId: string | null;
  setSelectedHostId: (id: string) => void;
  onOpenAddHost: () => void;
  onOpenSettings: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
  onLogout: () => void;
  username?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  hosts,
  selectedHostId,
  setSelectedHostId,
  onOpenAddHost,
  onOpenSettings,
  onOpenNotifications,
  unreadCount = 0,
  onLogout,
  username
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hostDropdownOpen, setHostDropdownOpen] = useState(false);

  const selectedHost = hosts.find((h) => h.id === selectedHostId) || hosts[0];

  const navItems = [
    { id: 'hosts', label: 'Hosts', icon: Server, requiresHost: false },
    { id: 'services', label: 'Services', icon: Cpu, requiresHost: true },
    { id: 'appstore', label: 'App Store', icon: ShoppingBag, requiresHost: true },
    { id: 'docker', label: 'Containers', icon: Layers, requiresHost: true },
    { id: 'compose', label: 'Compose', icon: FolderGit2, requiresHost: true },
    { id: 'files', label: 'File Manager', icon: FolderTree, requiresHost: true },
    { id: 'cron', label: 'Cron', icon: Clock, requiresHost: true },
    { id: 'terminal', label: 'Terminal', icon: Terminal, requiresHost: true },
    { id: 'ports', label: 'Port Registry', icon: Network, requiresHost: true },
    { id: 'firewall', label: 'Firewall', icon: Shield, requiresHost: true },
    { id: 'utils', label: 'Utils', icon: Wrench, requiresHost: false },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-carbon-900 border-b border-carbon-700 sticky top-0 z-40 select-none shadow-md backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand: NijiPanel - The Drummer of Your Servers */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTabClick('hosts')}
              className="flex items-center gap-2.5 group transition-transform active:scale-95 text-left"
              title="NijiPanel ★ Nijika Edition — The Drummer of Your Servers"
            >
              <div className="relative">
                <DoritoLogo size={36} className="group-hover:rotate-6 transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(255,209,0,0.35)]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-medium text-base sm:text-lg tracking-tight text-white font-sans">
                    Niji<span className="text-dorito-500">Panel</span>
                  </span>
                  <span className="hidden md:inline-flex text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/40 text-dorito-400 font-semibold">
                    ★ Nijika
                  </span>
                </div>
                <span className="text-[10px] font-mono text-carbon-400 leading-tight hidden sm:block truncate">
                  The Drummer of Your Servers
                </span>
              </div>
            </button>

            {/* Active Host Selector (Carbon Style) */}
            {hosts.length > 0 && (
              <div className="relative ml-2 sm:ml-4">
                <button
                  onClick={() => setHostDropdownOpen(!hostDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs sm:text-sm font-medium text-carbon-100 transition-colors shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="max-w-[110px] sm:max-w-[170px] truncate font-mono text-xs">
                    {selectedHost ? selectedHost.name : 'Select host'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-carbon-400" />
                </button>

                {hostDropdownOpen && (
                  <div
                    className="absolute left-0 mt-1 w-64 rounded-xl bg-carbon-900 border border-carbon-700 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                    onMouseLeave={() => setHostDropdownOpen(false)}
                  >
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-carbon-400 border-b border-carbon-700 flex justify-between items-center">
                      <span className="font-mono text-[11px]">Hosts ({hosts.length})</span>
                      <button
                        onClick={() => {
                          setHostDropdownOpen(false);
                          onOpenAddHost();
                        }}
                        className="text-dorito-500 hover:text-dorito-400 font-mono text-xs flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add Host
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {hosts.map((h) => {
                        const isCurrent = h.id === selectedHostId;
                        return (
                          <button
                            key={h.id}
                            onClick={() => {
                              setSelectedHostId(h.id);
                              setHostDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-carbon-800 transition-colors ${
                              isCurrent
                                ? 'bg-dorito-500/10 text-dorito-500 font-semibold border-l-2 border-dorito-500'
                                : 'text-carbon-200'
                            }`}
                          >
                            <div className="truncate">
                              <div className="truncate font-medium">{h.name}</div>
                              <div className="text-[10px] text-carbon-400 truncate font-mono">
                                {h.username}@{h.host}:{h.port}
                              </div>
                            </div>
                            {isCurrent && (
                              <span className="w-1.5 h-1.5 rounded-full bg-dorito-500 ml-2 shrink-0"></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Navigation: Carbon Interactive Tabs */}
          <nav className="hidden md:flex items-center space-x-0.5 lg:space-x-1 h-16">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isDisabled = item.requiresHost && hosts.length === 0;

              return (
                <button
                  key={item.id}
                  onClick={() => !isDisabled && handleTabClick(item.id)}
                  disabled={isDisabled}
                  className={`h-16 px-3 lg:px-3.5 inline-flex items-center gap-2 text-xs font-medium border-b-2 transition-all relative ${
                    isActive
                      ? 'border-dorito-500 text-dorito-500 bg-carbon-850/70 font-semibold shadow-[inset_0_-2px_0_0_#ffd100]'
                      : isDisabled
                      ? 'border-transparent opacity-35 cursor-not-allowed text-carbon-500'
                      : 'border-transparent text-carbon-400 hover:text-white hover:bg-carbon-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-dorito-500' : ''}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User, Drummer Rhythm Easter Egg & Settings Actions */}
          <div className="flex items-center gap-2">
            {/* Nijika Drummer Rhythm Pill (Easter Egg) */}
            <div
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-carbon-850 border border-carbon-700 text-[11px] font-mono text-carbon-300"
              title="Kessoku Band Rhythm Engine: 140 BPM synced with server heartbeat"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-dorito-500 animate-ping"></span>
              <span className="text-dorito-400 font-semibold">140 BPM</span>
              <span>🥁</span>
            </div>

            {/* Notification Center Bell with Red Badge */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-lg text-carbon-400 hover:text-dorito-500 hover:bg-carbon-800 transition-colors"
              title="Notification Center & Alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-mono font-medium text-white shadow-sm ring-2 ring-carbon-900 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-carbon-400 hover:text-dorito-500 hover:bg-carbon-800 transition-colors"
              title="Master Key & Password Settings"
            >
              <Key className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-carbon-400 hover:text-rose-400 hover:bg-carbon-800 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-carbon-300 hover:text-white hover:bg-carbon-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-carbon-700 bg-carbon-900 px-4 pt-2 pb-4 space-y-1 shadow-2xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isDisabled = item.requiresHost && hosts.length === 0;

            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && handleTabClick(item.id)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-dorito-500 text-carbon-950 font-bold'
                    : isDisabled
                    ? 'opacity-40 cursor-not-allowed text-carbon-500'
                    : 'text-carbon-300 hover:bg-carbon-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
