import React from 'react';
import { Menu, Plus, RefreshCw, Server, ShieldCheck, Compass } from 'lucide-react';
import { Host } from '../types';

interface TopHeaderProps {
  activeTab: string;
  selectedHost: Host | null;
  onOpenMobileSidebar: () => void;
  onOpenAddHost: () => void;
  onRefreshData?: () => void;
  onOpenOnboarding?: () => void;
}

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  hosts: { title: 'Fleet Overview', subtitle: 'Agentless SSH infrastructure & real-time telemetry' },
  services: { title: 'Services & Cockpit', subtitle: 'Direct systemd units, Linux users, and package updates' },
  appstore: { title: 'App Store', subtitle: '32 1-click Compose templates & Docker Hub image registry' },
  docker: { title: 'Container Runtime', subtitle: 'Live containers, stats, OOM watchdog & Smart Prune' },
  compose: { title: 'Compose Studio', subtitle: 'Visual topology graphs and multi-container orchestration' },
  files: { title: 'File Explorer', subtitle: 'SFTP browser, disk usage treemap & public share links' },
  cron: { title: 'Cron Scheduler', subtitle: 'Automated crontab entries and script execution over SSH' },
  terminal: { title: 'Web Terminal', subtitle: 'Direct interactive pseudo-terminal session' },
  ports: { title: 'Port Registry & Sockets', subtitle: 'Live ss -tulpn socket inspector & 1-click SSH tunnels' },
  firewall: { title: 'Firewall & Fail2ban', subtitle: 'UFW packet filter rules & brute-force defense' },
  utils: { title: 'Utilities & Generators', subtitle: 'Credential generators and host provisioning commands' },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  selectedHost,
  onOpenMobileSidebar,
  onOpenAddHost,
  onRefreshData,
  onOpenOnboarding,
}) => {
  const currentTab = TAB_TITLES[activeTab] || { title: 'Dashboard', subtitle: 'Server administration' };

  return (
    <header className="h-16 border-b border-carbon-700 bg-carbon-900/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Sidebar Hamburger */}
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded text-carbon-400 hover:text-white hover:bg-carbon-800 transition-colors"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Section Title & Subtitle */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-medium text-white font-sans tracking-tight truncate">
              {currentTab.title}
            </h1>
            {selectedHost && (
              <span className="hidden md:inline-flex text-[10px] font-mono px-2 py-0.5 rounded bg-carbon-800 border border-carbon-700 text-carbon-300 items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="truncate max-w-[140px]">{selectedHost.name}</span>
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-carbon-400 truncate hidden sm:block">
            {currentTab.subtitle}
          </p>
        </div>
      </div>

      {/* Right Quick Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {onRefreshData && (
          <button
            onClick={onRefreshData}
            className="p-2 rounded text-carbon-400 hover:text-dorito-400 hover:bg-carbon-800 transition-colors"
            title="Refresh host data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {onOpenOnboarding && (
          <button
            onClick={onOpenOnboarding}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-carbon-300 hover:text-dorito-400 text-xs font-mono transition-colors"
            title="Setup Guide & Onboarding"
          >
            <Compass className="w-3.5 h-3.5 text-dorito-500" />
            <span className="hidden sm:inline">Setup Guide</span>
          </button>
        )}

        <button
          onClick={onOpenAddHost}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-dorito-500 hover:bg-dorito-600 text-black font-semibold text-xs transition-colors shadow-sm active:scale-95"
          title="Add New Target Host"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Host</span>
        </button>
      </div>
    </header>
  );
};
