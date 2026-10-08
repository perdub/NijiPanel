import React, { useState } from 'react';
import { Key, Lock, Copy, Check, RefreshCw, X, Shield, AlertCircle } from 'lucide-react';
import { api } from '../api';
import { MasterKey } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterKey: MasterKey | null;
  onMasterKeyUpdated: (key: MasterKey) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  masterKey,
  onMasterKeyUpdated,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Change password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passMessage, setPassMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-deck-900 border border-deck-700 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-deck-800 mb-5">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white text-lg">Настройки безопасности</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Master Key Section */}
        <div className="mb-6 pb-6 border-b border-deck-800">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              <span>Глобальный мастер-ключ ServerDeck</span>
            </h4>
            <button
              onClick={handleRegenerateKey}
              disabled={regenerating}
              className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
              <span>Перегенерировать</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Этот публичный ключ используется по умолчанию для всех добавленных серверов с типом авторизации «Мастер-ключ».
          </p>

          <div className="relative mb-2">
            <pre className="p-3 rounded-xl bg-black/70 border border-deck-800 font-mono text-[11px] text-emerald-400 max-h-24 overflow-y-auto break-all select-all">
              {masterKey?.publicKey || 'Загрузка...'}
            </pre>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[11px] text-slate-500 truncate max-w-xs">
              {masterKey?.fingerprint}
            </span>
            <button
              onClick={handleCopyKey}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-colors"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey ? 'Скопировано!' : 'Скопировать .pub'}</span>
            </button>
          </div>
        </div>

        {/* Change Admin Password */}
        <div>
          <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-blue-400" />
            <span>Смена пароля администратора</span>
          </h4>
          <p className="text-xs text-slate-400 mb-4">
            Обновите мастер-пароль для входа в веб-панель ServerDeck.
          </p>

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
      </div>
    </div>
  );
};
