import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HostsView } from './components/HostsView';
import { DockerView } from './components/DockerView';
import { ComposeView } from './components/ComposeView';
import { FilesView } from './components/FilesView';
import { TerminalView } from './components/TerminalView';
import { PortsNotesView } from './components/PortsNotesView';
import { UtilsView } from './components/UtilsView';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { api, clearToken, getToken } from './api';
import { Host, MasterKey } from './types';
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
  const [fileToEditPath, setFileToEditPath] = useState<string | null>(null);

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
    window.addEventListener('serverdeck_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('serverdeck_unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
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
  };

  if (!authChecked) {
    return (
      <div className="h-screen w-screen bg-[#0a0d14] flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-sm font-medium tracking-wide">Загрузка ServerDeck...</span>
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
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hosts={hosts}
        selectedHostId={selectedHostId}
        setSelectedHostId={setSelectedHostId}
        onOpenAddHost={() => setActiveTab('hosts')}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={handleLogout}
        username={username}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'hosts' && (
          <HostsView
            hosts={hosts}
            onRefresh={loadData}
            onSelectHost={(id) => setSelectedHostId(id)}
            onOpenTab={(tab) => setActiveTab(tab)}
            masterPublicKey={masterKey?.publicKey || ''}
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

        {activeTab === 'ports' && <PortsNotesView selectedHost={selectedHost} />}

        {activeTab === 'utils' && <UtilsView masterPublicKey={masterKey?.publicKey || ''} />}
      </main>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        masterKey={masterKey}
        onMasterKeyUpdated={(updated) => setMasterKey(updated)}
      />
    </div>
  );
};
