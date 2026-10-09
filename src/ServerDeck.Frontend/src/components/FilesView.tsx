import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Music,
  File,
  ChevronRight,
  ArrowUp,
  Download,
  Trash2,
  Plus,
  Upload,
  RefreshCw,
  Save,
  X,
  Check,
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
        targetPath: targetPath,
      });

      setTransferResult({
        title: `Direct Transfer: ${clipboard.name}`,
        output: res.output || res.error || (res.success ? 'File transferred successfully across hosts!' : 'Transfer failed.'),
        success: res.success,
      });

      loadDirectory(currentPath);
    } catch (err: any) {
      setTransferResult({
        title: `Transfer Error: ${clipboard.name}`,
        output: err.message,
        success: false,
      });
    } finally {
      setTransferring(false);
    }
  };

  const loadDirectory = async (path: string) => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const data = await api.files.list(selectedHost.id, path);
      setListing(data);
      setCurrentPath(data.currentPath);
    } catch (err: any) {
      alert(`Failed to read directory: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedHost) {
      loadDirectory(initialPath);
    }
  }, [selectedHost, initialPath]);

  const handleOpenEntry = async (item: FileItem) => {
    if (!selectedHost) return;

    if (item.isDirectory) {
      loadDirectory(item.path);
    } else if (item.isImage) {
      setViewingImage({ path: item.path, name: item.name });
    } else if (item.isAudio) {
      setViewingAudio({ path: item.path, name: item.name });
    } else {
      // Open in text editor
      try {
        const fileData = await api.files.read(selectedHost.id, item.path);
        const text = fileData.content;
        let lang = 'plaintext';
        const ext = item.extension.toLowerCase();
        if (['.json', '.jsonc'].includes(ext)) lang = 'json';
        else if (['.yaml', '.yml'].includes(ext)) lang = 'yaml';
        else if (['.sh', '.bash', '.zsh'].includes(ext)) lang = 'shell';
        else if (['.js', '.mjs', '.cjs'].includes(ext)) lang = 'javascript';
        else if (['.ts', '.tsx'].includes(ext)) lang = 'typescript';
        else if (['.html', '.htm'].includes(ext)) lang = 'html';
        else if (['.css', '.scss', '.less'].includes(ext)) lang = 'css';
        else if (['.md', '.markdown'].includes(ext)) lang = 'markdown';
        else if (['.py'].includes(ext)) lang = 'python';
        else if (['.conf', '.ini', '.env'].includes(ext)) lang = 'ini';
        else if (['.xml', '.svg'].includes(ext)) lang = 'xml';
        else if (['.sql'].includes(ext)) lang = 'sql';
        else if (['.dockerfile', 'dockerfile'].includes(item.name.toLowerCase())) lang = 'dockerfile';

        setEditingFile({ path: item.path, content: text, language: lang });
        setEditorSaved(false);
      } catch (err: any) {
        alert(`Failed to open file: ${err.message}`);
      }
    }
  };

  const handleSaveEditor = async () => {
    if (!selectedHost || !editingFile) return;
    setEditorSaving(true);
    try {
      await api.files.write(selectedHost.id, editingFile.path, editingFile.content);
      setEditorSaved(true);
      setTimeout(() => setEditorSaved(false), 2000);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Failed to save file: ${err.message}`);
    } finally {
      setEditorSaving(false);
    }
  };

  const handleDelete = async (item: FileItem) => {
    if (!selectedHost) return;
    const msg = item.isDirectory
      ? `Delete directory "${item.name}" and all its contents?`
      : `Delete file "${item.name}"?`;

    if (!confirm(msg)) return;

    try {
      await api.files.delete(selectedHost.id, item.path);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedHost || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const targetPath = `${currentPath === '/' ? '' : currentPath}/${file.name}`;

    try {
      await api.files.upload(selectedHost.id, targetPath, file);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || !createName.trim() || !createModal) return;

    const targetPath = `${currentPath === '/' ? '' : currentPath}/${createName.trim()}`;

    try {
      if (createModal === 'folder') {
        await api.files.createFolder(selectedHost.id, targetPath);
      } else {
        await api.files.createFile(selectedHost.id, targetPath);
      }
      setCreateModal(null);
      setCreateName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Creation failed: ${err.message}`);
    }
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-carbon-400 font-mono">
        Select a host from the top navigation to browse files
      </div>
    );
  }

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-carbon-700/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">File Manager</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dorito-500/10 border border-dorito-500/30 text-dorito-400 font-semibold">
              SFTP EXPLORER
            </span>
          </div>
          <p className="text-xs sm:text-sm text-carbon-400 mt-0.5 font-mono">
            File manager and embedded code editor on {selectedHost.name}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 font-mono">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-dorito-400 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-dorito-500" />
            <span>Upload</span>
          </button>

          <button
            onClick={() => {
              setCreateName('');
              setCreateModal('file');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-emerald-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>New File</span>
          </button>

          <button
            onClick={() => {
              setCreateName('');
              setCreateModal('folder');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-amber-400 transition-colors"
          >
            <Folder className="w-3.5 h-3.5 text-amber-400" />
            <span>New Folder</span>
          </button>

          <button
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            className="p-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-carbon-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-dorito-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Jump Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-carbon-400 text-[11px] font-mono shrink-0">Quick Jump:</span>
        {['/opt', '/etc', '/home', '/var/log', '/root'].map((p) => (
          <button
            key={p}
            onClick={() => loadDirectory(p)}
            className="px-2.5 py-1 rounded bg-carbon-900 border border-carbon-700 hover:border-dorito-500/50 text-carbon-300 font-mono text-[11px] shrink-0 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Breadcrumb Path Bar */}
      <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-carbon-900 border border-carbon-700 text-xs font-mono overflow-x-auto">
        <button
          onClick={() => loadDirectory('/')}
          className="text-dorito-400 hover:text-dorito-300 font-bold px-1.5 py-0.5 rounded hover:bg-carbon-800"
        >
          /
        </button>
        {pathParts.map((part, idx) => {
          const partPath = '/' + pathParts.slice(0, idx + 1).join('/');
          const isLast = idx === pathParts.length - 1;

          return (
            <React.Fragment key={partPath}>
              <ChevronRight className="w-3.5 h-3.5 text-carbon-500 shrink-0" />
              <button
                onClick={() => loadDirectory(partPath)}
                className={`px-1.5 py-0.5 rounded truncate max-w-[150px] ${
                  isLast
                    ? 'text-white font-bold bg-carbon-850 border border-carbon-700'
                    : 'text-carbon-400 hover:text-white hover:bg-carbon-800'
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
        <div className="p-3.5 rounded-xl bg-dorito-500/10 border border-dorito-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs">
            <ClipboardPaste className="w-4 h-4 text-dorito-500 shrink-0" />
            <div>
              <span className="text-carbon-300 font-mono">In NijiPanel Clipboard: </span>
              <span className="font-bold text-white font-mono">{clipboard.name}</span>
              <span className="text-carbon-400 font-mono">
                {' '}(from host <span className="text-dorito-400 font-medium">{clipboard.sourceHostName}</span>)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 font-mono">
            <button
              onClick={handleDirectPaste}
              disabled={transferring}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shadow-md shadow-dorito-500/20 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{transferring ? 'Transferring via rsync/scp...' : 'Paste Here Directly'}</span>
            </button>
            <button
              onClick={handleClearClipboard}
              className="px-2.5 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-400 hover:text-white text-xs transition-colors border border-carbon-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Directory Contents Table: IBM Carbon Style */}
      <div className="rounded-xl bg-carbon-900 border border-carbon-700 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-carbon-850 text-carbon-300 font-bold border-b border-carbon-700 select-none">
              <tr>
                <th className="py-2.5 px-4">Name</th>
                <th className="py-2.5 px-3 w-28">Size</th>
                <th className="py-2.5 px-3 w-32 hidden sm:table-cell">Permissions</th>
                <th className="py-2.5 px-3 w-40 hidden md:table-cell">Modified</th>
                <th className="py-2.5 px-4 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-800">
              {/* Up directory row */}
              {listing?.parentPath && (
                <tr
                  onClick={() => loadDirectory(listing.parentPath!)}
                  className="hover:bg-carbon-850/60 cursor-pointer transition-colors"
                >
                  <td colSpan={5} className="py-2.5 px-4 flex items-center gap-2.5 text-carbon-400 font-medium">
                    <ArrowUp className="w-4 h-4 text-dorito-500" />
                    <span>.. (Parent Directory)</span>
                  </td>
                </tr>
              )}

              {listing?.items.map((item) => {
                let ItemIcon = File;
                let iconColor = 'text-carbon-400';

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
                  iconColor = 'text-dorito-400';
                }

                return (
                  <tr
                    key={item.path}
                    className="hover:bg-carbon-850/60 transition-colors group cursor-pointer"
                    onClick={() => handleOpenEntry(item)}
                  >
                    <td className="py-2.5 px-4 font-medium text-carbon-100">
                      <div className="flex items-center gap-2.5">
                        <ItemIcon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                        <span className="truncate max-w-xs sm:max-w-md group-hover:text-dorito-400 transition-colors">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-carbon-400">
                      {item.isDirectory ? '-' : formatBytes(item.size)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-carbon-500 hidden sm:table-cell">
                      {item.permissions}
                    </td>
                    <td className="py-2.5 px-3 text-carbon-400 hidden md:table-cell">
                      {new Date(item.lastModified).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleCopyItem(item)}
                          className="p-1 rounded text-carbon-400 hover:text-dorito-400 transition-colors"
                          title="Copy to clipboard for cross-server transfer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {!item.isDirectory && (
                          <a
                            href={api.files.getStreamUrl(selectedHost.id, item.path, true)}
                            download
                            className="p-1 rounded text-carbon-400 hover:text-white transition-colors"
                            title="Download file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1 rounded text-carbon-400 hover:text-rose-400 transition-colors"
                          title="Delete"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-6xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl flex flex-col h-[92vh] overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-carbon-700 bg-carbon-900">
              <div className="truncate flex items-center gap-2">
                <FileText className="w-4 h-4 text-dorito-500 shrink-0" />
                <span className="font-mono text-xs sm:text-sm font-semibold text-white truncate">
                  {editingFile.path}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-carbon-850 rounded border border-carbon-700 text-dorito-400">
                  {editingFile.language}
                </span>
              </div>

              <div className="flex items-center gap-2 font-mono">
                <button
                  onClick={handleSaveEditor}
                  disabled={editorSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shadow-md shadow-dorito-500/20 transition-all disabled:opacity-50"
                >
                  {editorSaved ? <Check className="w-3.5 h-3.5 text-emerald-950" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{editorSaved ? 'Saved' : editorSaving ? 'Saving...' : 'Save (Ctrl+S)'}</span>
                </button>
                <button
                  onClick={() => setEditingFile(null)}
                  className="p-1.5 rounded-lg text-carbon-400 hover:text-white hover:bg-carbon-800 transition-colors"
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
          <div className="max-w-4xl max-h-[90vh] bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-3">
              <span className="text-xs font-mono text-dorito-300 truncate">{viewingImage.name}</span>
              <button
                onClick={() => setViewingImage(null)}
                className="p-1 text-carbon-400 hover:text-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-dorito-500" />
                <span className="text-sm font-semibold text-white truncate font-mono">{viewingAudio.name}</span>
              </div>
              <button
                onClick={() => setViewingAudio(null)}
                className="p-1 text-carbon-400 hover:text-white"
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
                Your browser does not support the audio element.
              </audio>
            </div>
          </div>
        </div>
      )}

      {/* Create File / Folder Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-carbon-900 border border-carbon-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="font-bold text-white text-base mb-1 font-sans">
              {createModal === 'folder' ? 'Create Folder' : 'Create File'}
            </h3>
            <p className="text-xs text-carbon-400 mb-4 font-mono truncate">Path: {currentPath}</p>

            <form onSubmit={handleCreateSubmit} className="space-y-3 font-mono">
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={createModal === 'folder' ? 'folder_name' : 'config.yml'}
                autoFocus
                required
                className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dorito-500 font-mono"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModal(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-carbon-850 text-carbon-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-dorito-500 text-carbon-950 font-bold text-xs hover:bg-dorito-600 shadow-md shadow-dorito-500/20"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Server Transfer Result Modal */}
      {transferResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-5 relative flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-dorito-500" />
                <h3 className="font-bold text-white text-sm sm:text-base truncate font-sans">{transferResult.title}</h3>
              </div>
              <button
                onClick={() => setTransferResult(null)}
                className="p-1 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="flex-1 overflow-auto bg-black/90 p-4 rounded-xl font-mono text-xs text-dorito-200 whitespace-pre-wrap break-all leading-relaxed select-text mb-3 border border-carbon-700">
              {transferResult.output}
            </pre>

            <div className="flex justify-end font-mono">
              <button
                onClick={() => setTransferResult(null)}
                className="px-4 py-2 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs"
              >
                Close
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
