import React, { useState } from 'react';
import {
  Key,
  Lock,
  Copy,
  Check,
  RefreshCw,
  Download,
  Terminal,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { api } from '../api';

interface UtilsViewProps {
  masterPublicKey: string;
}

export const UtilsView: React.FC<UtilsViewProps> = ({ masterPublicKey }) => {
  // Password Generator States
  const [passLength, setPassLength] = useState(20);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copiedPass, setCopiedPass] = useState(false);

  // SSH Key Generator States
  const [keyType, setKeyType] = useState('rsa');
  const [keyBits, setKeyBits] = useState(4096);
  const [keyComment, setKeyComment] = useState('nijipanel-key');
  const [generatingKey, setGeneratingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<{
    publicKey: string;
    privateKey: string;
    type: string;
    fingerprint: string;
  } | null>(null);
  const [copiedPubKey, setCopiedPubKey] = useState(false);

  // Setup Command States
  const [customKeyInput, setCustomKeyInput] = useState(masterPublicKey);
  const [generatedCommand, setGeneratedCommand] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Generate initial password on first render
  React.useEffect(() => {
    handleGeneratePassword();
    handleGenerateCommand(masterPublicKey);
  }, [masterPublicKey]);

  const handleGeneratePassword = async () => {
    try {
      const res = await api.utils.generatePassword({
        length: passLength,
        includeSymbols,
        includeNumbers,
        includeUppercase: includeUpper,
      });
      setGeneratedPassword(res.password);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleGenerateSshKey = async () => {
    setGeneratingKey(true);
    try {
      const res = await api.utils.generateSshKey({
        type: keyType,
        bits: keyBits,
        comment: keyComment,
      });
      setGeneratedKey(res);
    } catch (err: any) {
      alert(`SSH key generation failed: ${err.message}`);
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleGenerateCommand = async (pubKey: string) => {
    try {
      const res = await api.utils.getSetupCommand(pubKey || undefined);
      setGeneratedCommand(res.command);
    } catch (err: any) {
      console.error(err);
    }
  };

  const copyText = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="border-b border-carbon-700/80 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-medium text-white tracking-tight">Utilities & Generators</h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-semibold">
            KESSOKU TOOLKIT
          </span>
        </div>
        <p className="text-xs sm:text-sm text-carbon-400 mt-1 font-mono">
          Generate secure passwords, SSH keypairs, and 1-click server provisioning commands
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Password Generator */}
        <div className="rounded-xl bg-carbon-900 border border-carbon-700 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-dorito-500/20 border border-dorito-500/30 flex items-center justify-center text-dorito-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-medium text-white text-base font-sans">Password Generator</h3>
                <p className="text-xs text-carbon-400 font-mono">For root credentials, databases, and system users</p>
              </div>
            </div>

            {/* Generated Password Box */}
            <div className="relative mb-4">
              <div className="p-3.5 rounded-lg bg-black/80 border border-carbon-700 font-mono text-sm sm:text-base text-dorito-400 break-all select-all flex items-center justify-between gap-2">
                <span>{generatedPassword || '••••••••••••••••'}</span>
                <button
                  onClick={() => copyText(generatedPassword, setCopiedPass)}
                  className="p-1.5 rounded-lg bg-carbon-850 text-carbon-300 hover:text-white shrink-0 transition-colors border border-carbon-700"
                  title="Copy password"
                >
                  {copiedPass ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-3 mb-5 font-mono">
              <div>
                <div className="flex justify-between text-xs font-medium text-carbon-300 mb-1.5">
                  <span>Password length: {passLength} characters</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="64"
                  value={passLength}
                  onChange={(e) => setPassLength(parseInt(e.target.value))}
                  className="w-full accent-dorito-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-carbon-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSymbols}
                    onChange={(e) => setIncludeSymbols(e.target.checked)}
                    className="rounded accent-dorito-500"
                  />
                  <span>Symbols (!@#$)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNumbers}
                    onChange={(e) => setIncludeNumbers(e.target.checked)}
                    className="rounded accent-dorito-500"
                  />
                  <span>Numbers (0-9)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeUpper}
                    onChange={(e) => setIncludeUpper(e.target.checked)}
                    className="rounded accent-dorito-500"
                  />
                  <span>Uppercase (A-Z)</span>
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={handleGeneratePassword}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shadow-md shadow-dorito-500/20 transition-all font-mono"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Generate New Password</span>
          </button>
        </div>

        {/* SSH Key Generator */}
        <div className="rounded-xl bg-carbon-900 border border-carbon-700 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-medium text-white text-base font-sans">SSH Key Generator</h3>
                <p className="text-xs text-carbon-400 font-mono">Generate OpenSSH keypair (RSA 4096 / Ed25519)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 font-mono">
              <div>
                <label className="block text-xs font-medium text-carbon-300 mb-1">Key Type</label>
                <select
                  value={keyType}
                  onChange={(e) => setKeyType(e.target.value)}
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-dorito-500"
                >
                  <option value="rsa">RSA (4096 bit)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-carbon-300 mb-1">Comment</label>
                <input
                  type="text"
                  value={keyComment}
                  onChange={(e) => setKeyComment(e.target.value)}
                  placeholder="admin@server"
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-dorito-500"
                />
              </div>
            </div>

            {generatedKey && (
              <div className="space-y-3 mb-4 font-mono">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-carbon-400 font-medium">Public Key</span>
                    <button
                      onClick={() => copyText(generatedKey.publicKey, setCopiedPubKey)}
                      className="text-dorito-400 hover:text-dorito-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedPubKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPubKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-black/80 border border-carbon-700 text-[11px] font-mono text-dorito-300 max-h-16 overflow-auto">
                    {generatedKey.publicKey}
                  </pre>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => downloadTextFile('id_rsa.pub', generatedKey.publicKey)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs text-carbon-200 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .pub</span>
                  </button>
                  <button
                    onClick={() => downloadTextFile('id_rsa', generatedKey.privateKey)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs text-carbon-200 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .key</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateSshKey}
            disabled={generatingKey}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-carbon-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 font-mono"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{generatingKey ? 'Generating Key...' : 'Generate SSH Keypair'}</span>
          </button>
        </div>
      </div>

      {/* One-Liner Server Command Generator */}
      <div className="rounded-xl bg-carbon-900 border border-carbon-700 p-5 shadow-lg">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-dorito-500/20 border border-dorito-500/30 flex items-center justify-center text-dorito-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-medium text-white text-base font-sans">1-Click Server Provisioning Script</h3>
            <p className="text-xs text-carbon-400 font-mono">
              Paste any public SSH key to generate an automated deployment command for target hosts
            </p>
          </div>
        </div>

        <div className="space-y-3 font-mono">
          <div>
            <label className="block text-xs font-medium text-carbon-300 mb-1">Authorized Public Key</label>
            <textarea
              rows={2}
              value={customKeyInput}
              onChange={(e) => {
                setCustomKeyInput(e.target.value);
                handleGenerateCommand(e.target.value);
              }}
              placeholder="ssh-rsa AAAA..."
              className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-dorito-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-carbon-300">Target Host Command</label>
              <button
                onClick={() => copyText(generatedCommand, setCopiedCmd)}
                className="flex items-center gap-1 text-xs text-dorito-400 hover:text-dorito-300 font-medium"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd ? 'Copied!' : 'Copy Command'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-lg bg-black/80 border border-carbon-700 font-mono text-xs text-dorito-300 break-all select-all whitespace-pre-wrap leading-relaxed">
              {generatedCommand}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
