import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  FolderTree,
  Folder,
  FileText,
  Image as ImageIcon,
  Music,
  File,
  ChevronRight,
  ArrowUp,
  Download,
  Trash2,
  Edit3,
  Plus,
  Upload,
  RefreshCw,
  Save,
  X,
  Check,
  AlertCircle,
  Eye,
  Copy,
  ClipboardPaste,
  Send
} from 'lucide-react';
import { Host, DirectoryListing, FileItem } from '../types';
import { api } from '../api';

interface FilesViewProps {
  selectedHost: Host | null;
  initialPath?: string;
}

export const FilesView: React.FC<FilesViewProps> = ({ selectedHost, initialPath = '/' }) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor Modal
  const [editingFile, setEditingFile] = useState<{ path: string; content: string; language: string } | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorSaved, setEditorSaved] = useState(false);

  // Media Viewer Modals
  const [viewingImage, setViewingImage] = useState<{ path: string; name: string } | null>(null);
  const [viewingAudio, setViewingAudio] = useState<{ path: string; name: string } | null>(null);

  // New folder / file modal
  const [createModal, setCreateModal] = useState<'file' | 'folder' | null>(null);
  const [createName, setCreateName] = useState('');

  // Cross-server direct clipboard
  const [clipboard, setClipboard] = useState<{
    sourceHostId: string;
    sourceHostName: string;
    sourcePath: string;
    name: string;
    isDirectory: boolean;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('serverdeck_file_clipboard');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<{
    title: string;
    output: string;
    success: boolean;
  } | null>(null);

  const handleCopyItem = (item: FileItem) => {
    if (!selectedHost) return;
    const clip = {
      sourceHostId: selectedHost.id,
      sourceHostName: selectedHost.name,
      sourcePath: item.path,
      name: item.name,
      isDirectory: item.isDirectory,
    };
    setClipboard(clip);
    localStorage.setItem('serverdeck_file_clipboard', JSON.stringify(clip));
  };

  const handleClearClipboard = () => {
    setClipboard(null);
    localStorage.removeItem('serverdeck_file_clipboard');
  };

  const handleDirectPaste = async () => {
    if (!selectedHost || !clipboard) return;
    setTransferring(true);
    try {
      const targetPath = `${currentPath === '/' ? '' : currentPath}/${clipboard.name}`;
      const res = await api.files.directTransfer({
        sourceHostId: clipboard.sourceHostId,
        sourcePath: clipboard.sourcePath,
        targetHostId: selectedHost.id,
        targetPath,
      });

      setTransferResult({
        title: `Прямой перенос: ${clipboard.name} (${clipboard.sourceHostName} → ${selectedHost.name})`,
        output: res.output || res.error || (res.success ? 'Передача завершена успешно.' : 'Ошибка передачи'),
        success: res.success,
      });

      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Ошибка прямого переноса: ${err.message}`);
    } finally {
      setTransferring(false);
    }
  };

  const loadDirectory = async (path: string) => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const res = await api.files.list(selectedHost.id, path);
      setListing(res);
      setCurrentPath(res.currentPath);
    } catch (err: any) {
      alert(`Ошибка открытия директории: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, [selectedHost]);

  const handleOpenEntry = async (item: FileItem) => {
    if (!selectedHost) return;
    if (item.isDirectory) {
      loadDirectory(item.path);
      return;
    }

    if (item.isImage) {
      setViewingImage({ path: item.path, name: item.name });
      return;
    }

    if (item.isAudio) {
      setViewingAudio({ path: item.path, name: item.name });
      return;
    }

    // Otherwise text / config editor
    try {
      const res = await api.files.read(selectedHost.id, item.path);
      const ext = item.extension.toLowerCase();
      let lang = 'plaintext';
      if (['.yml', '.yaml'].includes(ext)) lang = 'yaml';
      else if (['.json'].includes(ext)) lang = 'json';
      else if (['.sh', '.bash'].includes(ext)) lang = 'shell';
      else if (['.conf', '.cfg', '.ini', '.env'].includes(ext)) lang = 'ini';
      else if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) lang = 'typescript';
      else if (['.html', '.htm'].includes(ext)) lang = 'html';
      else if (['.css'].includes(ext)) lang = 'css';
      else if (['.py'].includes(ext)) lang = 'python';
      else if (['.md'].includes(ext)) lang = 'markdown';
      else if (['.dockerfile'].includes(ext) || item.name.toLowerCase() === 'dockerfile') lang = 'dockerfile';

      setEditingFile({ path: res.path, content: res.content, language: lang });
    } catch (err: any) {
      alert(`Ошибка чтения файла: ${err.message}`);
    }
  };

  const handleSaveEditor = async () => {
    if (!selectedHost || !editingFile) return;
    setEditorSaving(true);
    try {
      await api.files.write(selectedHost.id, editingFile.path, editingFile.content);
      setEditorSaved(true);
      setTimeout(() => setEditorSaved(false), 2000);
    } catch (err: any) {
      alert(`Ошибка сохранения: ${err.message}`);
    } finally {
      setEditorSaving(false);
    }
  };

  const handleDelete = async (item: FileItem) => {
    if (!selectedHost) return;
    if (!confirm(`Удалить ${item.isDirectory ? 'папку' : 'файл'} "${item.name}"?`)) return;

    try {
      await api.files.delete(selectedHost.id, item.path);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Ошибка удаления: ${err.message}`);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || !createName.trim()) return;

    const fullPath = `${currentPath === '/' ? '' : currentPath}/${createName.trim()}`;
    try {
      if (createModal === 'folder') {
        await api.files.createFolder(selectedHost.id, fullPath);
      } else {
        await api.files.createFile(selectedHost.id, fullPath);
      }
      setCreateModal(null);
      setCreateName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Ошибка создания: ${err.message}`);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedHost || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    try {
      await api.files.upload(selectedHost.id, currentPath, file);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Ошибка загрузки: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-slate-400">
        Выберите сервер в верхнем меню для работы с файлами
      </div>
    );
  }

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Файловый менеджер</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            SFTP проводник и встроенный редактор на {selectedHost.name}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700 text-xs font-medium text-slate-300 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Загрузить</span>
          </button>

          <button
            onClick={() => {
              setCreateName('');
              setCreateModal('file');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700 text-xs font-medium text-slate-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Новый файл</span>
          </button>

          <button
            onClick={() => {
              setCreateName('');
              setCreateModal('folder');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700 text-xs font-medium text-slate-300 transition-colors"
          >
            <Folder className="w-3.5 h-3.5 text-amber-400" />
            <span>Новая папка</span>
          </button>

          <button
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            className="p-2 rounded-xl bg-deck-850 hover:bg-deck-800 border border-deck-700 text-slate-300 transition-colors"
            title="Обновить"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Jump Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-500 text-[11px] font-medium shrink-0">Быстрый переход:</span>
        {['/opt', '/etc', '/home', '/var/log', '/root'].map((p) => (
          <button
            key={p}
            onClick={() => loadDirectory(p)}
            className="px-2.5 py-1 rounded-lg bg-deck-900 border border-deck-800 hover:border-deck-700 text-slate-300 font-mono text-[11px] shrink-0 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Breadcrumb Path Bar */}
      <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-deck-900 border border-deck-800 text-xs font-mono overflow-x-auto">
        <button
          onClick={() => loadDirectory('/')}
          className="text-blue-400 hover:text-blue-300 font-semibold px-1 py-0.5 rounded hover:bg-deck-800"
        >
          /
        </button>
        {pathParts.map((part, idx) => {
          const partPath = '/' + pathParts.slice(0, idx + 1).join('/');
          const isLast = idx === pathParts.length - 1;

          return (
            <React.Fragment key={partPath}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <button
                onClick={() => loadDirectory(partPath)}
                className={`px-1 py-0.5 rounded truncate max-w-[150px] ${
                  isLast ? 'text-white font-semibold' : 'text-slate-400 hover:text-white hover:bg-deck-800'
                }`}
              >
                {part}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Clipboard Banner for Direct Server-to-Server Transfer */}
      {clipboard && (
        <div className="p-3.5 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs">
            <ClipboardPaste className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <span className="text-slate-400">В буфере ServerDeck: </span>
              <span className="font-semibold text-white">{clipboard.name}</span>
              <span className="text-slate-400"> (с сервера <span className="text-blue-300 font-mono font-medium">{clipboard.sourceHostName}</span>)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={handleDirectPaste}
              disabled={transferring}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{transferring ? 'Передача rsync/scp...' : 'Вставить сюда напрямую'}</span>
            </button>
            <button
              onClick={handleClearClipboard}
              className="px-2.5 py-1.5 rounded-xl bg-deck-850 hover:bg-deck-800 text-slate-400 hover:text-white text-xs transition-colors"
            >
              Очистить
            </button>
          </div>
        </div>
      )}

      {/* Directory Contents Table */}
      <div className="rounded-2xl bg-deck-900 border border-deck-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-deck-850/60 text-slate-400 font-semibold border-b border-deck-800 select-none">
              <tr>
                <th className="py-2.5 px-4">Имя</th>
                <th className="py-2.5 px-3 w-28">Размер</th>
                <th className="py-2.5 px-3 w-32 hidden sm:table-cell">Права</th>
                <th className="py-2.5 px-3 w-40 hidden md:table-cell">Изменен</th>
                <th className="py-2.5 px-4 w-28 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-deck-800/60">
              {/* Up directory row */}
              {listing?.parentPath && (
                <tr
                  onClick={() => loadDirectory(listing.parentPath!)}
                  className="hover:bg-deck-850/40 cursor-pointer transition-colors"
                >
                  <td colSpan={5} className="py-2.5 px-4 flex items-center gap-2.5 text-slate-400 font-medium">
                    <ArrowUp className="w-4 h-4 text-blue-400" />
                    <span>.. (На уровень выше)</span>
                  </td>
                </tr>
              )}

              {listing?.items.map((item) => {
                let ItemIcon = File;
                let iconColor = 'text-slate-400';

                if (item.isDirectory) {
                  ItemIcon = Folder;
                  iconColor = 'text-amber-400';
                } else if (item.isImage) {
                  ItemIcon = ImageIcon;
                  iconColor = 'text-emerald-400';
                } else if (item.isAudio) {
                  ItemIcon = Music;
                  iconColor = 'text-purple-400';
                } else if (item.isText) {
                  ItemIcon = FileText;
                  iconColor = 'text-blue-400';
                }

                return (
                  <tr
                    key={item.path}
                    className="hover:bg-deck-850/50 transition-colors group cursor-pointer"
                    onClick={() => handleOpenEntry(item)}
                  >
                    <td className="py-2.5 px-4 font-medium text-slate-200">
                      <div className="flex items-center gap-2.5">
                        <ItemIcon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                        <span className="truncate max-w-xs sm:max-w-md group-hover:text-blue-400 transition-colors">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {item.isDirectory ? '-' : formatBytes(item.size)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 hidden sm:table-cell">
                      {item.permissions}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 hidden md:table-cell">
                      {new Date(item.lastModified).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleCopyItem(item)}
                          className="p-1 rounded text-slate-400 hover:text-blue-400 transition-colors"
                          title="Скопировать для переноса на другой сервер"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {!item.isDirectory && (
                          <a
                            href={api.files.getStreamUrl(selectedHost.id, item.path, true)}
                            download
                            className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                            title="Скачать файл"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monaco Editor Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-6xl bg-deck-900 border border-deck-700 rounded-2xl shadow-2xl flex flex-col h-[92vh] overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-deck-800 bg-deck-900">
              <div className="truncate flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-mono text-xs sm:text-sm font-semibold text-white truncate">
                  {editingFile.path}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-deck-850 rounded text-slate-400">
                  {editingFile.language}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveEditor}
                  disabled={editorSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
                >
                  {editorSaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{editorSaved ? 'Сохранено' : editorSaving ? 'Сохранение...' : 'Сохранить (Ctrl+S)'}</span>
                </button>
                <button
                  onClick={() => setEditingFile(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-deck-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Monaco Editor Container */}
            <div
              className="flex-1 w-full bg-[#1e1e1e]"
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  e.preventDefault();
                  handleSaveEditor();
                }
              }}
            >
              <Editor
                height="100%"
                language={editingFile.language}
                theme="vs-dark"
                value={editingFile.content}
                onChange={(val) => setEditingFile((prev) => prev ? { ...prev, content: val || '' } : null)}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div className="max-w-4xl max-h-[90vh] bg-deck-900 border border-deck-700 rounded-2xl shadow-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-deck-800 mb-3">
              <span className="text-xs font-mono text-slate-300 truncate">{viewingImage.name}</span>
              <button
                onClick={() => setViewingImage(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-auto p-2">
              <img
                src={api.files.getStreamUrl(selectedHost.id, viewingImage.path)}
                alt={viewingImage.name}
                className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* Audio Player Modal */}
      {viewingAudio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-deck-900 border border-deck-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-deck-800 mb-4">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-semibold text-white truncate">{viewingAudio.name}</span>
              </div>
              <button
                onClick={() => setViewingAudio(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-2">
              <audio
                controls
                autoPlay
                className="w-full"
                src={api.files.getStreamUrl(selectedHost.id, viewingAudio.path)}
              >
                Ваш браузер не поддерживает элемент аудио.
              </audio>
            </div>
          </div>
        </div>
      )}

      {/* Create File / Folder Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-deck-900 border border-deck-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-1">
              {createModal === 'folder' ? 'Создать папку' : 'Создать файл'}
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono truncate">Путь: {currentPath}</p>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={createModal === 'folder' ? 'имя_папки' : 'config.yml'}
                autoFocus
                required
                className="w-full bg-deck-850 border border-deck-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModal(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-deck-850 text-slate-300 text-xs font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-500"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Server Transfer Result Modal */}
      {transferResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-deck-900 border border-deck-700 rounded-2xl shadow-2xl p-5 relative flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-deck-800 mb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-white text-sm sm:text-base truncate">{transferResult.title}</h3>
              </div>
              <button
                onClick={() => setTransferResult(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="flex-1 overflow-auto bg-black/90 p-4 rounded-xl font-mono text-xs text-emerald-400 whitespace-pre-wrap break-all leading-relaxed select-text mb-3">
              {transferResult.output}
            </pre>

            <div className="flex justify-end">
              <button
                onClick={() => setTransferResult(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
