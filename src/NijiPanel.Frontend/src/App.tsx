import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { HostsView } from './components/HostsView';
import { DockerView } from './components/DockerView';
import { ComposeView } from './components/ComposeView';
import { AppStoreView } from './components/AppStoreView';
import { ServicesView } from './components/ServicesView';
import { FilesView } from './components/FilesView';
import { TerminalView } from './components/TerminalView';
import { PortsNotesView } from './components/PortsNotesView';
import { FirewallView } from './components/FirewallView';
import { CronView } from './components/CronView';
import { UtilsView } from './components/UtilsView';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { AuthModal } from './components/AuthModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { api, clearToken, getToken } from './api';
import { Host, MasterKey, NotificationItem } from './types';
import { Loader2 } from 'lucide-react';

const VALID_TABS = [
  'hosts', 'services', 'appstore', 'docker', 'compose',
  'files', 'terminal', 'cron', 'ports', 'firewall', 'utils'
];

interface RouteInfo {
  tab: string;
  hostId: string | null;
  filePath: string | null;
  settingsOpen: boolean;
}

function parseCurrentRoute(): RouteInfo {
  const path = window.location.pathname.replace(/^\/+/, '').split('/')[0].toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const hostId = searchParams.get('host');
  const filePath = searchParams.get('path');
  const settingsOpen = path === 'settings' || searchParams.get('modal') === 'settings';

  let tab = 'hosts';
  if (VALID_TABS.includes(path)) {
    tab = path;
  }

  return { tab, hostId, filePath, settingsOpen };
}

