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
  ShieldCheck,
  Plus
} from 'lucide-react';
import { Host } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hosts: Host[];
  selectedHostId: string | null;
  setSelectedHostId: (id: string) => void;
  onOpenAddHost: () => void;
  onOpenSettings: () => void;
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
  onLogout,
  username
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hostDropdownOpen, setHostDropdownOpen] = useState(false);

  const selectedHost = hosts.find((h) => h.id === selectedHostId) || hosts[0];

  const navItems = [
    { id: 'hosts', label: 'Серверы', icon: Server, requiresHost: false },
    { id: 'docker', label: 'Контейнеры', icon: Layers, requiresHost: true },
    { id: 'compose', label: 'Docker Compose', icon: FolderGit2, requiresHost: true },
    { id: 'files', label: 'Файлы', icon: FolderTree, requiresHost: true },
    { id: 'terminal', label: 'Терминал', icon: Terminal, requiresHost: true },
    { id: 'ports', label: 'Порты & Заметки', icon: Network, requiresHost: true },
    { id: 'utils', label: 'Утилиты', icon: Wrench, requiresHost: false },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-deck-900 border-b border-deck-800 sticky top-0 z-40 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTabClick('hosts')}
              className="flex items-center gap-2.5 font-bold text-lg text-white tracking-wide hover:opacity-90 transition-opacity"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-sm">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
              <span className="hidden sm:inline">Server<span className="text-blue-500">Deck</span></span>
            </button>

            {/* Active Host Selector */}
            {hosts.length > 0 && (
              <div className="relative ml-2 sm:ml-4">
                <button
                  onClick={() => setHostDropdownOpen(!hostDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-deck-850 hover:bg-deck-800 border border-deck-700/60 text-xs sm:text-sm font-medium text-slate-200 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="max-w-[120px] sm:max-w-[180px] truncate">
                    {selectedHost ? selectedHost.name : 'Выберите сервер'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {hostDropdownOpen && (
                  <div
                    className="absolute left-0 mt-1 w-64 rounded-xl bg-deck-900 border border-deck-700 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                    onMouseLeave={() => setHostDropdownOpen(false)}
                  >
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-deck-800 flex justify-between items-center">
                      <span>Хосты ({hosts.length})</span>
                      <button
                        onClick={() => {
                          setHostDropdownOpen(false);
                          onOpenAddHost();
                        }}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Добавить
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {hosts.map((h) => (
                        <button
                          key={h.id}
                          onClick={() => {
                            setSelectedHostId(h.id);
                            setHostDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-deck-800/80 transition-colors ${
                            h.id === selectedHostId ? 'bg-blue-600/10 text-blue-400 font-semibold' : 'text-slate-300'
                          }`}
                        >
                          <div className="truncate">
                            <div className="truncate font-medium">{h.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">{h.username}@{h.host}:{h.port}</div>
                          </div>
                          {h.id === selectedHostId && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-2 shrink-0"></span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isDisabled = item.requiresHost && hosts.length === 0;

              return (
                <button
                  key={item.id}
                  onClick={() => !isDisabled && handleTabClick(item.id)}
                  disabled={isDisabled}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : isDisabled
                      ? 'opacity-40 cursor-not-allowed text-slate-500'
                      : 'text-slate-300 hover:text-white hover:bg-deck-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User & Settings Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-deck-800 transition-colors"
              title="Настройки мастер-ключа и пароля"
            >
              <Key className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-deck-800 transition-colors"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-deck-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-deck-800 bg-deck-900 px-4 pt-2 pb-4 space-y-1 shadow-2xl">
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
                    ? 'bg-blue-600 text-white font-semibold'
                    : isDisabled
                    ? 'opacity-40 cursor-not-allowed text-slate-500'
                    : 'text-slate-300 hover:bg-deck-800'
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
