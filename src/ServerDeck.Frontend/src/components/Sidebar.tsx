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
  ChevronDown,
  Plus,
  ShoppingBag,
  Cpu,
  Bell,
  Shield,
  Clock,
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { Host } from '../types';
import { DoritoLogo } from './DoritoLogo';

export interface SidebarProps {
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
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface NavSection {
  title: string;
  items: {
    id: string;
    label: string;
    icon: React.ElementType;
    requiresHost: boolean;
    badge?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
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
  username,
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const [hostDropdownOpen, setHostDropdownOpen] = useState(false);
  const selectedHost = hosts.find((h) => h.id === selectedHostId) || hosts[0];

  const sections: NavSection[] = [
    {
      title: 'CORE',
      items: [
        { id: 'hosts', label: 'Hosts & Fleet', icon: Server, requiresHost: false, badge: hosts.length ? `${hosts.length}` : undefined },
        { id: 'services', label: 'Services & Systemd', icon: Cpu, requiresHost: true },
        { id: 'terminal', label: 'SSH Terminal', icon: Terminal, requiresHost: true },
      ],
    },
    {
      title: 'APPLICATIONS',
      items: [
        { id: 'appstore', label: 'App Store', icon: ShoppingBag, requiresHost: true, badge: '32' },
        { id: 'docker', label: 'Containers', icon: Layers, requiresHost: true },
        { id: 'compose', label: 'Compose Studio', icon: FolderGit2, requiresHost: true },
      ],
    },
    {
      title: 'MANAGEMENT',
      items: [
        { id: 'files', label: 'File Manager', icon: FolderTree, requiresHost: true },
        { id: 'cron', label: 'Cron Tasks', icon: Clock, requiresHost: true },
        { id: 'ports', label: 'Port Registry', icon: Network, requiresHost: true },
        { id: 'firewall', label: 'Firewall Sentinel', icon: Shield, requiresHost: true },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'utils', label: 'Utilities', icon: Wrench, requiresHost: false },
      ],
    },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Rail / Full Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-carbon-950 border-r border-carbon-700 transition-all duration-200 select-none ${
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-64'}`}
      >
        {/* Top Brand Header */}
        <div className="h-16 flex items-center justify-between px-3 border-b border-carbon-700 bg-carbon-900/60">
          <div
            onClick={() => handleSelectTab('hosts')}
            className="flex items-center gap-2.5 cursor-pointer overflow-hidden py-1"
            title="NijiPanel ★ Nijika Edition — The Drummer of Your Servers"
          >
            <div className="shrink-0">
              <DoritoLogo size={32} />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-extrabold text-sm tracking-tight text-white font-sans">
                    Niji<span className="text-dorito-500">Panel</span>
                  </span>
                  <span className="text-[9px] font-mono uppercase px-1 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-semibold">
                    ★ NIJIKA
                  </span>
                </div>
                <span className="text-[10px] font-mono text-carbon-400 truncate mt-0.5">
                  Server Drummer
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center p-1.5 rounded text-carbon-400 hover:text-white hover:bg-carbon-800 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 text-carbon-400 hover:text-white hover:bg-carbon-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Context Dropdown */}
        <div className="p-2 border-b border-carbon-700/80 bg-carbon-900/30">
          {!isCollapsed ? (
            <div className="relative">
              <button
                onClick={() => setHostDropdownOpen(!hostDropdownOpen)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-carbon-900 border border-carbon-700 hover:border-carbon-600 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <div className="truncate">
                    <div className="text-xs font-semibold text-white truncate">
                      {selectedHost ? selectedHost.name : 'No Host Selected'}
                    </div>
                    {selectedHost && (
                      <div className="text-[10px] font-mono text-carbon-400 truncate">
                        {selectedHost.host}:{selectedHost.port}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-carbon-400 shrink-0 ml-1.5" />
              </button>

              {/* Host Switcher Dropdown */}
              {hostDropdownOpen && (
                <div
                  className="absolute left-0 right-0 top-full mt-1 bg-carbon-900 border border-carbon-700 rounded shadow-xl z-50 overflow-hidden"
                  onMouseLeave={() => setHostDropdownOpen(false)}
                >
                  <div className="px-3 py-1.5 text-[11px] font-mono text-carbon-400 border-b border-carbon-700 flex justify-between items-center">
                    <span>HOSTS ({hosts.length})</span>
                    <button
                      onClick={() => {
                        setHostDropdownOpen(false);
                        onOpenAddHost();
                      }}
                      className="text-dorito-500 hover:text-dorito-400 font-mono text-[10px] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Host
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
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
                              ? 'bg-[#181818] text-dorito-400 font-semibold'
                              : 'text-carbon-200'
                          }`}
                        >
                          <div className="truncate">
                            <div className="truncate font-medium">{h.name}</div>
                            <div className="text-[10px] text-carbon-400 font-mono truncate">
                              {h.username}@{h.host}:{h.port}
                            </div>
                          </div>
                          {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-dorito-500 ml-2 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={() => setIsCollapsed(false)}
                className="w-10 h-10 rounded flex items-center justify-center bg-carbon-900 border border-carbon-700 text-dorito-500 hover:bg-carbon-800"
                title={`Target Server: ${selectedHost?.name || 'Select Server'}`}
              >
                <Server className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!isCollapsed && (
                <div className="px-2.5 pb-1 text-[10px] font-mono tracking-widest text-carbon-500 font-semibold uppercase">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isDisabled = item.requiresHost && hosts.length === 0;

                return (
                  <button
                    key={item.id}
                    onClick={() => !isDisabled && handleSelectTab(item.id)}
                    disabled={isDisabled}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors relative ${
                      isActive
                        ? 'bg-[#181818] text-white font-semibold'
                        : isDisabled
                        ? 'opacity-30 cursor-not-allowed text-carbon-500'
                        : 'text-carbon-400 hover:text-white hover:bg-carbon-900/60'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-dorito-500' : 'text-carbon-400'}`} />
                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}
                    {!isCollapsed && item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-carbon-800 text-carbon-300 border border-carbon-700 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Status & Utilities */}
        <div className="p-2 border-t border-carbon-700 bg-carbon-900/40 space-y-1.5">
          {/* Heartbeat Rhythm easter egg */}
          {!isCollapsed && (
            <div
              className="flex items-center justify-between px-2.5 py-1.5 rounded bg-carbon-900 border border-carbon-700/80 text-[11px] font-mono text-carbon-300"
              title="Kessoku Band Drummer Rhythm Engine: 140 BPM synced with server heartbeat"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-dorito-500" />
                <span className="text-carbon-300 font-medium">140 BPM</span>
              </div>
              <span className="text-[10px] text-carbon-500 font-mono uppercase tracking-wider">SYNCED</span>
            </div>
          )}

          {/* Quick Actions (Notifications, Settings, Logout) */}
          <div className={`flex items-center gap-1 ${isCollapsed ? 'flex-col justify-center' : 'justify-between px-1'}`}>
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded text-carbon-400 hover:text-dorito-400 hover:bg-carbon-800 transition-colors"
              title="Notification Center & Alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[15px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-mono font-bold text-white ring-1 ring-carbon-950 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2 rounded text-carbon-400 hover:text-dorito-400 hover:bg-carbon-800 transition-colors"
              title="Security, Passkeys & Settings"
            >
              <Key className="w-4 h-4" />
            </button>

            {!isCollapsed && (
              <span className="text-[11px] font-mono text-carbon-500 truncate max-w-[70px]">
                {username || 'admin'}
              </span>
            )}

            <button
              onClick={onLogout}
              className="p-2 rounded text-carbon-400 hover:text-rose-400 hover:bg-carbon-800 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
