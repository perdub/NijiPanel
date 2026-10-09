import React, { useState, useEffect } from 'react';
import {
  Compass,
  Key,
  Server,
  Terminal,
  Layers,
  FolderTree,
  Check,
  Copy,
  ArrowRight,
  ArrowLeft,
  Wrench,
  Sparkles,
  X,
  ShieldCheck,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { MasterKey, Host } from '../types';
import { api } from '../api';
import { DoritoLogo } from './DoritoLogo';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterKey: MasterKey | null;
  onHostCreated: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  masterKey,
  onHostCreated,
  onNavigateTab,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(true);

  // Step 1: SSH Key Copy state
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Step 2: First Host Form state
  const [hostName, setHostName] = useState('My First Server');
  const [hostAddress, setHostAddress] = useState('');
  const [hostPort, setHostPort] = useState(22);
  const [hostUsername, setHostUsername] = useState('root');
  const [hostAuthType, setHostAuthType] = useState<'global_key' | 'password'>('global_key');
  const [hostPassword, setHostPassword] = useState('');
  const [hostHardening, setHostHardening] = useState(false);
  const [hostBootstrap, setHostBootstrap] = useState(true);
  const [isSubmittingHost, setIsSubmittingHost] = useState(false);
  const [hostSuccess, setHostSuccess] = useState<string | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);

  // Step 3: Provisioning Stack state
  const [bootstrapEnabled, setBootstrapEnabled] = useState(true);
  const [bootstrapScript, setBootstrapScript] = useState(
    `# Full Stack: Utilities + Docker + Compose\napt-get update -y && apt-get install -y neofetch htop curl git jq unzip ufw fail2ban\ncurl -fsSL https://get.docker.com | sh\napt-get install -y docker-compose-plugin\nsystemctl enable --now docker`
  );
  const [savingBootstrap, setSavingBootstrap] = useState(false);
  const [bootstrapSaved, setBootstrapSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load current bootstrap script from backend if available
      api.settings.getBootstrapScript().then((res) => {
        if (res.script) {
          setBootstrapScript(res.script);
          setBootstrapEnabled(res.enabled);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const oneLinerCommand = masterKey?.publicKey
    ? `mkdir -p ~/.ssh && echo "${masterKey.publicKey}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`
    : '';

  const handleCopyKey = () => {
    if (!masterKey?.publicKey) return;
    navigator.clipboard.writeText(masterKey.publicKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyCommand = () => {
    if (!oneLinerCommand) return;
    navigator.clipboard.writeText(oneLinerCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const handleCreateFirstHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostAddress.trim()) {
      setHostError('Please enter a server IP address or hostname');
      return;
    }

    setIsSubmittingHost(true);
    setHostError(null);
    setHostSuccess(null);

    try {
      const created = await api.hosts.create({
        name: hostName.trim() || 'My Server',
        host: hostAddress.trim(),
        port: hostPort,
        username: hostUsername.trim() || 'root',
        authType: hostAuthType,
        credential: hostAuthType === 'password' ? hostPassword : '',
        hardeningRandomPort: hostHardening,
        notes: 'Added via Onboarding Wizard',
      } as any);

      setHostSuccess(`Server "${created.name}" registered successfully!`);
      onHostCreated();
      setTimeout(() => {
        setCurrentStep(3);
      }, 1200);
    } catch (err: any) {
      setHostError(err.message || 'Failed to connect to host');
    } finally {
      setIsSubmittingHost(false);
    }
  };

  const handleSaveBootstrap = async () => {
    setSavingBootstrap(true);
    try {
      await api.settings.setBootstrapScript({
        script: bootstrapScript,
        enabled: bootstrapEnabled,
      });
      setBootstrapSaved(true);
      setTimeout(() => setBootstrapSaved(false), 2500);
      setCurrentStep(4);
    } catch (err: any) {
      alert(`Failed to save bootstrap stack: ${err.message}`);
    } finally {
      setSavingBootstrap(false);
    }
  };

  const handleFinish = (targetTab = 'hosts') => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('nijipanel_onboarding_completed', 'true');
      } catch {}
    }
    onClose();
    if (onNavigateTab) {
      onNavigateTab(targetTab);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-carbon-700/80 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <DoritoLogo size={28} />
            <div>
              <h3 className="font-medium text-white text-base font-sans tracking-tight">
                Niji<span className="text-dorito-500">Panel</span> Onboarding Wizard
              </h3>
              <p className="text-[11px] font-mono text-carbon-400">
                Setup guide & quick initial server configuration
              </p>
            </div>
          </div>

          <button
            onClick={() => handleFinish('hosts')}
            className="p-1 rounded text-carbon-400 hover:text-white transition-colors"
            title="Close Wizard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="grid grid-cols-4 gap-2 mb-5 font-mono text-[11px] shrink-0">
          {[
            { num: 1, label: 'SSH KEY' },
            { num: 2, label: 'FIRST SERVER' },
            { num: 3, label: 'STACK SETUP' },
            { num: 4, label: 'TOUR & FINISH' },
          ].map((st) => {
            const isActive = currentStep === st.num;
            const isDone = currentStep > st.num;
            return (
              <button
                key={st.num}
                onClick={() => setCurrentStep(st.num)}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-left transition-colors ${
                  isActive
                    ? 'bg-carbon-850 border-dorito-500 text-dorito-400 font-medium'
                    : isDone
                    ? 'bg-carbon-950/80 border-emerald-500/40 text-emerald-400'
                    : 'bg-carbon-950/40 border-carbon-800 text-carbon-500 hover:text-carbon-300'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    isActive
                      ? 'bg-dorito-500 text-black font-bold'
                      : isDone
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-carbon-800 text-carbon-500'
                  }`}
                >
                  {isDone ? <Check className="w-2.5 h-2.5" /> : st.num}
                </span>
                <span className="truncate hidden sm:inline">{st.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Step Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* STEP 1: SSH MASTER KEY & ONE-LINER */}
          {currentStep === 1 && (
            <div className="space-y-4 font-mono text-xs">
              <div className="p-3 rounded-xl bg-carbon-850 border border-carbon-700/80 space-y-1">
                <div className="flex items-center gap-2 text-white font-medium text-xs">
                  <Key className="w-4 h-4 text-dorito-500" />
                  <span>Agentless SSH Architecture</span>
                </div>
                <p className="text-[11px] text-carbon-300 font-sans leading-relaxed">
                  NijiPanel connects directly to your Linux servers via native OpenSSH. No background agents or daemons are needed on your hosts! Simply authorize the NijiPanel Master Key below.
                </p>
              </div>

              {/* One-Liner Command */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-carbon-400">
                    Option A: 1-Click Server Command (Paste on your VPS terminal):
                  </span>
                  <button
                    onClick={handleCopyCommand}
                    className="flex items-center gap-1 text-[11px] text-dorito-400 hover:text-white transition-colors"
                  >
                    {copiedCommand ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCommand ? 'Copied Command!' : 'Copy Command'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-black border border-carbon-700 text-dorito-300 text-[11px] break-all select-all leading-relaxed whitespace-pre-wrap">
                  {oneLinerCommand || 'Generating master key...'}
                </pre>
              </div>

              {/* Public Key Display */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-carbon-400">
                    Option B: Raw OpenSSH Public Key:
                  </span>
                  <button
                    onClick={handleCopyKey}
                    className="flex items-center gap-1 text-[11px] text-dorito-400 hover:text-white transition-colors"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied Key!' : 'Copy Key'}</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded-xl bg-black/80 border border-carbon-700 text-carbon-300 text-[10px] break-all select-all max-h-24 overflow-y-auto">
                  {masterKey?.publicKey || 'Loading key...'}
                </pre>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-carbon-400 hover:text-white text-xs underline"
                >
                  I've already added the key
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-600 text-black font-semibold text-xs transition-colors shadow-md shadow-dorito-500/20"
                >
                  <span>Next: Connect First Server</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CONNECT FIRST SERVER */}
          {currentStep === 2 && (
            <form onSubmit={handleCreateFirstHost} className="space-y-3.5 font-mono text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-carbon-800">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-dorito-500" />
                  <span className="text-white font-medium text-xs">Add Your First Target Server</span>
                </div>
                <span className="text-[10px] text-carbon-500">Step 2 of 4</span>
              </div>

              {hostSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2 text-xs">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{hostSuccess}</span>
                </div>
              )}

              {hostError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{hostError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-carbon-400 text-[11px] mb-1">Friendly Server Name</label>
                  <input
                    type="text"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder="Production VPS / Home Lab"
                    className="w-full bg-black border border-carbon-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-dorito-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-carbon-400 text-[11px] mb-1">IP Address or Domain</label>
                  <input
                    type="text"
                    value={hostAddress}
                    onChange={(e) => setHostAddress(e.target.value)}
                    placeholder="192.168.1.100 or vps.domain.com"
                    className="w-full bg-black border border-carbon-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-dorito-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-carbon-400 text-[11px] mb-1">SSH Port</label>
                  <input
                    type="number"
                    value={hostPort}
                    onChange={(e) => setHostPort(parseInt(e.target.value) || 22)}
                    className="w-full bg-black border border-carbon-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-dorito-500"
                  />
                </div>

                <div>
                  <label className="block text-carbon-400 text-[11px] mb-1">SSH Username</label>
                  <input
                    type="text"
                    value={hostUsername}
                    onChange={(e) => setHostUsername(e.target.value)}
                    placeholder="root"
                    className="w-full bg-black border border-carbon-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-dorito-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-carbon-400 text-[11px] mb-1">Authentication Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHostAuthType('global_key')}
                    className={`py-2 px-3 rounded-lg border text-xs transition-colors ${
                      hostAuthType === 'global_key'
                        ? 'bg-dorito-500/15 border-dorito-500 text-dorito-400 font-bold'
                        : 'bg-carbon-850 border-carbon-700 text-carbon-400 hover:text-white'
                    }`}
                  >
                    Master Key (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHostAuthType('password')}
                    className={`py-2 px-3 rounded-lg border text-xs transition-colors ${
                      hostAuthType === 'password'
                        ? 'bg-dorito-500/15 border-dorito-500 text-dorito-400 font-bold'
                        : 'bg-carbon-850 border-carbon-700 text-carbon-400 hover:text-white'
                    }`}
                  >
                    SSH Password
                  </button>
                </div>
              </div>

              {hostAuthType === 'password' && (
                <div>
                  <label className="block text-carbon-400 text-[11px] mb-1">Server SSH Password</label>
                  <input
                    type="password"
                    value={hostPassword}
                    onChange={(e) => setHostPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-black border border-carbon-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-dorito-500"
                    required
                  />
                </div>
              )}

              {/* Options */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl bg-carbon-850 border border-carbon-700/80 hover:border-dorito-500/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={hostBootstrap}
                    onChange={(e) => setHostBootstrap(e.target.checked)}
                    className="w-4 h-4 rounded bg-carbon-800 border-carbon-700 text-dorito-500 focus:ring-0"
                  />
                  <div>
                    <span className="text-white text-xs font-medium block">
                      Auto-Provision: Install initial stack (Docker, Neofetch, etc.)
                    </span>
                    <span className="text-[10px] text-carbon-400 block">
                      Executes bootstrap script in background upon connection.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl bg-carbon-850 border border-carbon-700/80 hover:border-dorito-500/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={hostHardening}
                    onChange={(e) => setHostHardening(e.target.checked)}
                    className="w-4 h-4 rounded bg-carbon-800 border-carbon-700 text-dorito-500 focus:ring-0"
                  />
                  <div>
                    <span className="text-white text-xs font-medium block">
                      Hardening: Auto-switch SSH port to random high port (20000-59000)
                    </span>
                    <span className="text-[10px] text-carbon-400 block">
                      Protects against generic bot brute-force attacks.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-between items-center pt-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-carbon-850 text-carbon-300 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="text-carbon-400 hover:text-white text-xs underline px-2"
                  >
                    Skip adding server now
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingHost}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-600 text-black font-semibold text-xs transition-colors disabled:opacity-50 shadow-md shadow-dorito-500/20"
                  >
                    {isSubmittingHost ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect & Continue</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: INITIAL PROVISIONING STACK */}
          {currentStep === 3 && (
            <div className="space-y-3.5 font-mono text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-carbon-800">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-dorito-500" />
                  <span className="text-white font-medium text-xs">Configure Auto-Provisioning Packages</span>
                </div>
                <span className="text-[10px] text-carbon-500">Step 3 of 4</span>
              </div>

              <p className="text-[11px] text-carbon-300 font-sans leading-relaxed">
                Choose the software stack NijiPanel installs automatically on every newly registered server via SSH root/sudo permissions.
              </p>

              {/* Enable Toggle */}
              <div className="p-2.5 rounded-xl bg-carbon-850 border border-carbon-700/80">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bootstrapEnabled}
                    onChange={(e) => setBootstrapEnabled(e.target.checked)}
                    className="w-4 h-4 rounded bg-carbon-800 border-carbon-700 text-dorito-500 focus:ring-0"
                  />
                  <div>
                    <span className="text-white text-xs font-medium block">
                      Enable automatic provisioning on new servers
                    </span>
                    <span className="text-[10px] text-carbon-400 block">
                      Runs the script below in background whenever a new host is added.
                    </span>
                  </div>
                </label>
              </div>

              {/* Stack Presets */}
              <div className="space-y-1">
                <span className="text-[11px] text-carbon-400 block">Stack Presets:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setBootstrapScript(
                        `# Full Stack: Utilities + Docker + Compose\napt-get update -y && apt-get install -y neofetch htop curl git jq unzip ufw fail2ban\ncurl -fsSL https://get.docker.com | sh\napt-get install -y docker-compose-plugin\nsystemctl enable --now docker`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-carbon-200 hover:text-white border border-carbon-700 text-[11px] transition-colors"
                  >
                    ★ Recommended Full Stack (Docker + Tools)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBootstrapScript(
                        `# Docker + Compose Only\napt-get update -y && apt-get install -y curl ca-certificates\ncurl -fsSL https://get.docker.com | sh\napt-get install -y docker-compose-plugin\nsystemctl enable --now docker`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-carbon-200 hover:text-white border border-carbon-700 text-[11px] transition-colors"
                  >
                    + Docker & Compose
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBootstrapScript(
                        `# Essential Sysadmin Utilities\napt-get update -y && apt-get install -y neofetch htop curl git jq unzip ufw fail2ban`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-carbon-200 hover:text-white border border-carbon-700 text-[11px] transition-colors"
                  >
                    + Neofetch & Tools
                  </button>
                </div>
              </div>

              {/* Script Textarea */}
              <div>
                <label className="block text-carbon-400 text-[11px] mb-1">
                  Bootstrap Shell Script (Bash)
                </label>
                <textarea
                  rows={5}
                  value={bootstrapScript}
                  onChange={(e) => setBootstrapScript(e.target.value)}
                  className="w-full bg-black border border-carbon-700 rounded-xl px-3 py-2 text-dorito-300 font-mono text-xs focus:outline-none focus:border-dorito-500 leading-relaxed"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-carbon-850 text-carbon-300 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveBootstrap}
                  disabled={savingBootstrap}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-600 text-black font-semibold text-xs transition-colors shadow-md shadow-dorito-500/20"
                >
                  {savingBootstrap ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span>Save & Continue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: QUICK FEATURE TOUR & FINISH */}
          {currentStep === 4 && (
            <div className="space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-carbon-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-dorito-500" />
                  <span className="text-white font-medium text-xs">You're All Set! Key Feature Tour</span>
                </div>
                <span className="text-[10px] text-emerald-400">Ready to Rock</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-carbon-850 border border-carbon-700/80 space-y-1">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Terminal className="w-4 h-4 text-dorito-500" />
                    <span>Multi-Session Terminal</span>
                  </div>
                  <p className="text-[11px] text-carbon-400 font-sans leading-relaxed">
                    Open unlimited tabs with `+ New Tab`, rename sessions, and run commands without dropping connection when switching tabs.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-carbon-850 border border-carbon-700/80 space-y-1">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Layers className="w-4 h-4 text-dorito-500" />
                    <span>1-Click App Store</span>
                  </div>
                  <p className="text-[11px] text-carbon-400 font-sans leading-relaxed">
                    Deploy 32 curated Compose apps (Postgres, Redis, Jellyfin, Stirling-PDF) with pre-filled environment variables.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-carbon-850 border border-carbon-700/80 space-y-1">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <FolderTree className="w-4 h-4 text-dorito-500" />
                    <span>Storage & SFTP</span>
                  </div>
                  <p className="text-[11px] text-carbon-400 font-sans leading-relaxed">
                    File manager with zip/tar in-place extraction, Monaco Diff editor, and secure public download share links with expiration.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-carbon-850 border border-carbon-700/80 space-y-1">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Compass className="w-4 h-4 text-dorito-500" />
                    <span>Resizable Tree Sidebar</span>
                  </div>
                  <p className="text-[11px] text-carbon-400 font-sans leading-relaxed">
                    Drag right border to adjust width (200-460px). Hierarchical tree organizes servers, apps, and system tools cleanly.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer text-carbon-400 text-xs select-none">
                  <input
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 rounded bg-carbon-800 border-carbon-700 text-dorito-500 focus:ring-0"
                  />
                  <span>Don't show this setup wizard automatically on startup</span>
                </label>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-carbon-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-carbon-850 text-carbon-300 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleFinish('terminal')}
                    className="px-3.5 py-2 rounded-xl bg-carbon-850 hover:bg-carbon-800 text-white border border-carbon-700 text-xs font-mono transition-colors"
                  >
                    Open Terminal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFinish('hosts')}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-600 text-black font-semibold text-xs transition-colors shadow-lg shadow-dorito-500/25"
                  >
                    <span>Launch NijiPanel</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
