import React, { useEffect, useRef, useState } from 'react';
import { Terminal as Xterm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as TerminalIcon, RotateCcw, X, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { Host } from '../types';
import { getToken } from '../api';

interface ContainerExecModalProps {
  isOpen: boolean;
  onClose: () => void;
  host: Host;
  containerId: string;
  containerName: string;
}

export const ContainerExecModal: React.FC<ContainerExecModalProps> = ({
  isOpen,
  onClose,
  host,
  containerId,
  containerName,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Xterm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [connecting, setConnecting] = useState(true);

  const connectExecSession = () => {
    if (!isOpen || !terminalRef.current) return;

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setConnecting(true);

    if (!xtermInstance.current) {
      const term = new Xterm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
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

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const locationHost = window.location.host;
    const token = getToken();

    const cols = term.cols || 80;
    const rows = term.rows || 24;

    const wsUrl = `${protocol}//${locationHost}/ws/terminal?hostId=${host.id}&containerId=${containerId}&cols=${cols}&rows=${rows}&access_token=${token || ''}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
      term.focus();
    };

    ws.onmessage = (event) => {
      const data = event.data;
      if (typeof data === 'string' && data.startsWith('{"type":"session_info"')) {
        return;
      }
      term.write(data);
    };

    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
    };

    ws.onerror = () => {
      setConnected(false);
      setConnecting(false);
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
    if (isOpen) {
      const timer = setTimeout(() => {
        connectExecSession();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setConnected(false);
    }
  }, [isOpen, containerId]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (xtermInstance.current) {
        xtermInstance.current.dispose();
        xtermInstance.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`w-full bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl flex flex-col transition-all duration-200 ${
          fullscreen ? 'h-[96vh] max-w-[98vw]' : 'h-[80vh] max-w-5xl'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-carbon-700 bg-carbon-850/60 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-carbon-800 border border-carbon-700 text-dorito-400">
              <TerminalIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm sm:text-base font-sans">
                  Container Exec: {containerName}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-carbon-800 text-carbon-300 border border-carbon-700">
                  {containerId.substring(0, 12)}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    connected
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : connecting
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connected ? 'bg-emerald-400 animate-pulse' : connecting ? 'bg-amber-400' : 'bg-rose-400'
                    }`}
                  />
                  <span>{connected ? 'CONNECTED' : connecting ? 'CONNECTING...' : 'DISCONNECTED'}</span>
                </span>
              </div>
              <p className="text-[11px] text-carbon-400 font-mono mt-0.5">
                PTY interactive session • docker exec -it {containerId.substring(0, 12)} /bin/sh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-mono">
            <button
              onClick={connectExecSession}
              disabled={connecting}
              className="p-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-carbon-300 hover:text-dorito-400 border border-carbon-700 transition-colors"
              title="Reconnect Session"
            >
              <RotateCcw className={`w-4 h-4 ${connecting ? 'animate-spin text-dorito-500' : ''}`} />
            </button>

            <button
              onClick={() => {
                setFullscreen(!fullscreen);
                setTimeout(() => fitAddonRef.current?.fit(), 100);
              }}
              className="p-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-carbon-300 hover:text-white border border-carbon-700 transition-colors"
              title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-carbon-800 hover:bg-rose-600/20 text-carbon-300 hover:text-rose-400 border border-carbon-700 transition-colors ml-1"
              title="Close Terminal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Terminal Body */}
        <div className="flex-1 bg-black p-3 rounded-b-2xl overflow-hidden relative">
          <div ref={terminalRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};
