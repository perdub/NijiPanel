import React, { useEffect, useRef, useState } from 'react';
import { Terminal as Xterm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as TerminalIcon, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { Host } from '../types';
import { getToken } from '../api';

interface TerminalViewProps {
  selectedHost: Host | null;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ selectedHost }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Xterm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const connectTerminal = () => {
    if (!selectedHost || !terminalRef.current) return;

    // Dispose old socket
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    // Initialize xterm if not yet done
    if (!xtermInstance.current) {
      const term = new Xterm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
        theme: {
          background: '#0d0e12',
          foreground: '#f2f4f8',
          cursor: '#ffd100', // Signature Dorito Yellow cursor
          cursorAccent: '#0d0e12',
          selectionBackground: 'rgba(255, 209, 0, 0.25)', // Golden Dorito selection
          black: '#14161d',
          red: '#f43f5e', // Nijika Ribbon red
          green: '#10b981',
          yellow: '#ffd100', // Dorito yellow
          blue: '#f59e0b', // Warm amber
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

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermInstance.current = term;
      fitAddonRef.current = fitAddon;
    } else {
      xtermInstance.current.reset();
      fitAddonRef.current?.fit();
    }

    const term = xtermInstance.current;
    const fitAddon = fitAddonRef.current;

    // Retrieve saved persistent session ID for this host if mobile browser reloaded
    const storageKey = `serverdeck_session_${selectedHost.id}`;
    const savedSessionId = sessionStorage.getItem(storageKey);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getToken();

    const cols = term.cols || 80;
    const rows = term.rows || 24;

    const wsUrl = `${protocol}//${host}/ws/terminal?hostId=${selectedHost.id}${
      savedSessionId ? `&sessionId=${savedSessionId}` : ''
    }&cols=${cols}&rows=${rows}&access_token=${token || ''}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setReconnecting(false);
      term.focus();
    };

    ws.onmessage = (event) => {
      const data = event.data;
      if (typeof data === 'string' && data.startsWith('{"type":"session_info"')) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.sessionId) {
            setCurrentSessionId(parsed.sessionId);
            sessionStorage.setItem(storageKey, parsed.sessionId);
          }
        } catch { }
        return;
      }

      term.write(data);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const handleResize = () => {
      fitAddon?.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    window.addEventListener('resize', handleResize);
  };

  useEffect(() => {
    connectTerminal();

    // Handle mobile background / visibility change (auto-reconnect without losing state)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          setReconnecting(true);
          connectTerminal();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [selectedHost]);

  const handleResetSession = () => {
    if (!selectedHost) return;
    sessionStorage.removeItem(`serverdeck_session_${selectedHost.id}`);
    connectTerminal();
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-carbon-400 font-mono">
        Select a host from the top navigation to launch the SSH terminal
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${fullscreen ? 'fixed inset-0 z-50 p-2 bg-carbon-950 flex flex-col' : ''}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-carbon-700/80 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <TerminalIcon className="w-5 h-5 text-dorito-500" />
          <h1 className="text-xl font-black text-white tracking-tight font-sans">SSH Terminal</h1>
          <span className="text-xs text-carbon-400 font-mono hidden sm:inline">
            {selectedHost.username}@{selectedHost.host}:{selectedHost.port}
          </span>
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-none font-mono text-[10px] font-medium border ${
              connected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span>{connected ? 'ONLINE • 140 BPM' : reconnecting ? 'Reconnecting...' : 'Disconnected'}</span>
          </span>
          <span className="hidden md:inline-flex text-[9px] font-mono px-1.5 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400">
            Kessoku Shell ~ Nijika
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <button
            onClick={handleResetSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-200 hover:text-dorito-400 border border-carbon-700 text-xs font-medium transition-colors"
            title="Start new session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Session</span>
          </button>

          <button
            onClick={() => {
              setFullscreen(!fullscreen);
              setTimeout(() => fitAddonRef.current?.fit(), 100);
            }}
            className="p-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-200 hover:text-dorito-400 border border-carbon-700 transition-colors"
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Terminal Viewport with IBM Carbon frame */}
      <div
        className={`rounded-xl border border-carbon-700 bg-[#0d0e12] p-3 shadow-2xl relative overflow-hidden ${
          fullscreen ? 'flex-1' : 'h-[72vh]'
        }`}
      >
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
};
