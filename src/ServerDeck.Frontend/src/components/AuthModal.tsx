import React, { useState } from 'react';
import { Lock, User, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { api, setToken } from '../api';
import { DoritoLogo } from './DoritoLogo';

interface AuthModalProps {
  isSetup: boolean;
  onSuccess: (username: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isSetup, onSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!isSetup && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (!isSetup) {
        // Initial setup
        const res = await api.auth.setup({ username: username.trim(), password });
        setToken(res.token);
        onSuccess(res.username);
      } else {
        // Login
        const res = await api.auth.login({ username: username.trim(), password });
        setToken(res.token);
        onSuccess(res.username);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 sm:p-8 relative">
        {/* Top Nijika Ribbon / Dorito Accent Bar */}
        <div className="absolute top-0 left-8 right-8 h-1 bg-gradient-to-r from-dorito-500 via-amber-500 to-rose-500 rounded-t-full"></div>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3 hover:scale-105 transition-transform">
            <DoritoLogo size={58} className="drop-shadow-[0_4px_16px_rgba(255,209,0,0.4)]" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-carbon-850 border border-carbon-700 text-[10px] font-mono text-carbon-400 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-dorito-500 animate-pulse"></span>
            <span>STARRY BACKSTAGE GATEWAY</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {!isSetup ? 'Initial Setup' : 'Sign in to NijiPanel'}
          </h2>
          <p className="text-xs text-dorito-400 font-mono mt-0.5 font-medium">
            ★ The Drummer of Your Servers ★
          </p>
          <p className="text-xs text-carbon-400 mt-2">
            {!isSetup
              ? 'Configure administrator credentials to secure your server infrastructure'
              : 'Enter your administrator credentials to access fleet management'}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-carbon-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-carbon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="w-full bg-carbon-850 border border-carbon-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 focus:ring-1 focus:ring-dorito-500 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-carbon-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-carbon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-carbon-850 border border-carbon-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 focus:ring-1 focus:ring-dorito-500 transition-all font-mono"
              />
            </div>
          </div>

          {!isSetup && (
            <div>
              <label className="block text-xs font-mono font-medium text-carbon-300 mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-carbon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 focus:ring-1 focus:ring-dorito-500 transition-all font-mono"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-dorito-500/20 transition-all disabled:opacity-50 active:scale-[0.99]"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{!isSetup ? 'Create Account & Sign In' : 'Sign In to NijiPanel'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Easter egg footer note */}
        <div className="mt-6 pt-4 border-t border-carbon-700 text-center">
          <span className="text-[10px] font-mono text-carbon-500">
            🥁 Kessoku Band Infrastructure • Powered by Dorito Ahoge
          </span>
        </div>
      </div>
    </div>
  );
};
