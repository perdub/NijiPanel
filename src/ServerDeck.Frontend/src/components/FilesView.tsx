import React, { useState, useEffect, useRef } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
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
  Send,
  Share2,
  Link as LinkIcon,
  PieChart,
  Archive,
  FolderArchive,
  GitCompare,
  Lock,
  Clock,
  ExternalLink,
  HardDrive,
  CheckSquare,
  Square,
  Search,
  Eye,
  FolderOpen
} from 'lucide-react';
import { Host, DirectoryListing, FileItem, SharedFile, DiskUsageResult, DiskUsageItem } from '../types';
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

  // Checkbox Selection for Multi-file Actions (Compress, etc.)
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Monaco Editor & Diff Viewer Modal
  const [editingFile, setEditingFile] = useState<{
    path: string;
    content: string;
    originalContent: string;
    language: string;
  } | null>(null);
  const [diffMode, setDiffMode] = useState(false);
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

  // Task 1: File Share Links State
  const [shareTargetItem, setShareTargetItem] = useState<FileItem | null>(null);
  const [shareTtlHours, setShareTtlHours] = useState<number | null>(24); // default 24 hours
  const [shareMaxDownloads, setShareMaxDownloads] = useState<number | null>(null); // default Unlimited
  const [sharePassword, setSharePassword] = useState('');
  const [shareCreating, setShareCreating] = useState(false);
  const [createdShare, setCreatedShare] = useState<SharedFile | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Shared Links Manager State
  const [showSharesManager, setShowSharesManager] = useState(false);
  const [sharesList, setSharesList] = useState<SharedFile[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [copiedManagerToken, setCopiedManagerToken] = useState<string | null>(null);

  // Task 2: Smart Disk Treemap State
  const [showDiskUsage, setShowDiskUsage] = useState(false);
  const [diskUsagePath, setDiskUsagePath] = useState('/');
  const [diskUsageExclude, setDiskUsageExclude] = useState('/proc,/sys,/mnt,/dev');
  const [diskUsageLoading, setDiskUsageLoading] = useState(false);
  const [diskUsageData, setDiskUsageData] = useState<DiskUsageResult | null>(null);
  const [diskUsageError, setDiskUsageError] = useState<string | null>(null);

  // Task 3: Archiver (Compress & Extract) State
  const [showCompressModal, setShowCompressModal] = useState(false);
  const [archiveFormat, setArchiveFormat] = useState<'zip' | 'tar.gz'>('zip');
  const [archiveName, setArchiveName] = useState('');
  const [compressing, setCompressing] = useState(false);

  const [extractTargetItem, setExtractTargetItem] = useState<FileItem | null>(null);
  const [extractDestPath, setExtractDestPath] = useState('');
  const [extracting, setExtracting] = useState(false);

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
    setSelectedItems([]);
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

  // Checkbox toggle handlers
  const toggleSelectItem = (name: string) => {
    setSelectedItems((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  };

  const toggleSelectAll = () => {
    if (!listing) return;
    if (selectedItems.length === listing.items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(listing.items.map((i) => i.name));
    }
  };

  const isArchiveFile = (fileName: string) => {
    const l = fileName.toLowerCase();
    return l.endsWith('.zip') || l.endsWith('.tar.gz') || l.endsWith('.tgz') || l.endsWith('.tar') || l.endsWith('.tar.bz2');
  };

  const handleOpenEntry = async (item: FileItem) => {
    if (!selectedHost) return;

    if (item.isDirectory) {
      loadDirectory(item.path);
    } else if (item.isImage) {
      setViewingImage({ path: item.path, name: item.name });
    } else if (item.isAudio) {
      setViewingAudio({ path: item.path, name: item.name });
    } else {
      // Open in Monaco Editor
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

        setEditingFile({
          path: item.path,
          content: text,
          originalContent: text,
          language: lang,
        });
        setDiffMode(false);
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
      setEditingFile((prev) => (prev ? { ...prev, originalContent: prev.content } : null));
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

  // --- Task 1: Share Handlers ---
  const handleOpenShareModal = (item: FileItem) => {
    setShareTargetItem(item);
    setShareTtlHours(24);
    setShareMaxDownloads(null);
    setSharePassword('');
    setCreatedShare(null);
    setCopiedShareLink(false);
  };

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || !shareTargetItem) return;
    setShareCreating(true);
    try {
      const res = await api.share.create({
        hostId: selectedHost.id,
        filePath: shareTargetItem.path,
        expireHours: shareTtlHours,
        maxDownloads: shareMaxDownloads,
        password: sharePassword.trim() || undefined,
      });
      setCreatedShare(res);
    } catch (err: any) {
      alert(`Failed to create share link: ${err.message}`);
    } finally {
      setShareCreating(false);
    }
  };

  const handleCopyShareLink = (token: string) => {
    const fullUrl = `${window.location.origin}/d/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2500);
  };

  const handleOpenSharesManager = async () => {
    if (!selectedHost) return;
    setShowSharesManager(true);
    setSharesLoading(true);
    try {
      const data = await api.share.listByHost(selectedHost.id);
      setSharesList(data);
    } catch (err: any) {
      alert(`Failed to load shared links: ${err.message}`);
    } finally {
      setSharesLoading(false);
    }
  };

  const handleRevokeShare = async (token: string) => {
    if (!confirm('Are you sure you want to revoke this download link?')) return;
    setRevokingToken(token);
    try {
      await api.share.revoke(token);
      setSharesList((prev) => prev.filter((s) => s.token !== token));
    } catch (err: any) {
      alert(`Failed to revoke share link: ${err.message}`);
    } finally {
      setRevokingToken(null);
    }
  };

  // --- Task 2: Disk Usage Handlers ---
  const handleOpenDiskUsage = async () => {
    setShowDiskUsage(true);
    const startPath = currentPath || '/';
    setDiskUsagePath(startPath);
    runDiskUsageScan(startPath, diskUsageExclude);
  };

  const runDiskUsageScan = async (path: string, exclude: string) => {
    if (!selectedHost) return;
    setDiskUsageLoading(true);
    setDiskUsageError(null);
    try {
      const res = await api.files.diskUsage(selectedHost.id, path, exclude, 1);
      setDiskUsageData(res);
      setDiskUsagePath(res.path);
    } catch (err: any) {
      setDiskUsageError(err.message || 'Failed to scan disk usage.');
      setDiskUsageData(null);
    } finally {
      setDiskUsageLoading(false);
    }
  };

  // --- Task 3: Archiver Handlers ---
  const handleOpenCompress = () => {
    if (selectedItems.length === 0) return;
    const defaultBase = selectedItems[0].replace(/\.[^/.]+$/, '') || 'archive';
    setArchiveName(`${defaultBase}`);
    setArchiveFormat('zip');
    setShowCompressModal(true);
  };

  const handleExecuteArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || selectedItems.length === 0) return;
    setCompressing(true);
    try {
      const formattedName = archiveName.trim().endsWith(`.${archiveFormat}`)
        ? archiveName.trim()
        : `${archiveName.trim()}.${archiveFormat}`;

      await api.files.archive(selectedHost.id, {
        path: currentPath,
        items: selectedItems,
        format: archiveFormat,
        archiveName: formattedName,
      });
      setShowCompressModal(false);
      setSelectedItems([]);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Archiving failed: ${err.message}`);
    } finally {
      setCompressing(false);
    }
  };

  const handleOpenExtract = (item: FileItem) => {
    setExtractTargetItem(item);
    setExtractDestPath(currentPath);
  };

  const handleExecuteExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost || !extractTargetItem) return;
    setExtracting(true);
    try {
      await api.files.extract(selectedHost.id, {
        archivePath: extractTargetItem.path,
        destinationPath: extractDestPath.trim() || currentPath,
      });
      setExtractTargetItem(null);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Extraction failed: ${err.message}`);
    } finally {
      setExtracting(false);
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

  const TREEMAP_PALETTE = [
    { bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25', bar: 'bg-emerald-500' },
    { bg: 'bg-dorito-500/15 border-dorito-500/40 text-dorito-300 hover:bg-dorito-500/25', bar: 'bg-dorito-500' },
    { bg: 'bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25', bar: 'bg-sky-500' },
    { bg: 'bg-purple-500/15 border-purple-500/40 text-purple-300 hover:bg-purple-500/25', bar: 'bg-purple-500' },
    { bg: 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25', bar: 'bg-amber-500' },
    { bg: 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25', bar: 'bg-rose-500' },
    { bg: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25', bar: 'bg-indigo-500' },
    { bg: 'bg-teal-500/15 border-teal-500/40 text-teal-300 hover:bg-teal-500/25', bar: 'bg-teal-500' },
  ];

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
            File manager, archive tool, and embedded code editor on {selectedHost.name}
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

          {/* Disk Usage Button */}
          <button
            onClick={handleOpenDiskUsage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-sky-400 transition-colors"
            title="Analyze folder disk usage breakdown"
          >
            <PieChart className="w-3.5 h-3.5 text-sky-400" />
            <span>Disk Usage</span>
          </button>

          {/* Shared Links Manager Button */}
          <button
            onClick={handleOpenSharesManager}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs font-medium text-carbon-200 hover:text-dorito-400 transition-colors"
            title="Manage public download links"
          >
            <LinkIcon className="w-3.5 h-3.5 text-dorito-400" />
            <span>Shared Links</span>
          </button>

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

      {/* Batch Selection Action Bar (Compress, Clear) */}
      {selectedItems.length > 0 && (
        <div className="p-2.5 px-4 rounded-xl bg-carbon-850 border border-dorito-500/40 flex items-center justify-between gap-3 shadow-lg font-mono text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-dorito-400" />
            <span className="font-semibold text-white">
              {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCompress}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold transition-all shadow-md shadow-dorito-500/20"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Compress</span>
            </button>
            <button
              onClick={() => setSelectedItems([])}
              className="px-2.5 py-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-carbon-300 hover:text-white border border-carbon-700 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

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
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={listing?.items && listing.items.length > 0 && selectedItems.length === listing.items.length}
                    onChange={toggleSelectAll}
                    className="rounded bg-carbon-800 border-carbon-600 text-dorito-500 focus:ring-dorito-500 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-4">Name</th>
                <th className="py-2.5 px-3 w-28">Size</th>
                <th className="py-2.5 px-3 w-32 hidden sm:table-cell">Permissions</th>
                <th className="py-2.5 px-3 w-40 hidden md:table-cell">Modified</th>
                <th className="py-2.5 px-4 w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-800">
              {/* Up directory row */}
              {listing?.parentPath && (
                <tr
                  onClick={() => loadDirectory(listing.parentPath!)}
                  className="hover:bg-carbon-850/60 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 px-3 text-center"></td>
                  <td colSpan={5} className="py-2.5 px-4 flex items-center gap-2.5 text-carbon-400 font-medium">
                    <ArrowUp className="w-4 h-4 text-dorito-500" />
                    <span>.. (Parent Directory)</span>
                  </td>
                </tr>
              )}

              {listing?.items.map((item) => {
                let ItemIcon = File;
                let iconColor = 'text-carbon-400';
                const isArchive = isArchiveFile(item.name);

                if (item.isDirectory) {
                  ItemIcon = Folder;
                  iconColor = 'text-amber-400';
                } else if (isArchive) {
                  ItemIcon = FolderArchive;
                  iconColor = 'text-dorito-400';
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

                const isSelected = selectedItems.includes(item.name);

                return (
                  <tr
                    key={item.path}
                    className={`transition-colors group cursor-pointer ${
                      isSelected ? 'bg-dorito-500/10' : 'hover:bg-carbon-850/60'
                    }`}
                    onClick={() => handleOpenEntry(item)}
                  >
                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.name)}
                        className="rounded bg-carbon-800 border-carbon-600 text-dorito-500 focus:ring-dorito-500 cursor-pointer"
                      />
                    </td>
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
                        {/* Extract action for archive files */}
                        {isArchive && (
                          <button
                            onClick={() => handleOpenExtract(item)}
                            className="p-1 rounded text-carbon-400 hover:text-amber-400 transition-colors"
                            title="Extract archive"
                          >
                            <FolderArchive className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Public Share Link button */}
                        {!item.isDirectory && (
                          <button
                            onClick={() => handleOpenShareModal(item)}
                            className="p-1 rounded text-carbon-400 hover:text-dorito-400 transition-colors"
                            title="Share public download link"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}

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

      {/* Task 4: Monaco Editor & Diff Viewer Modal */}
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
                {editingFile.content !== editingFile.originalContent && (
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded">
                    Modified
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 font-mono">
                {/* Diff View Toggle Button */}
                <button
                  onClick={() => setDiffMode(!diffMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-all ${
                    diffMode
                      ? 'bg-dorito-500/20 text-dorito-400 border-dorito-500/50'
                      : 'bg-carbon-850 text-carbon-300 border-carbon-700 hover:text-white'
                  }`}
                  title="Compare modifications with original file content"
                >
                  <GitCompare className="w-3.5 h-3.5 text-dorito-400" />
                  <span>{diffMode ? 'Edit Mode' : 'Diff View'}</span>
                </button>

                <button
                  onClick={handleSaveEditor}
                  disabled={editorSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shadow-md shadow-dorito-500/20 transition-all disabled:opacity-50"
                >
                  {editorSaved ? <Check className="w-3.5 h-3.5 text-emerald-950" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{editorSaved ? 'Saved' : editorSaving ? 'Saving...' : 'Save (Ctrl+S)'}</span>
                </button>
                <button
                  onClick={() => {
                    setEditingFile(null);
                    setDiffMode(false);
                  }}
                  className="p-1.5 rounded-lg text-carbon-400 hover:text-white hover:bg-carbon-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Monaco Editor or Diff Viewer Container */}
            <div
              className="flex-1 w-full bg-[#1e1e1e]"
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  e.preventDefault();
                  handleSaveEditor();
                }
              }}
            >
              {diffMode ? (
                <DiffEditor
                  height="100%"
                  language={editingFile.language}
                  theme="vs-dark"
                  original={editingFile.originalContent}
                  modified={editingFile.content}
                  onMount={(editor) => {
                    const modifiedEditor = editor.getModifiedEditor();
                    modifiedEditor.onDidChangeModelContent(() => {
                      const val = modifiedEditor.getValue();
                      setEditingFile((prev) => (prev ? { ...prev, content: val } : null));
                    });
                  }}
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    renderSideBySide: true,
                    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                  }}
                />
              ) : (
                <Editor
                  height="100%"
                  language={editingFile.language}
                  theme="vs-dark"
                  value={editingFile.content}
                  onChange={(val) =>
                    setEditingFile((prev) => (prev ? { ...prev, content: val || '' } : null))
                  }
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    tabSize: 2,
                    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task 1: Create Public Share Link Modal */}
      {shareTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-mono">
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-5 relative">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-dorito-500" />
                <h3 className="font-bold text-white text-base font-sans">Share Public Download Link</h3>
              </div>
              <button
                onClick={() => setShareTargetItem(null)}
                className="p-1 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!createdShare ? (
              <form onSubmit={handleCreateShareLink} className="space-y-4 text-xs">
                <div>
                  <label className="text-carbon-400 block mb-1">File:</label>
                  <div className="p-2.5 rounded-lg bg-carbon-850 border border-carbon-750 text-white font-semibold truncate">
                    {shareTargetItem.name}
                  </div>
                  <span className="text-[11px] text-carbon-500 truncate block mt-0.5">
                    {shareTargetItem.path}
                  </span>
                </div>

                {/* Expiration TTL Selector */}
                <div>
                  <label className="text-carbon-300 block mb-1.5 font-semibold">
                    Link Expiration (TTL):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '1 Hour', value: 1 },
                      { label: '24 Hours', value: 24 },
                      { label: '7 Days', value: 168 },
                      { label: 'Permanent', value: null },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.label}
                        onClick={() => setShareTtlHours(opt.value)}
                        className={`py-2 px-3 rounded-lg border text-xs font-mono font-medium transition-colors ${
                          shareTtlHours === opt.value
                            ? 'bg-dorito-500/20 border-dorito-500 text-dorito-400'
                            : 'bg-carbon-850 border-carbon-700 text-carbon-300 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Download Limit Selector */}
                <div>
                  <label className="text-carbon-300 block mb-1.5 font-semibold">
                    Download Limit:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '1 (Burn after reading)', value: 1 },
                      { label: '5 Downloads', value: 5 },
                      { label: '10 Downloads', value: 10 },
                      { label: 'Unlimited', value: null },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.label}
                        onClick={() => setShareMaxDownloads(opt.value)}
                        className={`py-2 px-3 rounded-lg border text-xs font-mono font-medium transition-colors ${
                          shareMaxDownloads === opt.value
                            ? 'bg-dorito-500/20 border-dorito-500 text-dorito-400'
                            : 'bg-carbon-850 border-carbon-700 text-carbon-300 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Password */}
                <div>
                  <label className="text-carbon-300 block mb-1.5 font-semibold">
                    Password Protection (Optional):
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-carbon-500 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={sharePassword}
                      onChange={(e) => setSharePassword(e.target.value)}
                      placeholder="Leave empty for public access"
                      className="w-full bg-carbon-850 border border-carbon-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-dorito-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShareTargetItem(null)}
                    className="px-4 py-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-300 text-xs font-medium border border-carbon-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={shareCreating}
                    className="px-4 py-2 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shadow-md shadow-dorito-500/20 disabled:opacity-50"
                  >
                    {shareCreating ? 'Generating...' : 'Generate Share Link'}
                  </button>
                </div>
              </form>
            ) : (
              /* Success display of generated link */
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Public share link generated successfully!</span>
                </div>

                <div>
                  <label className="text-carbon-400 block mb-1">Direct Download URL:</label>
                  <div className="flex items-center gap-2 bg-carbon-850 border border-carbon-700 rounded-lg p-2.5">
                    <span className="text-dorito-300 truncate flex-1 font-mono text-[11px]">
                      {window.location.origin}/d/{createdShare.token}
                    </span>
                    <button
                      onClick={() => handleCopyShareLink(createdShare.token)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shrink-0 transition-colors"
                    >
                      {copiedShareLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedShareLink ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-carbon-400 bg-carbon-850/60 p-3 rounded-lg border border-carbon-750 text-[11px]">
                  <div>
                    <span className="block text-carbon-500">Expires:</span>
                    <span className="text-carbon-200">
                      {createdShare.expiresAt ? new Date(createdShare.expiresAt).toLocaleString() : 'Permanent'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-carbon-500">Max Downloads:</span>
                    <span className="text-carbon-200">
                      {createdShare.maxDownloads ?? 'Unlimited'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-carbon-500">Password:</span>
                    <span className="text-carbon-200">
                      {createdShare.hasPassword ? 'Protected' : 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-carbon-500">Token:</span>
                    <span className="text-carbon-200 truncate">{createdShare.token}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShareTargetItem(null)}
                    className="px-4 py-2 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-white font-medium text-xs border border-carbon-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task 1: Shared Links Manager Modal */}
      {showSharesManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-mono">
          <div className="w-full max-w-4xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-5 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-dorito-500" />
                <h3 className="font-bold text-white text-base font-sans">
                  Active Shared Links Manager — {selectedHost.name}
                </h3>
              </div>
              <button
                onClick={() => setShowSharesManager(false)}
                className="p-1 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {sharesLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-carbon-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-dorito-500" />
                  <span className="text-xs">Loading shared links...</span>
                </div>
              ) : sharesList.length === 0 ? (
                <div className="py-12 text-center text-carbon-400 text-xs">
                  No active shared links for this host yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {sharesList.map((share) => {
                    const fullUrl = `${window.location.origin}/d/${share.token}`;
                    const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();
                    const isBurned = share.maxDownloads && share.downloadCount >= share.maxDownloads;

                    return (
                      <div
                        key={share.token}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          !share.isActive || isExpired || isBurned
                            ? 'bg-carbon-950/40 border-carbon-800 opacity-60'
                            : 'bg-carbon-850/70 border-carbon-750 hover:border-carbon-650'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white truncate text-xs">{share.fileName}</span>
                            {share.hasPassword && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Protected</span>
                              </span>
                            )}
                            {isExpired && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 border border-rose-500/30 text-rose-400">
                                Expired
                              </span>
                            )}
                            {isBurned && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 border border-orange-500/30 text-orange-400">
                                Limit Reached
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-carbon-400 truncate">{share.filePath}</div>
                          <div className="flex items-center gap-4 text-[10px] text-carbon-500 flex-wrap">
                            <span>Downloads: <b className="text-carbon-300">{share.downloadCount}</b> / {share.maxDownloads ?? '∞'}</span>
                            <span>
                              Expires: {share.expiresAt ? new Date(share.expiresAt).toLocaleString() : 'Permanent'}
                            </span>
                            <span>Created: {new Date(share.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(fullUrl);
                              setCopiedManagerToken(share.token);
                              setTimeout(() => setCopiedManagerToken(null), 2000);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-carbon-200 text-xs border border-carbon-700 transition-colors"
                            title="Copy download URL"
                          >
                            {copiedManagerToken === share.token ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedManagerToken === share.token ? 'Copied' : 'Copy Link'}</span>
                          </button>

                          <button
                            onClick={() => handleRevokeShare(share.token)}
                            disabled={revokingToken === share.token}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs transition-colors disabled:opacity-50"
                            title="Revoke link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-carbon-700 mt-3">
              <button
                onClick={() => setShowSharesManager(false)}
                className="px-4 py-2 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-white font-medium text-xs border border-carbon-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task 2: Smart Disk Treemap Modal */}
      {showDiskUsage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-mono">
          <div className="w-full max-w-5xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-5 flex flex-col h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-base font-sans">
                  Smart Disk Treemap Analyzer — {selectedHost.name}
                </h3>
              </div>
              <button
                onClick={() => setShowDiskUsage(false)}
                className="p-1 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scan Controls Bar */}
            <div className="space-y-3 bg-carbon-850/80 p-3.5 rounded-xl border border-carbon-750 mb-4 text-xs">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-carbon-400 font-semibold shrink-0">Path:</span>
                  <input
                    type="text"
                    value={diskUsagePath}
                    onChange={(e) => setDiskUsagePath(e.target.value)}
                    placeholder="/"
                    className="flex-1 bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-1.5 text-white font-mono focus:outline-none focus:border-dorito-500"
                  />
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-carbon-400 font-semibold shrink-0">Exclude:</span>
                  <input
                    type="text"
                    value={diskUsageExclude}
                    onChange={(e) => setDiskUsageExclude(e.target.value)}
                    placeholder="/proc,/sys,/mnt,/dev"
                    className="flex-1 bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-1.5 text-white font-mono focus:outline-none focus:border-dorito-500"
                  />
                </div>
                <button
                  onClick={() => runDiskUsageScan(diskUsagePath, diskUsageExclude)}
                  disabled={diskUsageLoading}
                  className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-carbon-950 font-bold transition-all shadow-md shadow-sky-500/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${diskUsageLoading ? 'animate-spin' : ''}`} />
                  <span>Scan</span>
                </button>
              </div>

              {/* Quick shortcut paths */}
              <div className="flex items-center gap-2 pt-1 overflow-x-auto text-[11px]">
                <span className="text-carbon-500 shrink-0">Presets:</span>
                {['/', '/var', '/var/log', '/home', '/opt', '/tmp'].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setDiskUsagePath(p);
                      runDiskUsageScan(p, diskUsageExclude);
                    }}
                    className="px-2 py-0.5 rounded bg-carbon-800 hover:bg-carbon-750 text-carbon-300 hover:text-white border border-carbon-700"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Treemap Visualization Container */}
            <div className="flex-1 overflow-auto space-y-4">
              {diskUsageLoading ? (
                <div className="py-24 flex flex-col items-center justify-center text-carbon-400 gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
                  <span className="text-sm font-sans">Scanning folder breakdown using du...</span>
                </div>
              ) : diskUsageError ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {diskUsageError}
                </div>
              ) : diskUsageData ? (
                <div>
                  {/* Summary Header */}
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="text-carbon-400">
                      Directory: <strong className="text-white">{diskUsageData.path}</strong>
                    </span>
                    <span className="text-carbon-400">
                      Total Analyzed: <strong className="text-sky-400 font-bold">{formatBytes(diskUsageData.totalSizeBytes)}</strong> ({diskUsageData.items.length} subfolders)
                    </span>
                  </div>

                  {/* Treemap Colored Blocks */}
                  {diskUsageData.items.length === 0 ? (
                    <div className="p-8 text-center text-carbon-400 text-xs">
                      No subdirectories found or all excluded.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Responsive Interactive Treemap Tiles */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                        {diskUsageData.items.map((item, idx) => {
                          const style = TREEMAP_PALETTE[idx % TREEMAP_PALETTE.length];
                          const isLarge = item.percent > 20;
                          const isMedium = item.percent > 8 && item.percent <= 20;

                          return (
                            <div
                              key={item.path}
                              onClick={() => {
                                loadDirectory(item.path);
                                setShowDiskUsage(false);
                              }}
                              className={`rounded-xl border p-3 flex flex-col justify-between cursor-pointer transition-all transform hover:-translate-y-0.5 hover:shadow-lg ${
                                style.bg
                              } ${
                                isLarge
                                  ? 'col-span-2 sm:col-span-2 row-span-2 min-h-[140px]'
                                  : isMedium
                                  ? 'col-span-2 sm:col-span-1 min-h-[100px]'
                                  : 'min-h-[85px]'
                              }`}
                              title={`Click to open ${item.path} in File Manager`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div className="flex items-center gap-1.5 truncate">
                                  <Folder className="w-4 h-4 shrink-0" />
                                  <span className="font-bold truncate text-xs text-white">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40">
                                  {item.percent}%
                                </span>
                              </div>

                              <div className="mt-2">
                                <div className="text-xs font-bold text-white">
                                  {formatBytes(item.sizeBytes)}
                                </div>
                                <div className="text-[10px] opacity-75 truncate mt-0.5 font-mono">
                                  {item.path}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Detailed Breakdown Ranked Table */}
                      <div className="rounded-xl bg-carbon-850/60 border border-carbon-750 overflow-hidden text-xs">
                        <div className="px-4 py-2.5 bg-carbon-800 font-bold text-carbon-200 border-b border-carbon-750 flex items-center justify-between">
                          <span>Ranked Subdirectory Usage</span>
                          <span className="text-[11px] text-carbon-400 font-normal">
                            Click Jump to open folder
                          </span>
                        </div>
                        <div className="divide-y divide-carbon-800">
                          {diskUsageData.items.map((item, idx) => {
                            const style = TREEMAP_PALETTE[idx % TREEMAP_PALETTE.length];
                            return (
                              <div
                                key={item.path}
                                className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-carbon-800/40 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <span className="text-carbon-500 w-5 text-right font-mono">#{idx + 1}</span>
                                  <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span className="font-semibold text-white truncate max-w-xs">{item.path}</span>
                                  <div className="w-32 bg-carbon-800 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                    <div
                                      className={`h-full ${style.bar}`}
                                      style={{ width: `${Math.min(100, item.percent)}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="font-bold text-carbon-200 w-20 text-right">
                                    {formatBytes(item.sizeBytes)}
                                  </span>
                                  <span className="text-carbon-400 w-12 text-right">
                                    {item.percent}%
                                  </span>
                                  <button
                                    onClick={() => {
                                      setDiskUsagePath(item.path);
                                      runDiskUsageScan(item.path, diskUsageExclude);
                                    }}
                                    className="px-2 py-1 rounded bg-carbon-800 hover:bg-carbon-750 text-carbon-300 hover:text-white border border-carbon-700 text-[11px]"
                                    title="Scan inside this folder"
                                  >
                                    Scan In
                                  </button>
                                  <button
                                    onClick={() => {
                                      loadDirectory(item.path);
                                      setShowDiskUsage(false);
                                    }}
                                    className="px-2 py-1 rounded bg-dorito-500/10 hover:bg-dorito-500/20 text-dorito-400 border border-dorito-500/30 text-[11px]"
                                    title="Open folder in File Manager"
                                  >
                                    Jump
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end pt-4 border-t border-carbon-700 mt-2">
              <button
                onClick={() => setShowDiskUsage(false)}
                className="px-4 py-2 rounded-lg bg-carbon-800 hover:bg-carbon-750 text-white font-medium text-xs border border-carbon-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task 3: Compress Modal */}
      {showCompressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-mono">
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-dorito-500" />
                <h3 className="font-bold text-white text-base font-sans">Compress Selected Items</h3>
              </div>
              <button
                onClick={() => setShowCompressModal(false)}
                className="p-1 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteArchive} className="space-y-4 text-xs">
              <div>
                <label className="text-carbon-400 block mb-1">
                  Items to compress ({selectedItems.length}):
                </label>
                <div className="max-h-28 overflow-auto bg-carbon-850 p-2.5 rounded-lg border border-carbon-750 text-carbon-300 space-y-1">
                  {selectedItems.map((name) => (
                    <div key={name} className="truncate flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-dorito-500 shrink-0" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-carbon-300 block mb-1.5 font-semibold">Format:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['zip', 'tar.gz'] as const).map((fmt) => (
                    <button
                      type="button"
                      key={fmt}
                      onClick={() => setArchiveFormat(fmt)}
                      className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                        archiveFormat === fmt
                          ? 'bg-dorito-500/20 border-dorito-500 text-dorito-400'
                          : 'bg-carbon-850 border-carbon-700 text-carbon-300 hover:text-white'
                      }`}
                    >
                      .{fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-carbon-300 block mb-1.5 font-semibold">Archive Name:</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={archiveName}
                    onChange={(e) => setArchiveName(e.target.value)}
                    required
                    placeholder="archive"
                    className="flex-1 bg-carbon-850 border border-carbon-700 rounded-l-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-dorito-500"
                  />
                  <span className="px-3 py-2 bg-carbon-800 border border-l-0 border-carbon-700 rounded-r-lg text-carbon-400 font-mono">
                    .{archiveFormat}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompressModal(false)}
                  className="px-4 py-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-300 text-xs font-medium border border-carbon-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={compressing}
                  className="px-4 py-2 rounded-lg bg-dorito-500 hover:bg-dorito-600 text-carbon-950 font-bold text-xs shadow-md shadow-dorito-500/20 disabled:opacity-50"
                >
                  {compressing ? 'Compressing...' : 'Compress'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task 3: Extract Archive Modal */}
      {extractTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-mono">
          <div className="w-full max-w-md bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-carbon-700 mb-4">
              <div className="flex items-center gap-2">
                <FolderArchive className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base font-sans">Extract Archive</h3>
              </div>
              <button
                onClick={() => setExtractTargetItem(null)}
                className="p-1 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteExtract} className="space-y-4 text-xs">
              <div>
                <label className="text-carbon-400 block mb-1">Archive File:</label>
                <div className="p-2.5 rounded-lg bg-carbon-850 border border-carbon-750 text-white font-semibold truncate">
                  {extractTargetItem.name}
                </div>
                <span className="text-[11px] text-carbon-500 truncate block mt-0.5">
                  {extractTargetItem.path}
                </span>
              </div>

              <div>
                <label className="text-carbon-300 block mb-1.5 font-semibold">Destination Directory:</label>
                <input
                  type="text"
                  value={extractDestPath}
                  onChange={(e) => setExtractDestPath(e.target.value)}
                  required
                  placeholder={currentPath}
                  className="w-full bg-carbon-850 border border-carbon-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-dorito-500"
                />
                <span className="text-[11px] text-carbon-500 block mt-1">
                  Directory will be created if it does not exist.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtractTargetItem(null)}
                  className="px-4 py-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 text-carbon-300 text-xs font-medium border border-carbon-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extracting}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-carbon-950 font-bold text-xs shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {extracting ? 'Extracting...' : 'Extract Archive'}
                </button>
              </div>
            </form>
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
