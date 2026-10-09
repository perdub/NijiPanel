import React, { useState, useRef } from 'react';
import {
  Key,
  Lock,
  Copy,
  Check,
  RefreshCw,
  X,
  Shield,
  AlertCircle,
  Database,
  Cloud,
  Download,
  Upload,
  ArrowRight,
  CheckCircle2,
  Share2
} from 'lucide-react';
import { api } from '../api';
import { MasterKey } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterKey: MasterKey | null;
  onMasterKeyUpdated: (key: MasterKey) => void;
  onBackupRestored?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  masterKey,
  onMasterKeyUpdated,
  onBackupRestored,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'key' | 'password' | 'backup'>('key');
  const [copiedKey, setCopiedKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Change password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passMessage, setPassMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Backup & Cloud Share States
  const [cloudExporting, setCloudExporting] = useState(false);
  const [cloudExportResult, setCloudExportResult] = useState<{
    shareCode: string;
    shareUrl: string;
    passphrase: string;
  } | null>(null);
  const [copiedShareCode, setCopiedShareCode] = useState(false);
  const [copiedPassphrase, setCopiedPassphrase] = useState(false);

  // Cloud Import States
  const [importShareCode, setImportShareCode] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [cloudImporting, setCloudImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Local file backup
  const [localPassphrase, setLocalPassphrase] = useState('');
  const [localExporting, setLocalExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    if (!masterKey) return;
    navigator.clipboard.writeText(masterKey.publicKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRegenerateKey = async () => {
    if (!confirm('ВНИМАНИЕ: Перегенерация мастер-ключа сделает невозможным подключение к серверам, где установлен старый ключ, до обновления authorized_keys. Продолжить?')) {
      return;
    }

    setRegenerating(true);
    try {
      const updated = await api.settings.regenerateMasterKey(4096);
      onMasterKeyUpdated(updated);
      alert('Мастер-ключ успешно перегенерирован!');
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setRegenerating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage(null);

    if (newPassword !== confirmPassword) {
      setPassMessage({ type: 'error', text: 'Новые пароли не совпадают' });
      return;
    }

    setPassSaving(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      setPassMessage({ type: 'success', text: 'Пароль администратора успешно изменен!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassMessage({ type: 'error', text: err.message || 'Ошибка смены пароля' });
    } finally {
      setPassSaving(false);
    }
  };

  const handleCloudExport = async () => {
    setCloudExporting(true);
    setCloudExportResult(null);
    try {
      const res = await api.backup.cloudExport();
      setCloudExportResult(res);
    } catch (err: any) {
      alert(`Ошибка облачного экспорта: ${err.message}`);
    } finally {
      setCloudExporting(false);
    }
  };

  const handleCloudImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importShareCode.trim() || !importPassphrase.trim()) {
      alert('Укажите Код/Ссылку и Пароль расшифровки');
      return;
    }

    setCloudImporting(true);
    setImportStatus(null);
    try {
      const res = await api.backup.cloudImport({
        shareCodeOrUrl: importShareCode.trim(),
        passphrase: importPassphrase.trim(),
      });
      setImportStatus(`Успешно импортировано хостов: ${res.importedHosts}! Перезагружаю данные...`);
      setTimeout(() => {
        onBackupRestored?.();
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      alert(`Ошибка импорта: ${err.message}`);
    } finally {
      setCloudImporting(false);
    }
  };

  const handleLocalExport = async () => {
    if (!localPassphrase.trim()) {
      alert('Задайте пароль для шифрования файла бэкапа');
      return;
    }
    setLocalExporting(true);
    try {
      const res = await api.backup.export(localPassphrase.trim());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `serverdeck-backup-${new Date().toISOString().slice(0, 10)}.deck`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setLocalExporting(false);
    }
  };

  const handleLocalImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const pass = prompt('Введите пароль расшифровки бэкапа:');
    if (!pass) return;

    try {
      const res = await api.backup.import(file, pass);
      alert(`Бэкап успешно восстановлен! Импортировано хостов: ${res.importedHosts}`);
      window.location.reload();
    } catch (err: any) {
      alert(`Ошибка восстановления: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-deck-900 border border-deck-700 rounded-2xl shadow-2xl p-6 relative max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-deck-800 mb-4">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white text-lg">Настройки ServerDeck</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="flex border-b border-deck-800 mb-5 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('key')}
            className={`pb-2.5 border-b-2 transition-colors ${
              activeSubTab === 'key'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Мастер-ключ SSH
          </button>
          <button
            onClick={() => setActiveSubTab('password')}
            className={`pb-2.5 border-b-2 transition-colors ${
              activeSubTab === 'password'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Смена пароля
          </button>
          <button
            onClick={() => setActiveSubTab('backup')}
            className={`pb-2.5 border-b-2 transition-colors ${
              activeSubTab === 'backup'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Бэкап & Облачный переезд
          </button>
        </div>

        {/* Tab 1: Global Master Key */}
        {activeSubTab === 'key' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Используется по умолчанию для добавления на любые серверы в 1 клик.
              </span>
              <button
                onClick={handleRegenerateKey}
                disabled={regenerating}
                className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
                <span>Перегенерировать</span>
              </button>
            </div>

            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-black/70 border border-deck-800 font-mono text-[11px] text-emerald-400 max-h-36 overflow-y-auto break-all select-all leading-relaxed">
                {masterKey?.publicKey || 'Загрузка...'}
              </pre>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-mono text-[11px] text-slate-500 truncate max-w-xs">
                {masterKey?.fingerprint}
              </span>
              <button
                onClick={handleCopyKey}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-colors"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Скопировано!' : 'Скопировать .pub ключ'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Change Password */}
        {activeSubTab === 'password' && (
          <div>
            {passMessage && (
              <div
                className={`p-3 rounded-xl mb-4 text-xs flex items-center gap-2 ${
                  passMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {passMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{passMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Текущий пароль</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Новый пароль</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Повторите новый пароль</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={passSaving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {passSaving ? 'Сохранение...' : 'Обновить пароль'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Backup & Cloud Share (2 Values) */}
        {activeSubTab === 'backup' && (
          <div className="space-y-6">
            {/* Cloud Export in 2 Values */}
            <div className="p-4 rounded-2xl bg-deck-850/80 border border-deck-700/80 space-y-3">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">Облачный переезд в «2 значения» (Zero-Knowledge)</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Панель полностью шифрует всю базу алгоритмом <strong>AES-256-GCM</strong> и анонимно загружает зашифрованный блоб. Вам нужно сохранить всего <strong>2 значения</strong>: код и пароль.
              </p>

              <button
                onClick={handleCloudExport}
                disabled={cloudExporting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{cloudExporting ? 'Шифрование и выгрузка...' : 'Сгенерировать облачный бэкап'}</span>
              </button>

              {cloudExportResult && (
                <div className="mt-3 p-3.5 rounded-xl bg-black/80 border border-deck-700 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">1. Код обмена / Ссылка:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(cloudExportResult.shareUrl);
                        setCopiedShareCode(true);
                        setTimeout(() => setCopiedShareCode(false), 2000);
                      }}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedShareCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedShareCode ? 'Скопировано' : 'Копировать'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-xs text-cyan-400 break-all select-all">
                    {cloudExportResult.shareUrl}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-deck-800">
                    <span className="text-slate-400 font-medium">2. Пароль расшифровки:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(cloudExportResult.passphrase);
                        setCopiedPassphrase(true);
                        setTimeout(() => setCopiedPassphrase(false), 2000);
                      }}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
                    >
                      {copiedPassphrase ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPassphrase ? 'Скопировано' : 'Копировать'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-xs text-emerald-400 break-all select-all">
                    {cloudExportResult.passphrase}
                  </div>
                </div>
              )}
            </div>

            {/* Cloud Restore */}
            <div className="p-4 rounded-2xl bg-deck-850/80 border border-deck-700/80 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Восстановить из облака по 2 значениям</span>
              </h4>

              {importStatus && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
                  {importStatus}
                </div>
              )}

              <form onSubmit={handleCloudImport} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">1. Код обмена или URL</label>
                    <input
                      type="text"
                      value={importShareCode}
                      onChange={(e) => setImportShareCode(e.target.value)}
                      placeholder="abcde или https://paste.rs/..."
                      required
                      className="w-full bg-deck-900 border border-deck-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">2. Пароль расшифровки</label>
                    <input
                      type="text"
                      value={importPassphrase}
                      onChange={(e) => setImportPassphrase(e.target.value)}
                      placeholder="Секретный пароль"
                      required
                      className="w-full bg-deck-900 border border-deck-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={cloudImporting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <span>{cloudImporting ? 'Загрузка и расшифровка...' : 'Восстановить данные'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>

            {/* Local Offline File Export / Import */}
            <div className="p-4 rounded-2xl bg-deck-850/80 border border-deck-700/80 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                <span>Офлайн файл бэкапа (.deck)</span>
              </h4>

              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Пароль шифрования файла</label>
                  <input
                    type="password"
                    value={localPassphrase}
                    onChange={(e) => setLocalPassphrase(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-deck-900 border border-deck-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleLocalExport}
                    disabled={localExporting}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-deck-800 hover:bg-deck-700 text-white text-xs font-medium transition-colors border border-deck-600"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать файл</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLocalImportFile}
                    accept=".deck,.json"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-deck-800 hover:bg-deck-700 text-white text-xs font-medium transition-colors border border-deck-600"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Загрузить</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