function syncUrlToBrowser(tab: string, hostId: string | null, filePath: string | null, settingsOpen: boolean, replace = false) {
  const params = new URLSearchParams();
  if (hostId && tab !== 'hosts' && tab !== 'utils') {
    params.set('host', hostId);
  }
  if (filePath && tab === 'files') {
    params.set('path', filePath);
  }
  if (settingsOpen) {
    params.set('modal', 'settings');
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  const newPath = `/${tab}${query}`;
  const currentFull = `${window.location.pathname}${window.location.search}`;

  if (currentFull !== newPath) {
    if (replace) {
      window.history.replaceState({ tab, hostId, filePath, settingsOpen }, '', newPath);
    } else {
      window.history.pushState({ tab, hostId, filePath, settingsOpen }, '', newPath);
    }
  }
}

export const App: React.FC = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSetup, setIsSetup] = useState(true);
  const [username, setUsername] = useState<string | undefined>();

  // Dashboard states initialized from URL
  const initialRoute = parseCurrentRoute();
  const [activeTab, setActiveTab] = useState(initialRoute.tab);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedHostId, setSelectedHostId] = useState<string | null>(initialRoute.hostId);
  const [masterKey, setMasterKey] = useState<MasterKey | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(initialRoute.settingsOpen);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [fileToEditPath, setFileToEditPath] = useState<string | null>(initialRoute.filePath);

  // Sidebar states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('nijipanel_sidebar_width');
      return saved ? Math.min(460, Math.max(200, parseInt(saved, 10))) : 260;
    } catch {
      return 260;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Notification center states
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);

  const checkAuth = async () => {
    try {
      const res = await api.auth.status();
      setIsSetup(res.isSetup);
      setIsAuthenticated(res.isAuthenticated);
      setUsername(res.username);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await api.notifications.list();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // ignore
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await api.notifications.delete(id);
      const target = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // ignore
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await api.notifications.clearAll();
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const navigateTo = (tab: string, hostId?: string, filePath?: string | null) => {
    const nextHostId = hostId !== undefined ? hostId : selectedHostId;
    const nextFilePath = filePath !== undefined ? filePath : fileToEditPath;
    setActiveTab(tab);
    if (hostId !== undefined) {
      setSelectedHostId(hostId);
    }
    if (filePath !== undefined) {
      setFileToEditPath(filePath);
    }
    syncUrlToBrowser(tab, nextHostId, nextFilePath, settingsOpen, false);
  };

  const handleSelectHost = (id: string) => {
    setSelectedHostId(id);
    syncUrlToBrowser(activeTab, id, fileToEditPath, settingsOpen, false);
  };

  const handleOpenSettings = (open: boolean) => {
    setSettingsOpen(open);
    syncUrlToBrowser(activeTab, selectedHostId, fileToEditPath, open, false);
  };

  const handleHostStatsUpdated = useCallback((hostId: string, isOnline: boolean) => {
    setHosts((prev) =>
      prev.map((item) => (item.id === hostId ? { ...item, isOnline } : item))
    );
  }, []);

  const refreshHostStatuses = useCallback(async (targetHosts: Host[]) => {
    if (!targetHosts || targetHosts.length === 0) return;
    await Promise.allSettled(
      targetHosts.map(async (h) => {
        try {
          const stats = await api.hosts.stats(h.id);
          setHosts((prev) =>
            prev.map((item) => (item.id === h.id ? { ...item, isOnline: stats.isOnline } : item))
          );
        } catch {
          setHosts((prev) =>
            prev.map((item) => (item.id === h.id ? { ...item, isOnline: false } : item))
          );
        }
      })
    );
  }, []);

  const loadData = async () => {
    try {
      const [hostsData, keyData] = await Promise.all([
        api.hosts.list(),
        api.settings.getMasterKey(),
      ]);
      setHosts(hostsData);
      setMasterKey(keyData);
      refreshHostStatuses(hostsData);

      if (hostsData.length > 0) {
        if (selectedHostId && hostsData.some((h) => h.id === selectedHostId)) {
          syncUrlToBrowser(activeTab, selectedHostId, fileToEditPath, settingsOpen, true);
        } else {
          const defaultHostId = hostsData[0].id;
          setSelectedHostId(defaultHostId);
          syncUrlToBrowser(activeTab, defaultHostId, fileToEditPath, settingsOpen, true);
        }
      } else if (hostsData.length === 0) {
        try {
          const completed = localStorage.getItem('nijipanel_onboarding_completed');
          if (!completed) {
            setOnboardingOpen(true);
          }
        } catch {}
        syncUrlToBrowser(activeTab, null, fileToEditPath, settingsOpen, true);
      }
    } catch (err) {
      console.error('Error loading fleet data', err);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };
    window.addEventListener('nijipanel_unauthorized', handleUnauthorized);

    const handlePopState = () => {
      const route = parseCurrentRoute();
      setActiveTab(route.tab);
      if (route.hostId !== null) {
        setSelectedHostId(route.hostId);
      }
      setFileToEditPath(route.filePath);
      setSettingsOpen(route.settingsOpen);
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('nijipanel_unauthorized', handleUnauthorized);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      loadNotifications();
      const interval = setInterval(loadNotifications, 20000);
      const hostStatsInterval = setInterval(() => {
        if (hosts.length > 0) {
          refreshHostStatuses(hosts);
        }
      }, 30000);
      return () => {
        clearInterval(interval);
        clearInterval(hostStatsInterval);
      };
    }
  }, [isAuthenticated, hosts.length]);

  const handleLogout = () => {
    clearToken();
    setIsAuthenticated(false);
  };

  const handleAuthSuccess = (user: string) => {
    setIsAuthenticated(true);
    setUsername(user);
    loadData();
    loadNotifications();
  };

  if (!authChecked) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-carbon-400 gap-3 select-none">
        <div className="relative flex items-center justify-center w-10 h-10">
          <Loader2 className="w-8 h-8 animate-spin text-dorito-500" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold tracking-tight text-white font-sans">
            Niji<span className="text-dorito-500">Panel</span>
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-carbon-900 border border-carbon-800 text-carbon-400">
            CONNECTING
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthModal isSetup={isSetup} onSuccess={handleAuthSuccess} />;
  }

  const selectedHost = hosts.find((h) => h.id === selectedHostId) || (hosts.length > 0 ? hosts[0] : null);

  const handleEditComposeFile = (path: string) => {
    setFileToEditPath(path);
    navigateTo('files', selectedHostId || undefined, path);
  };

  return (
    <div className="min-h-screen bg-black text-carbon-100 flex font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => navigateTo(tab)}
        hosts={hosts}
        selectedHostId={selectedHostId}
        setSelectedHostId={handleSelectHost}
        onOpenAddHost={() => navigateTo('hosts')}
        onOpenSettings={() => handleOpenSettings(true)}
        onOpenNotifications={() => setNotificationDrawerOpen(true)}
        unreadCount={unreadCount}
        onLogout={handleLogout}
        username={username}
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        width={sidebarWidth}
        setWidth={setSidebarWidth}
      />

      <div
        style={{
          paddingLeft: sidebarCollapsed ? '72px' : `${sidebarWidth}px`,
        }}
        className="flex-1 flex flex-col min-w-0 bg-black min-h-screen transition-[padding] duration-150"
      >
        <TopHeader
          activeTab={activeTab}
          selectedHost={selectedHost}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenAddHost={() => navigateTo('hosts')}
          onRefreshData={loadData}
          onOpenOnboarding={() => setOnboardingOpen(true)}
        />

        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto overflow-x-hidden">
          {activeTab === 'hosts' && (
            <HostsView
              hosts={hosts}
              onRefresh={loadData}
              onSelectHost={(id) => handleSelectHost(id)}
              onOpenTab={(tab, hostId) => navigateTo(tab, hostId)}
              masterPublicKey={masterKey?.publicKey || ''}
              onOpenOnboarding={() => setOnboardingOpen(true)}
              onHostStatsUpdated={handleHostStatsUpdated}
            />
          )}

          {activeTab === 'services' && (
            <ServicesView
              selectedHost={selectedHost}
              hosts={hosts}
              onSelectHost={(id) => handleSelectHost(id)}
            />
          )}

          {activeTab === 'appstore' && (
            <AppStoreView
              selectedHost={selectedHost}
              onNavigateToCompose={() => navigateTo('compose')}
            />
          )}

          {activeTab === 'docker' && <DockerView selectedHost={selectedHost} />}

          {activeTab === 'compose' && (
            <ComposeView
              selectedHost={selectedHost}
              onEditFile={handleEditComposeFile}
            />
          )}

          {activeTab === 'files' && (
            <FilesView
              selectedHost={selectedHost}
              initialPath={fileToEditPath || '/'}
            />
          )}

          <div className={activeTab === 'terminal' ? 'h-full' : 'hidden'}>
            <TerminalView key={selectedHost?.id || 'none'} selectedHost={selectedHost} />
          </div>

          {activeTab === 'cron' && (
            <CronView
              hosts={hosts}
              selectedHost={selectedHost}
              onSelectHost={(h) => handleSelectHost(h.id)}
            />
          )}

          {activeTab === 'ports' && <PortsNotesView selectedHost={selectedHost} />}

          {activeTab === 'firewall' && <FirewallView selectedHost={selectedHost} />}

          {activeTab === 'utils' && <UtilsView masterPublicKey={masterKey?.publicKey || ''} />}
        </main>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => handleOpenSettings(false)}
        masterKey={masterKey}
        onMasterKeyUpdated={(updated) => setMasterKey(updated)}
      />

      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        masterKey={masterKey}
        onHostCreated={loadData}
        onNavigateTab={(tab) => navigateTo(tab)}
      />

      <NotificationDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onDelete={handleDeleteNotification}
        onClearAll={handleClearAllNotifications}
      />
    </div>
  );
};
