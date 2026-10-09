import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Database,
  Globe,
  Tv,
  Activity,
  Shield,
  Layers,
  Workflow,
  HardDrive,
  MessageSquare,
  CheckSquare,
  Home,
  FileText,
  GitBranch,
  PenTool,
  BarChart3,
  TrendingUp,
  Download,
  Loader2,
  X,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Code2
} from 'lucide-react';
import { Host, AppTemplate, DockerHubRepo } from '../types';
import { api } from '../api';

interface AppStoreViewProps {
  selectedHost: Host | null;
  onNavigateToCompose?: () => void;
}

export const AppStoreView: React.FC<AppStoreViewProps> = ({ selectedHost, onNavigateToCompose }) => {
  const [templates, setTemplates] = useState<AppTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Mode: catalog vs hub
  const [storeMode, setStoreMode] = useState<'catalog' | 'hub'>('catalog');
  const [hubQuery, setHubQuery] = useState('');
  const [hubResults, setHubResults] = useState<DockerHubRepo[]>([]);
  const [hubSearching, setHubSearching] = useState(false);

  // Deploy Modal
  const [selectedTemplate, setSelectedTemplate] = useState<AppTemplate | null>(null);
  const [projectName, setProjectName] = useState('');
  const [envOverrides, setEnvOverrides] = useState<Record<string, string>>({});
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; output: string; directory: string } | null>(null);
  const [showYamlPreview, setShowYamlPreview] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);

  // Hub Generic Deploy Modal
  const [hubDeployRepo, setHubDeployRepo] = useState<DockerHubRepo | null>(null);
  const [hubDeployPort, setHubDeployPort] = useState('8080:80');

  const categories = ['All', 'Database', 'Web', 'Media', 'Tools', 'Dev', 'Analytics'];

  const fetchTemplates = async () => {
    if (!selectedHost) return;
    setLoading(true);
    try {
      const data = await api.docker.templates(selectedHost.id);
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load app templates', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [selectedHost]);

  const handleSearchHub = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hubQuery.trim()) return;

    setHubSearching(true);
    try {
      const res = await api.docker.hubSearch(hubQuery.trim());
      setHubResults(res.results || []);
    } catch (err) {
      console.error('Failed to search Docker Hub', err);
    } finally {
      setHubSearching(false);
    }
  };

  const handleOpenDeploy = (template: AppTemplate) => {
    setSelectedTemplate(template);
    // sanitize project name default
    setProjectName(template.id);
    setEnvOverrides({ ...template.defaultEnv });
    setDeployResult(null);
    setShowYamlPreview(false);
  };

  const handleExecuteDeploy = async () => {
    if (!selectedHost || !selectedTemplate) return;
    if (!projectName.trim()) {
      alert('Please provide a project name');
      return;
    }

    setDeploying(true);
    try {
      const res = await api.docker.deployTemplate(selectedHost.id, {
        templateId: selectedTemplate.id,
        projectName: projectName.trim(),
        env: envOverrides,
      });

      setDeployResult({
        success: res.success,
        output: res.output || (res.success ? 'App stack deployed successfully!' : (res.error || 'Deployment failed')),
        directory: res.directory,
      });
    } catch (err: any) {
      setDeployResult({
        success: false,
        output: err.message || 'Deployment failed',
        directory: '',
      });
    } finally {
      setDeploying(false);
    }
  };

  const handleExecuteHubDeploy = async () => {
    if (!selectedHost || !hubDeployRepo) return;
    const safeName = hubDeployRepo.repoName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

    // Create custom compose YAML for Docker Hub image
    const customYaml = `services:
  app:
    image: ${hubDeployRepo.repoName}:latest
    restart: unless-stopped
    ports:
      - "${hubDeployPort}"
`;
    // Create temporary template-like deploy by submitting directly or through templates
    setDeploying(true);
    try {
      const res = await api.docker.deployTemplate(selectedHost.id, {
        templateId: 'custom-hub',
        projectName: safeName,
        env: {},
      });
      setDeployResult({
        success: res.success,
        output: res.output,
        directory: res.directory,
      });
    } catch (err: any) {
      setDeployResult({
        success: false,
        output: err.message,
        directory: '',
      });
    } finally {
      setDeploying(false);
    }
  };

  const renderCategoryIcon = (iconName: string, category: string) => {
    switch (category.toLowerCase()) {
      case 'database':
        return <Database className="w-5 h-5 text-amber-400" />;
      case 'web':
        return <Globe className="w-5 h-5 text-cyan-400" />;
      case 'media':
        return <Tv className="w-5 h-5 text-rose-400" />;
      case 'tools':
        return <Workflow className="w-5 h-5 text-emerald-400" />;
      case 'dev':
        return <GitBranch className="w-5 h-5 text-violet-400" />;
      case 'analytics':
        return <BarChart3 className="w-5 h-5 text-dorito-400" />;
      default:
        return <Layers className="w-5 h-5 text-dorito-400" />;
    }
  };

  if (!selectedHost) {
    return (
      <div className="p-12 text-center text-carbon-400 font-mono">
        Select a host from the top navigation to browse and deploy apps
      </div>
    );
  }

  const filteredTemplates = templates.filter((t) => {
    const matchesCategory = selectedCategory === 'All' || t.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-carbon-700/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-medium text-white tracking-tight">App Store</h1>
            
          </div>
          <p className="text-xs sm:text-sm text-carbon-400 mt-1 font-mono">
            Deploy 30+ verified Docker Compose stacks or search Docker Hub on {selectedHost.name}
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-carbon-900 border border-carbon-700 font-mono text-xs self-start sm:self-auto">
          <button
            onClick={() => setStoreMode('catalog')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all font-medium ${
              storeMode === 'catalog'
                ? 'bg-dorito-500 text-carbon-950 font-bold shadow-md'
                : 'text-carbon-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Catalog ({templates.length})</span>
          </button>
          <button
            onClick={() => setStoreMode('hub')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all font-medium ${
              storeMode === 'hub'
                ? 'bg-dorito-500 text-carbon-950 font-bold shadow-md'
                : 'text-carbon-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Docker Hub</span>
          </button>
        </div>
      </div>

      {/* CATALOG MODE */}
      {storeMode === 'catalog' && (
        <div className="space-y-5">
          {/* Search & Category Filter Pills */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-carbon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search templates (e.g. Postgres, Nginx, Uptime Kuma)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-carbon-900 border border-carbon-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 focus:ring-1 focus:ring-dorito-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none font-mono text-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-carbon-800 border border-dorito-500/60 text-dorito-400 font-bold'
                      : 'bg-carbon-900 border border-carbon-700 text-carbon-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-carbon-400 font-mono">
              <Loader2 className="w-8 h-8 animate-spin text-dorito-500" />
              <span>Loading application catalog...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-12 text-center bg-carbon-900/60 border border-dashed border-carbon-700 rounded-2xl text-carbon-400 font-mono">
              No applications match "{searchQuery}"
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => {
                const envKeys = Object.keys(template.defaultEnv);
                return (
                  <div
                    key={template.id}
                    className="group rounded-2xl bg-carbon-900 border border-carbon-700 hover:border-dorito-500/60 p-5 shadow-lg transition-all flex flex-col justify-between hover:shadow-[0_4px_20px_rgba(255,209,0,0.08)]"
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-carbon-850 border border-carbon-700 shadow-inner group-hover:scale-105 transition-transform">
                            {renderCategoryIcon(template.icon, template.category)}
                          </div>
                          <div>
                            <h3 className="font-medium text-white text-base tracking-tight font-sans">
                              {template.name}
                            </h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-carbon-850 border border-carbon-700 text-carbon-400">
                              {template.category}
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] font-mono text-carbon-500 bg-carbon-850/60 px-2 py-0.5 rounded border border-carbon-750">
                          {template.id}
                        </span>
                      </div>

                      <p className="text-xs text-carbon-300 leading-relaxed line-clamp-3 mb-4">
                        {template.description}
                      </p>

                      {/* Ports & Environment highlights */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-5 font-mono text-[11px]">
                        {envKeys.slice(0, 3).map((k) => (
                          <span
                            key={k}
                            className="px-2 py-0.5 rounded bg-carbon-850 text-carbon-400 border border-carbon-750 truncate max-w-[150px]"
                            title={`${k}=${template.defaultEnv[k]}`}
                          >
                            {k}
                          </span>
                        ))}
                        {envKeys.length > 3 && (
                          <span className="text-carbon-500 text-[10px]">+{envKeys.length - 3} vars</span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-carbon-800">
                      <button
                        onClick={() => handleOpenDeploy(template)}
                        className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-400 text-carbon-950 font-medium text-xs transition-all shadow-md active:scale-95 font-mono"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>1-Click Deploy</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DOCKER HUB SEARCH MODE */}
      {storeMode === 'hub' && (
        <div className="space-y-5">
          <form onSubmit={handleSearchHub} className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-carbon-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search millions of images on Docker Hub (e.g. rust, redis, rabbitmq)..."
                value={hubQuery}
                onChange={(e) => setHubQuery(e.target.value)}
                className="w-full bg-carbon-900 border border-carbon-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 focus:ring-1 focus:ring-dorito-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={hubSearching || !hubQuery.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dorito-500 hover:bg-dorito-400 disabled:opacity-50 text-carbon-950 font-medium text-xs transition-all font-mono"
            >
              {hubSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Search Hub</span>
            </button>
          </form>

          {hubSearching ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-carbon-400 font-mono">
              <Loader2 className="w-8 h-8 animate-spin text-dorito-500" />
              <span>Querying Docker Hub API...</span>
            </div>
          ) : hubResults.length === 0 ? (
            <div className="p-12 text-center bg-carbon-900/60 border border-dashed border-carbon-700 rounded-2xl text-carbon-400 font-mono">
              {hubQuery ? 'No images found on Docker Hub' : 'Enter a query to search Docker Hub registry'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hubResults.map((repo) => (
                <div
                  key={repo.repoName}
                  className="rounded-2xl bg-carbon-900 border border-carbon-700 hover:border-dorito-500/60 p-5 shadow-lg transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-dorito-400 shrink-0" />
                        <h3 className="font-medium text-white text-base truncate font-mono">
                          {repo.repoName}
                        </h3>
                      </div>
                      {repo.isOfficial && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dorito-500/15 border border-dorito-500/40 text-dorito-400 font-medium shrink-0">
                          OFFICIAL
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-carbon-300 leading-relaxed line-clamp-3 mb-4">
                      {repo.shortDescription || 'No description provided.'}
                    </p>

                    <div className="flex items-center gap-4 text-xs font-mono text-carbon-400 mb-4">
                      <span>★ {repo.starCount.toLocaleString()} stars</span>
                      {repo.pullCount > 0 && <span>↓ {(repo.pullCount / 1000000).toFixed(1)}M pulls</span>}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-carbon-800 flex items-center justify-between">
                    <a
                      href={`https://hub.docker.com/r/${repo.repoName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono text-carbon-400 hover:text-dorito-400 flex items-center gap-1"
                    >
                      <span>Docker Hub</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      onClick={() => {
                        const genericTemplate: AppTemplate = {
                          id: repo.repoName.replace(/\//g, '-'),
                          name: repo.repoName,
                          category: 'Tools',
                          description: repo.shortDescription,
                          icon: 'Layers',
                          defaultEnv: {
                            HOST_PORT: '8080',
                          },
                          composeYaml: `services:\n  ${repo.repoName.split('/').pop() || 'app'}:\n    image: ${repo.repoName}:latest\n    restart: unless-stopped\n    ports:\n      - "\${HOST_PORT}:8080"\n`,
                        };
                        handleOpenDeploy(genericTemplate);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-dorito-400 font-mono text-xs font-medium"
                    >
                      <Sparkles className="w-3 h-3 text-dorito-500" />
                      <span>Deploy Image</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 1-CLICK DEPLOY CONFIG MODAL */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-carbon-900 border border-carbon-700 rounded-2xl shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-carbon-700 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-carbon-850 border border-carbon-700">
                  {renderCategoryIcon(selectedTemplate.icon, selectedTemplate.category)}
                </div>
                <div>
                  <h3 className="font-medium text-white text-lg font-sans">
                    Deploy {selectedTemplate.name}
                  </h3>
                  <p className="text-xs text-carbon-400 font-mono">
                    Install to /opt/nijipanel/apps/{projectName || selectedTemplate.id} on {selectedHost.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedTemplate(null);
                  setDeployResult(null);
                }}
                className="p-1.5 rounded-lg text-carbon-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 font-mono text-xs">
              {deployResult ? (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                      deployResult.success
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {deployResult.success ? (
                      <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm">
                        {deployResult.success ? 'Deployment Succeeded!' : 'Deployment Failed'}
                      </h4>
                      <p className="text-xs mt-1 text-carbon-300">
                        {deployResult.success
                          ? `Stack is now running in ${deployResult.directory}`
                          : 'Check the command output below for troubleshooting.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-carbon-400 uppercase font-semibold mb-1 block">
                      Execution Output:
                    </label>
                    <pre className="p-3 rounded-xl bg-black/90 border border-carbon-700 text-carbon-200 overflow-x-auto text-[11px] whitespace-pre-wrap max-h-60">
                      {deployResult.output}
                    </pre>
                  </div>
                </div>
              ) : (
                <>
                  {/* Project Name Field */}
                  <div>
                    <label className="block text-xs font-semibold text-carbon-200 mb-1.5">
                      Stack / Directory Name
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      placeholder="e.g. postgres-prod"
                      className="w-full bg-carbon-850 border border-carbon-700 rounded-xl px-3.5 py-2 text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 focus:ring-1 focus:ring-dorito-500"
                    />
                    <span className="text-[11px] text-carbon-500 mt-1 block">
                      Target folder: /opt/nijipanel/apps/{projectName || 'project'}
                    </span>
                  </div>

                  {/* Configurable Environment Variables Form */}
                  <div>
                    <label className="block text-xs font-semibold text-carbon-200 mb-2">
                      Environment Configuration (.env)
                    </label>
                    <div className="space-y-3 bg-carbon-850/50 p-4 rounded-xl border border-carbon-750">
                      {Object.keys(envOverrides).length === 0 ? (
                        <p className="text-carbon-500 text-xs italic">No environment variables required.</p>
                      ) : (
                        Object.entries(envOverrides).map(([key, value]) => (
                          <div key={key} className="space-y-1">
                            <label className="text-[11px] font-semibold text-carbon-300 truncate block">
                              {key}
                            </label>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) =>
                                setEnvOverrides((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              className="w-full bg-carbon-900 border border-carbon-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-dorito-500 font-mono"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Compose YAML Preview Accordion */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowYamlPreview(!showYamlPreview)}
                      className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-xs text-carbon-300 font-mono"
                    >
                      <span className="flex items-center gap-2">
                        <Code2 className="w-3.5 h-3.5 text-dorito-400" />
                        <span>Preview docker-compose.yml</span>
                      </span>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${showYamlPreview ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {showYamlPreview && (
                      <div className="relative mt-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedTemplate.composeYaml);
                            setCopiedYaml(true);
                            setTimeout(() => setCopiedYaml(false), 2000);
                          }}
                          className="absolute right-3 top-3 p-1.5 rounded-lg bg-carbon-800 text-carbon-400 hover:text-white border border-carbon-700 z-10"
                          title="Copy Compose YAML"
                        >
                          {copiedYaml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <pre className="p-3 rounded-xl bg-black/90 border border-carbon-700 text-carbon-300 overflow-x-auto text-[11px] leading-relaxed max-h-52">
                          {selectedTemplate.composeYaml}
                        </pre>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-carbon-700 mt-4 flex items-center justify-end gap-3 font-mono text-xs">
              {deployResult ? (
                <>
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setDeployResult(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-carbon-800 hover:bg-carbon-750 text-carbon-200 border border-carbon-700"
                  >
                    Close
                  </button>
                  {deployResult.success && onNavigateToCompose && (
                    <button
                      onClick={() => {
                        setSelectedTemplate(null);
                        setDeployResult(null);
                        onNavigateToCompose();
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-400 text-carbon-950 font-medium shadow-md"
                    >
                      <span>Open in Compose</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    disabled={deploying}
                    className="px-4 py-2 rounded-xl bg-carbon-850 hover:bg-carbon-800 text-carbon-300 border border-carbon-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteDeploy}
                    disabled={deploying || !projectName.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-dorito-500 hover:bg-dorito-400 disabled:opacity-50 text-carbon-950 font-medium shadow-lg"
                  >
                    {deploying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-carbon-950" />
                        <span>Deploying Stack...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Launch Container</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
