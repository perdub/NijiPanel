import React, { useState } from 'react';
import {
  Wrench,
  Key,
  Lock,
  Copy,
  Check,
  RefreshCw,
  Download,
  Terminal,
  ShieldCheck,
  CheckCircle2
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
  const [keyComment, setKeyComment] = useState('serverdeck-key');
  const [generatingKey, setGeneratingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<{
    publicKey: string;
    privateKey: string;
    type: string;
    fingerprint: string;
  } | null>(null);
  const [copiedPubKey, setCopiedPubKey] = useState(false);
  const [copiedPrivKey, setCopiedPrivKey] = useState(false);

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
      alert(`Ошибка: ${err.message}`);
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
      alert(`Ошибка генерации ключа: ${err.message}`);
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
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Утилиты & Генераторы</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Генерация паролей, SSH-ключей и команд автоматической настройки серверов
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Password Generator */}
        <div className="rounded-2xl bg-deck-900 border border-deck-800 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Генератор криптостойких паролей</h3>
                <p className="text-xs text-slate-400">Для root, баз данных и системных пользователей</p>
              </div>
            </div>

            {/* Generated Password Box */}
            <div className="relative mb-4">
              <div className="p-3.5 rounded-xl bg-black/70 border border-deck-700 font-mono text-sm sm:text-base text-emerald-400 break-all select-all flex items-center justify-between gap-2">
                <span>{generatedPassword || '••••••••••••••••'}</span>
                <button
                  onClick={() => copyText(generatedPassword, setCopiedPass)}
                  className="p-1.5 rounded-lg bg-deck-800 text-slate-300 hover:text-white shrink-0 transition-colors"
                  title="Скопировать"
                >
                  {copiedPass ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-3 mb-5">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                  <span>Длина пароля: {passLength} символов</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="64"
                  value={passLength}
                  onChange={(e) => setPassLength(parseInt(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSymbols}
                    onChange={(e) => setIncludeSymbols(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <span>Символы (!@#$)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNumbers}
                    onChange={(e) => setIncludeNumbers(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <span>Цифры (0-9)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeUpper}
                    onChange={(e) => setIncludeUpper(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <span>Заглавные (A-Z)</span>
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={handleGeneratePassword}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/20 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Сгенерировать новый пароль</span>
          </button>
        </div>

        {/* SSH Key Generator */}
        <div className="rounded-2xl bg-deck-900 border border-deck-800 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Генератор SSH-ключей</h3>
                <p className="text-xs text-slate-400">Генерация пары OpenSSH ключей (RSA 4096 / Ed25519)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Тип ключа</label>
                <select
                  value={keyType}
                  onChange={(e) => setKeyType(e.target.value)}
                  className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="rsa">RSA (4096 bit)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Комментарий</label>
                <input
                  type="text"
                  value={keyComment}
                  onChange={(e) => setKeyComment(e.target.value)}
                  placeholder="admin@server"
                  className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {generatedKey && (
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-400 font-medium">Публичный ключ</span>
                    <button
                      onClick={() => copyText(generatedKey.publicKey, setCopiedPubKey)}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedPubKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPubKey ? 'Скопировано' : 'Копировать'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-xl bg-black/70 border border-deck-800 text-[11px] font-mono text-emerald-400 max-h-16 overflow-auto">
                    {generatedKey.publicKey}
                  </pre>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => downloadTextFile('id_rsa.pub', generatedKey.publicKey)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-deck-850 hover:bg-deck-800 border border-deck-700 text-xs text-slate-300 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать .pub</span>
                  </button>
                  <button
                    onClick={() => downloadTextFile('id_rsa', generatedKey.privateKey)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-deck-850 hover:bg-deck-800 border border-deck-700 text-xs text-slate-300 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать приватный ключ</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateSshKey}
            disabled={generatingKey}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{generatingKey ? 'Генерация ключа...' : 'Сгенерировать SSH-ключ'}</span>
          </button>
        </div>
      </div>

      {/* One-Liner Server Command Generator */}
      <div className="rounded-2xl bg-deck-900 border border-deck-800 p-5 shadow-lg">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Генератор команды настройки сервера в 1 клик</h3>
            <p className="text-xs text-slate-400">
              Вставьте любой публичный ключ, чтобы получить готовую команду для выполнения на удаленном сервере
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Публичный ключ для авторизации</label>
            <textarea
              rows={2}
              value={customKeyInput}
              onChange={(e) => {
                setCustomKeyInput(e.target.value);
                handleGenerateCommand(e.target.value);
              }}
              placeholder="ssh-rsa AAAA..."
              className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">Готовая команда для консоли сервера</label>
              <button
                onClick={() => copyText(generatedCommand, setCopiedCmd)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd ? 'Скопировано!' : 'Скопировать команду'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-black/80 border border-deck-700 font-mono text-xs text-emerald-400 break-all select-all whitespace-pre-wrap leading-relaxed">
              {generatedCommand}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
