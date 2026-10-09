import React, { useState, useEffect } from 'react';
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

export const App: React.FC = () => {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSetup, setIsSetup] = useState(true);
  const [username, setUsername] = useState<string | undefined>();

  // Dashboard states
  const [activeTab, setActiveTab] = useState('hosts');
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [masterKey, setMasterKey] = useState<MasterKey | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [fileToEditPath, setFileToEditPath] = useState<string | null>(null);

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

  const loadData = async () => {
    try {
      const [hostsData, keyData] = await Promise.all([
        api.hosts.list(),
        api.settings.getMasterKey(),
      ]);
      setHosts(hostsData);
      setMasterKey(keyData);

      if (hostsData.length > 0 && !selectedHostId) {
        setSelectedHostId(hostsData[0].id);
      } else if (hostsData.length === 0) {
        try {
          const completed = localStorage.getItem('nijipanel_onboarding_completed');
          if (!completed) {
            setOnboardingOpen(true);
          }
        } catch {}
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
    return () => window.removeEventListener('nijipanel_unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      loadNotifications();
      const interval = setInterval(loadNotifications, 20000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

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
    setActiveTab('files');
  };

  return (
    <div className="min-h-screen bg-black text-carbon-100 flex font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hosts={hosts}
        selectedHostId={selectedHostId}
        setSelectedHostId={setSelectedHostId}
        onOpenAddHost={() => setActiveTab('hosts')}
        onOpenSettings={() => setSettingsOpen(true)}
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
          onOpenAddHost={() => setActiveTab('hosts')}
          onRefreshData={loadData}
          onOpenOnboarding={() => setOnboardingOpen(true)}
        />

        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto overflow-x-hidden">
          {activeTab === 'hosts' && (
            <HostsView
              hosts={hosts}
              onRefresh={loadData}
              onSelectHost={(id) => setSelectedHostId(id)}
              onOpenTab={(tab) => setActiveTab(tab)}
              masterPublicKey={masterKey?.publicKey || ''}
              onOpenOnboarding={() => setOnboardingOpen(true)}
            />
          )}

          {activeTab === 'services' && (
            <ServicesView
              selectedHost={selectedHost}
              hosts={hosts}
              onSelectHost={(id) => setSelectedHostId(id)}
            />
          )}

          {activeTab === 'appstore' && (
            <AppStoreView
              selectedHost={selectedHost}
              onNavigateToCompose={() => setActiveTab('compose')}
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

          {activeTab === 'terminal' && <TerminalView selectedHost={selectedHost} />}

          {activeTab === 'cron' && (
            <CronView
              hosts={hosts}
              selectedHost={selectedHost}
              onSelectHost={(h) => setSelectedHostId(h.id)}
            />
          )}

          {activeTab === 'ports' && <PortsNotesView selectedHost={selectedHost} />}

          {activeTab === 'firewall' && <FirewallView selectedHost={selectedHost} />}

          {activeTab === 'utils' && <UtilsView masterPublicKey={masterKey?.publicKey || ''} />}
        </main>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        masterKey={masterKey}
        onMasterKeyUpdated={(updated) => setMasterKey(updated)}
      />

      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        masterKey={masterKey}
        onHostCreated={loadData}
        onNavigateTab={(tab) => setActiveTab(tab)}
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
