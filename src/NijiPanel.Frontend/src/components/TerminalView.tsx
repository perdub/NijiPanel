import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as Xterm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Terminal as TerminalIcon,
  RotateCcw,
  Maximize2,
  Minimize2,
  Plus,
  X,
  Edit2,
  Check,
  RefreshCw,
  Copy,
  ClipboardPaste,
  Square
} from 'lucide-react';
import { Host } from '../types';
import { getToken, api } from '../api';

interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
  connected: boolean;
  reconnecting: boolean;
}

interface TerminalInstance {
  term: Xterm;
  fitAddon: FitAddon;
  ws: WebSocket | null;
  container: HTMLDivElement;
}

interface TerminalViewProps {
  selectedHost: Host | null;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ selectedHost }) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [fullscreen, setFullscreen] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Keep references to xterm instances and container divs per tab id
  const instancesRef = useRef<Map<string, TerminalInstance>>(new Map());
  const containersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const tabsCountRef = useRef(1);

  // Initialize tabs when host is selected or changed
  useEffect(() => {
    if (!selectedHost) {
      // Cleanup all instances
      instancesRef.current.forEach((inst) => {
        if (inst.ws) inst.ws.close();
        inst.term.dispose();
      });
      instancesRef.current.clear();
      setTabs([]);
      setActiveTabId('');
      return;
    }

    // Clean up instances from previous host
    instancesRef.current.forEach((inst) => {
      if (inst.ws) inst.ws.close();
      inst.term.dispose();
    });
    instancesRef.current.clear();

    // Check if tabs exist in localStorage for this host
    const storageKey = `nijipanel_term_tabs_${selectedHost.id}`;
    let loadedTabs: TerminalTab[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedTabs = parsed.map((t: any) => ({
            id: t.id,
            sessionId: t.sessionId,
            title: t.title || 'Session',
            connected: false,
            reconnecting: false,
          }));
        }
      }
    } catch { }

    if (loadedTabs.length > 0) {
      tabsCountRef.current = loadedTabs.length;
      setTabs(loadedTabs);
      setActiveTabId(loadedTabs[0].id);
    } else {
      const initialId = `term-${Date.now()}-1`;
      const initialSessionId = `sess-${selectedHost.id}-${Date.now()}-1`;
      const initialTab: TerminalTab = {
        id: initialId,
        sessionId: initialSessionId,
        title: 'Session 1',
        connected: false,
        reconnecting: false,
      };

      tabsCountRef.current = 1;
      setTabs([initialTab]);
      setActiveTabId(initialId);
    }
  }, [selectedHost?.id]);

  // Save active tabs to localStorage whenever they change
  useEffect(() => {
    if (!selectedHost || tabs.length === 0) return;
    const storageKey = `nijipanel_term_tabs_${selectedHost.id}`;
    try {
      const toSave = tabs.map((t) => ({
        id: t.id,
        sessionId: t.sessionId,
        title: t.title,
      }));
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch { }
  }, [tabs, selectedHost?.id]);

  // Connect a specific terminal tab instance
  const connectTab = useCallback((tab: TerminalTab, containerEl: HTMLDivElement) => {
    if (!selectedHost) return;

    // Check if instance already exists
    let instance = instancesRef.current.get(tab.id);

    if (!instance) {
      const term = new Xterm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
        allowProposedApi: true,
        scrollback: 10000,
        theme: {
          background: '#000000',
          foreground: '#f5f5f5',
          cursor: '#ffd100', // Signature Dorito Yellow cursor
          cursorAccent: '#000000',
          selectionBackground: 'rgba(255, 209, 0, 0.25)',
          black: '#121212',
          red: '#f43f5e',
          green: '#10b981',
          yellow: '#ffd100',
          blue: '#f59e0b',
          magenta: '#fb7185',
          cyan: '#38bdf8',
          white: '#f2f4f8',
          brightBlack: '#5a6478',
          brightRed: '#fb7185',
          brightGreen: '#34d399',
          brightYellow: '#fde047',
          brightBlue: '#fbbf24',
          brightMagenta: '#f43f5e',
          brightCyan: '#7dd3fc',
          brightWhite: '#ffffff',
        },
      });

      // Keyboard handler: solve Ctrl+C (copy vs SIGINT) and Ctrl+V (paste without 0x16 quoted-insert)
      term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        // 1. Copy on Ctrl+C / Cmd+C (if there is selected text)
        if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'c' || e.key === 'C')) {
          if (term.hasSelection()) {
            if (e.type === 'keydown') {
              const selected = term.getSelection();
              navigator.clipboard.writeText(selected).catch(() => {});
            }
            return false; // Prevent xterm from sending \x03 (SIGINT) to shell
          }
          // If NO selection: let xterm send \x03 (SIGINT) to interrupt running command
          return true;
        }

        // 2. Explicit Copy on Ctrl+Shift+C
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
          if (term.hasSelection() && e.type === 'keydown') {
            navigator.clipboard.writeText(term.getSelection()).catch(() => {});
          }
          return false;
        }

        // 3. Paste on Ctrl+V / Cmd+V / Ctrl+Shift+V
        if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
          if (e.type === 'keydown') {
            navigator.clipboard.readText().then((text) => {
              if (text) {
                term.paste(text);
              }
            }).catch(() => {
              // Browser permission denied or non-HTTPS: fall back to DOM paste event
            });
          }
          return false; // CRITICAL: Stop xterm from emitting 0x16 (which puts readline in quoted-insert and causes ~]]200!)
        }

        return true;
      });

      // Auto-copy on mouse text selection
      term.onSelectionChange(() => {
        if (term.hasSelection()) {
          const selected = term.getSelection();
          if (selected && selected.length > 0) {
            navigator.clipboard.writeText(selected).catch(() => {});
          }
        }
      });

      // Smart right-click: copy if selected, paste if unselected
      const handleContextMenu = async (e: MouseEvent) => {
        e.preventDefault();
        if (term.hasSelection()) {
          const text = term.getSelection();
          await navigator.clipboard.writeText(text).catch(() => {});
          term.clearSelection();
        } else {
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              term.paste(text);
              term.focus();
            }
          } catch { }
        }
      };
      containerEl.addEventListener('contextmenu', handleContextMenu);

      // Native DOM paste event
      const handlePaste = (e: ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData?.getData('text');
        if (text) {
          term.paste(text);
          term.focus();
        }
      };
      containerEl.addEventListener('paste', handlePaste);

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerEl);

      instance = {
        term,
        fitAddon,
        ws: null,
        container: containerEl,
      };
      instancesRef.current.set(tab.id, instance);
    } else {
      if (instance.ws && instance.ws.readyState === WebSocket.OPEN) {
        return; // Already actively connected
      }
    }

    const { term, fitAddon } = instance;

    // Request fit
    try {
      fitAddon.fit();
    } catch { }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getToken();
    const cols = term.cols || 80;
    const rows = term.rows || 24;

    const wsUrl = `${protocol}//${host}/ws/terminal?hostId=${selectedHost.id}&sessionId=${tab.sessionId}&cols=${cols}&rows=${rows}&access_token=${token || ''}`;
    const ws = new WebSocket(wsUrl);
    instance.ws = ws;

    ws.onopen = () => {
      setTabs((prev) =>
        prev.map((t) => (t.id === tab.id ? { ...t, connected: true, reconnecting: false } : t))
      );
      try {
        fitAddon.fit();
        term.focus();
      } catch { }
    };

    ws.onmessage = (event) => {
      const data = event.data;
      if (typeof data === 'string' && data.startsWith('{"type":"session_info"')) {
        return;
      }
      term.write(data);
    };

    ws.onclose = () => {
      setTabs((prev) =>
        prev.map((t) => (t.id === tab.id ? { ...t, connected: false } : t))
      );
    };

    ws.onerror = () => {
      setTabs((prev) =>
        prev.map((t) => (t.id === tab.id ? { ...t, connected: false } : t))
      );
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }, [selectedHost]);

  // Ref callback for container divs
  const setContainerRef = useCallback((tabId: string, el: HTMLDivElement | null) => {
    if (el) {
      containersRef.current.set(tabId, el);
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        connectTab(tab, el);
      }
    } else {
      containersRef.current.delete(tabId);
    }
  }, [tabs, connectTab]);

  // Refit when active tab changes or fullscreen toggles
  useEffect(() => {
    if (!activeTabId) return;
    const timer = setTimeout(() => {
      const inst = instancesRef.current.get(activeTabId);
      if (inst) {
        try {
          inst.fitAddon.fit();
          inst.term.focus();
          if (inst.ws && inst.ws.readyState === WebSocket.OPEN) {
            inst.ws.send(JSON.stringify({ type: 'resize', cols: inst.term.cols, rows: inst.term.rows }));
          }
        } catch { }
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activeTabId, fullscreen]);

  // Window resize handler for active tab
  useEffect(() => {
    const handleResize = () => {
      if (!activeTabId) return;
      const inst = instancesRef.current.get(activeTabId);
      if (inst) {
        try {
          inst.fitAddon.fit();
          if (inst.ws && inst.ws.readyState === WebSocket.OPEN) {
            inst.ws.send(JSON.stringify({ type: 'resize', cols: inst.term.cols, rows: inst.term.rows }));
          }
        } catch { }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTabId]);

  // Add new terminal tab
  const handleAddTab = () => {
    if (!selectedHost) return;
    tabsCountRef.current += 1;
    const newId = `term-${Date.now()}-${tabsCountRef.current}`;
    const newSessionId = `sess-${selectedHost.id}-${Date.now()}-${tabsCountRef.current}`;
    const newTab: TerminalTab = {
      id: newId,
      sessionId: newSessionId,
      title: `Session ${tabsCountRef.current}`,
      connected: false,
      reconnecting: false,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Close tab
  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();

    const targetTab = tabs.find((t) => t.id === tabId);
    if (targetTab) {
      // Close backend session
      api.terminal.closeSession(targetTab.sessionId).catch(() => {});
    }

    // Clean up local instance
    const inst = instancesRef.current.get(tabId);
    if (inst) {
      if (inst.ws) {
        inst.ws.close();
      }
      inst.term.dispose();
      instancesRef.current.delete(tabId);
    }
    containersRef.current.delete(tabId);

    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);

    if (activeTabId === tabId) {
      if (remaining.length > 0) {
        setActiveTabId(remaining[remaining.length - 1].id);
      } else {
        // If all tabs closed, create a fresh one
        if (selectedHost) {
          tabsCountRef.current += 1;
          const freshId = `term-${Date.now()}-${tabsCountRef.current}`;
          const freshTab: TerminalTab = {
            id: freshId,
            sessionId: `sess-${selectedHost.id}-${Date.now()}-${tabsCountRef.current}`,
            title: `Session ${tabsCountRef.current}`,
            connected: false,
            reconnecting: false,
          };
          setTabs([freshTab]);
          setActiveTabId(freshId);
        }
      }
    }
  };

  // Reconnect active tab
  const handleReconnectActive = () => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const container = containersRef.current.get(activeTabId);
    if (activeTab && container) {
      const inst = instancesRef.current.get(activeTabId);
      if (inst?.ws) {
        inst.ws.close();
      }
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, reconnecting: true } : t))
      );
      connectTab(activeTab, container);
    }
  };

  // Copy active terminal selection
  const handleCopySelection = () => {
    const inst = instancesRef.current.get(activeTabId);
    if (inst) {
      const text = inst.term.getSelection();
      if (text) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    }
  };

  // Paste from clipboard to active terminal
  const handlePasteClipboard = async () => {
    const inst = instancesRef.current.get(activeTabId);
    if (inst) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          inst.term.paste(text);
          inst.term.focus();
        }
      } catch { }
    }
  };

  // Send Ctrl+C (SIGINT) to interrupt command
  const handleSendSigint = () => {
    const inst = instancesRef.current.get(activeTabId);
    if (inst && inst.ws && inst.ws.readyState === WebSocket.OPEN) {
      inst.ws.send('\x03');
      inst.term.focus();
    }
  };

  // Clear / Reset buffer of active terminal
  const handleResetActive = () => {
    const inst = instancesRef.current.get(activeTabId);
    if (inst) {
      inst.term.reset();
      inst.fitAddon.fit();
    }
  };

  // Rename tab
  const handleStartRename = (e: React.MouseEvent, tab: TerminalTab) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
  };

  const handleSaveRename = () => {
    if (!editingTabId) return;
    const cleanTitle = editingTitle.trim() || 'Session';
    setTabs((prev) =>
      prev.map((t) => (t.id === editingTabId ? { ...t, title: cleanTitle } : t))
    );
    setEditingTabId(null);
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-carbon-400 font-mono">
        Select a host from the top navigation to launch the SSH terminal
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className={`space-y-3 ${fullscreen ? 'fixed inset-0 z-50 p-2 bg-black flex flex-col' : ''}`}>
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-carbon-700/80 pb-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-5 h-5 text-dorito-500" />
            <h1 className="text-base font-medium text-white tracking-tight font-sans">SSH Terminal</h1>
          </div>
          <span className="text-xs text-carbon-400 font-mono hidden sm:inline">
            {selectedHost.username}@{selectedHost.host}:{selectedHost.port}
          </span>
          {activeTab && (
            <span
              className={`flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-medium border ${
                activeTab.connected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : activeTab.reconnecting
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activeTab.connected
                    ? 'bg-emerald-400 animate-pulse'
                    : activeTab.reconnecting
                    ? 'bg-amber-400 animate-spin'
                    : 'bg-rose-400'
                }`}
              />
              <span>
                {activeTab.connected
                  ? 'CONNECTED'
                  : activeTab.reconnecting
                  ? 'RECONNECTING...'
                  : 'DISCONNECTED'}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-mono">
          <button
            onClick={handleCopySelection}
            className="flex items-center gap-1.5 px-2 py-1 bg-carbon-850 hover:bg-carbon-800 text-carbon-200 hover:text-white border border-carbon-700 text-xs font-mono transition-colors"
            title="Copy selected text to clipboard (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5 text-dorito-400" />
            <span className="hidden sm:inline">Copy</span>
          </button>

          <button
            onClick={handlePasteClipboard}
            className="flex items-center gap-1.5 px-2 py-1 bg-carbon-850 hover:bg-carbon-800 text-carbon-200 hover:text-white border border-carbon-700 text-xs font-mono transition-colors"
            title="Paste from clipboard (Ctrl+V)"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Paste</span>
          </button>

          <button
            onClick={handleSendSigint}
            className="flex items-center gap-1.5 px-2 py-1 bg-carbon-850 hover:bg-rose-950/40 text-rose-300 hover:text-rose-100 border border-carbon-700 hover:border-rose-700 text-xs font-mono transition-colors"
            title="Send Ctrl+C (SIGINT) to interrupt current running command"
          >
            <Square className="w-3 h-3 fill-rose-400 text-rose-400" />
            <span className="hidden sm:inline">^C Stop</span>
          </button>

          {activeTab && !activeTab.connected && (
            <button
              onClick={handleReconnectActive}
              className="flex items-center gap-1.5 px-2 py-1 bg-carbon-850 hover:bg-carbon-800 text-carbon-200 hover:text-white border border-carbon-700 text-xs font-mono transition-colors"
              title="Reconnect active terminal"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Reconnect</span>
            </button>
          )}

          <button
            onClick={handleResetActive}
            className="flex items-center gap-1.5 px-2 py-1 bg-carbon-850 hover:bg-carbon-800 text-carbon-200 hover:text-white border border-carbon-700 text-xs font-mono transition-colors"
            title="Clear terminal buffer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1 bg-carbon-850 hover:bg-carbon-800 text-carbon-200 hover:text-white border border-carbon-700 transition-colors"
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Tab Bar */}
      <div className="flex items-center justify-between bg-carbon-950 border border-carbon-700 overflow-x-auto no-scrollbar px-1 pt-1">
        <div className="flex items-center gap-1 min-w-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isEditing = editingTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center gap-2 px-3 py-1.5 border-t-2 text-xs font-mono select-none cursor-pointer transition-colors max-w-[200px] ${
                  isActive
                    ? 'bg-carbon-900 border-t-dorito-500 text-white font-medium shadow-sm'
                    : 'bg-carbon-950/60 border-t-transparent text-carbon-400 hover:text-carbon-200 hover:bg-carbon-900/40'
                }`}
              >
                {/* Status Dot */}
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    tab.connected
                      ? 'bg-emerald-400'
                      : tab.reconnecting
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />

                {/* Title or Edit Input */}
                {isEditing ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename();
                        if (e.key === 'Escape') setEditingTabId(null);
                      }}
                      autoFocus
                      className="w-20 bg-black border border-dorito-500 px-1 py-0.5 text-xs text-white outline-none"
                    />
                    <button
                      onClick={handleSaveRename}
                      className="p-0.5 text-dorito-400 hover:text-white"
                      title="Save"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span
                    onDoubleClick={(e) => handleStartRename(e, tab)}
                    className="truncate text-xs"
                    title={`${tab.title} (double click to rename)`}
                  >
                    {tab.title}
                  </span>
                )}

                {/* Rename button on hover */}
                {!isEditing && isActive && (
                  <button
                    onClick={(e) => handleStartRename(e, tab)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-carbon-400 hover:text-white transition-opacity"
                    title="Rename session"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                )}

                {/* Close Tab Button */}
                <button
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className="p-0.5 text-carbon-500 hover:text-rose-400 hover:bg-carbon-800 transition-colors ml-1"
                  title="Close session"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* New Tab Button */}
          <button
            onClick={handleAddTab}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono text-carbon-400 hover:text-dorito-400 hover:bg-carbon-900/60 transition-colors"
            title="Open new terminal session"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Tab</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-carbon-500 px-2 hidden md:block">
          {tabs.length} {tabs.length === 1 ? 'session' : 'sessions'} active
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        className={`border-x border-b border-carbon-700 bg-black p-3 shadow-2xl relative overflow-hidden ${
          fullscreen ? 'flex-1' : 'h-[72vh]'
        }`}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={(el) => setContainerRef(tab.id, el)}
            className={`w-full h-full ${activeTabId === tab.id ? 'block' : 'hidden'}`}
          />
        ))}
      </div>
    </div>
  );
};
