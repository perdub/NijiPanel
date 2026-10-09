import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  Wifi,
  Network,
  Copy,
  Check,
  RefreshCw,
  Server,
  ArrowRight,
  Shield,
  Layers,
  Search,
  ExternalLink,
  MapPin,
  Radio,
  Share2
} from 'lucide-react';
import { HostNetworkInfo, NetworkInterfaceDetail } from '../types';
import { api } from '../api';

interface NetworkInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  hostId?: string;
  hostName?: string;
  hostAddress?: string;
  initialNetworkInfo?: HostNetworkInfo | null;
  onInspectLive?: () => Promise<HostNetworkInfo>;
}

export const NetworkInspectorModal: React.FC<NetworkInspectorModalProps> = ({
  isOpen,
  onClose,
  hostId,
  hostName,
  hostAddress,
  initialNetworkInfo,
  onInspectLive,
}) => {
  const [networkInfo, setNetworkInfo] = useState<HostNetworkInfo | null>(initialNetworkInfo || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedInterface, setSelectedInterface] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchNetworkInfo = async () => {
    if (!isOpen) return;
    setError(null);
    setLoading(true);
    try {
      if (onInspectLive) {
        const data = await onInspectLive();
        setNetworkInfo(data);
      } else if (hostId) {
        const data = await api.hosts.getNetwork(hostId);
        setNetworkInfo(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve network topology & GeoIP data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialNetworkInfo) {
        setNetworkInfo(initialNetworkInfo);
      } else if (hostId || onInspectLive) {
        fetchNetworkInfo();
      }
    } else {
      setSelectedInterface('all');
      setSearchQuery('');
      setError(null);
    }
  }, [isOpen, hostId, initialNetworkInfo]);

  if (!isOpen) return null;

  const geo = networkInfo?.geo;
  const interfaces = networkInfo?.interfaces || [];

  const filteredInterfaces = interfaces.filter((iface) => {
    if (selectedInterface !== 'all' && iface.name !== selectedInterface) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesName = iface.name.toLowerCase().includes(q);
    const matchesMac = iface.mac?.toLowerCase().includes(q) ?? false;
    const matchesIpv4 = iface.ipv4.some(
      (ip) =>
        ip.address.includes(q) ||
        ip.cidr.includes(q) ||
        (ip.network && ip.network.includes(q)) ||
        (ip.rangeStart && ip.rangeStart.includes(q)) ||
        (ip.rangeEnd && ip.rangeEnd.includes(q))
    );
    const matchesIpv6 = iface.ipv6.some((ip) => ip.address.toLowerCase().includes(q) || ip.cidr.toLowerCase().includes(q));
    return matchesName || matchesMac || matchesIpv4 || matchesIpv6;
  });

  const getInterfaceTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'ethernet':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'bridge':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'tunnel':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
      case 'loopback':
        return 'bg-neutral-800 border-neutral-700 text-neutral-400';
      case 'wireless':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      default:
        return 'bg-carbon-800 border-carbon-700 text-carbon-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#080808] border border-carbon-700/80 rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-carbon-800 bg-[#0d0d0d] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-carbon-850 border border-carbon-700 flex items-center justify-center text-dorito-500 shadow-sm">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white text-sm font-semibold tracking-tight">
                  Network & GeoIP Inspector
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-dorito-500/15 border border-dorito-500/30 text-dorito-400 uppercase">
                  Topology
                </span>
              </div>
              <p className="text-[11px] text-carbon-400 font-mono mt-0.5">
                {hostName || 'Target Server'} {hostAddress ? `• ${hostAddress}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(hostId || onInspectLive) && (
              <button
                onClick={fetchNetworkInfo}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-carbon-850 hover:bg-carbon-800 border border-carbon-700 text-carbon-300 hover:text-white text-xs font-mono transition-colors disabled:opacity-50"
                title="Re-probe network interfaces and GeoIP"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-dorito-500 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{loading ? 'Probing...' : 'Re-probe'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-carbon-400 hover:text-white hover:bg-carbon-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Loading State */}
          {loading && !networkInfo && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <RefreshCw className="w-8 h-8 text-dorito-500 animate-spin" />
              <div className="text-center font-mono">
                <p className="text-xs text-white">Inspecting Host Network Interfaces & GeoIP...</p>
                <p className="text-[11px] text-carbon-500 mt-1">
                  Probing ip -j addr, routes, DNS resolvers and GeoIP endpoint
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs flex items-start gap-2.5">
              <span className="shrink-0 font-bold">ERR:</span>
              <div className="flex-1">
                <p className="font-semibold">{error}</p>
                <p className="text-[11px] text-rose-400/80 mt-1">
                  Ensure the target server is online and SSH credentials have network reading permissions.
                </p>
              </div>
              <button
                onClick={fetchNetworkInfo}
                className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {networkInfo && (
            <>
              {/* Top GeoIP & Ingress Banner */}
              <div className="rounded-xl bg-[#0c0d10] border border-carbon-700/80 p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-carbon-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-carbon-850 border border-carbon-700 flex flex-col items-center justify-center shrink-0 shadow-sm">
                      <span className="font-mono text-xs font-bold text-dorito-400">
                        {geo?.countryCode || 'NET'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-semibold tracking-tight">
                          {geo?.city ? `${geo.city}, ` : ''}{geo?.country || 'Unknown Location'}
                        </span>
                        {geo?.countryCode && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-carbon-800 text-carbon-300 border border-carbon-700">
                            {geo.countryCode}
                          </span>
                        )}
                        {geo?.region && (
                          <span className="text-xs text-carbon-400 hidden md:inline">
                            • {geo.region}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-carbon-400 font-mono mt-0.5">
                        {geo?.isp && <span className="truncate max-w-[220px]">{geo.isp}</span>}
                        {geo?.asn && (
                          <span className="text-carbon-500 text-[11px]">
                            ({geo.asn})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Public IP Box */}
                  <div className="flex items-center gap-2 self-start sm:self-auto bg-black/60 border border-carbon-700 rounded-lg px-3 py-1.5 font-mono">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span className="text-[11px] text-carbon-400">Public IP:</span>
                    <span className="text-xs text-dorito-400 font-bold tracking-wide select-all">
                      {geo?.publicIp || hostAddress || 'N/A'}
                    </span>
                    {(geo?.publicIp || hostAddress) && (
                      <button
                        onClick={() => copyToClipboard(geo?.publicIp || hostAddress || '', 'publicIp')}
                        className="text-carbon-400 hover:text-white transition-colors ml-1 p-0.5 rounded"
                        title="Copy Public IP"
                      >
                        {copiedKey === 'publicIp' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Subnet Route & DNS Resolvers Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 font-mono text-xs">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-carbon-800">
                    <span className="text-[10px] text-carbon-400 uppercase tracking-wider block">
                      Default Gateway
                    </span>
                    <span className="text-xs text-carbon-200 font-semibold mt-0.5 block truncate">
                      {networkInfo.defaultGateway || 'Direct / None'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-carbon-800">
                    <span className="text-[10px] text-carbon-400 uppercase tracking-wider block">
                      DNS Resolvers
                    </span>
                    <span className="text-xs text-carbon-200 font-semibold mt-0.5 block truncate" title={networkInfo.dnsServers.join(', ')}>
                      {networkInfo.dnsServers.length > 0
                        ? networkInfo.dnsServers.slice(0, 2).join(', ')
                        : 'System Default'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-carbon-800">
                    <span className="text-[10px] text-carbon-400 uppercase tracking-wider block">
                      Coordinates (Lat, Lon)
                    </span>
                    <span className="text-xs text-carbon-200 mt-0.5 block truncate">
                      {geo?.latitude && geo?.longitude
                        ? `${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}`
                        : 'Not available'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-carbon-800">
                    <span className="text-[10px] text-carbon-400 uppercase tracking-wider block">
                      Interfaces Detected
                    </span>
                    <span className="text-xs text-dorito-400 font-bold mt-0.5 block">
                      {interfaces.length} Devices ({interfaces.filter((i) => i.state === 'UP').length} UP)
                    </span>
                  </div>
                </div>
              </div>

              {/* Interface Filter & Search Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                {/* Interface Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none font-mono text-xs">
                  <button
                    onClick={() => setSelectedInterface('all')}
                    className={`px-2.5 py-1 rounded-lg border transition-colors shrink-0 text-xs ${
                      selectedInterface === 'all'
                        ? 'bg-dorito-500/15 border-dorito-500 text-dorito-400 font-semibold'
                        : 'bg-carbon-850 border-carbon-700/80 text-carbon-400 hover:text-white'
                    }`}
                  >
                    All ({interfaces.length})
                  </button>
                  {interfaces.map((iface) => (
                    <button
                      key={iface.name}
                      onClick={() => setSelectedInterface(iface.name)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors shrink-0 text-xs ${
                        selectedInterface === iface.name
                          ? 'bg-dorito-500/15 border-dorito-500 text-dorito-400 font-semibold'
                          : 'bg-carbon-850 border-carbon-700/80 text-carbon-400 hover:text-white'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          iface.state === 'UP' ? 'bg-emerald-400' : 'bg-rose-500'
                        }`}
                      />
                      <span>{iface.name}</span>
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative shrink-0 sm:w-60">
                  <Search className="w-3.5 h-3.5 text-carbon-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search IP, CIDR, MAC..."
                    className="w-full bg-black border border-carbon-700 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-carbon-500 focus:outline-none focus:border-dorito-500 font-mono"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-carbon-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Interfaces Detailed Breakdown List */}
              <div className="space-y-3">
                {filteredInterfaces.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-carbon-800 rounded-xl text-carbon-500 font-mono text-xs">
                    No network interfaces match the current search filter.
                  </div>
                ) : (
                  filteredInterfaces.map((iface) => (
                    <div
                      key={iface.name}
                      className="rounded-xl bg-[#09090b] border border-carbon-700/80 p-4 space-y-3 transition-colors hover:border-carbon-600"
                    >
                      {/* Interface Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-carbon-800">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              iface.state === 'UP' ? 'bg-emerald-400' : 'bg-rose-500'
                            }`}
                            title={`Status: ${iface.state}`}
                          />
                          <span className="font-mono text-white text-sm font-bold tracking-tight">
                            {iface.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border uppercase tracking-wider ${getInterfaceTypeBadge(
                              iface.type
                            )}`}
                          >
                            {iface.type}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-carbon-800 text-carbon-400 border border-carbon-700">
                            MTU {iface.mtu}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                              iface.state === 'UP'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            }`}
                          >
                            {iface.state}
                          </span>
                        </div>

                        {/* MAC Address */}
                        {iface.mac && (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-carbon-400 bg-black/60 px-2.5 py-1 rounded-lg border border-carbon-800 self-start sm:self-auto">
                            <span className="text-[10px] text-carbon-500 uppercase">MAC:</span>
                            <span className="text-carbon-200 select-all">{iface.mac}</span>
                            <button
                              onClick={() => copyToClipboard(iface.mac || '', `mac-${iface.name}`)}
                              className="text-carbon-500 hover:text-white transition-colors ml-0.5"
                              title="Copy MAC Address"
                            >
                              {copiedKey === `mac-${iface.name}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Flags Badges */}
                      {iface.flags && iface.flags.length > 0 && (
                        <div className="flex flex-wrap gap-1 font-mono text-[10px] text-carbon-500">
                          <span className="text-carbon-600 mr-1">FLAGS:</span>
                          {iface.flags.map((flag) => (
                            <span
                              key={flag}
                              className="px-1.5 py-0.2 rounded bg-carbon-850 text-carbon-400 border border-carbon-800"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* IPv4 Address Cards with Range & Subnet calculation */}
                      {iface.ipv4.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono text-carbon-400 uppercase tracking-wider block">
                            IPv4 Subnets & Ranges ({iface.ipv4.length})
                          </span>
                          <div className="grid grid-cols-1 gap-2.5">
                            {iface.ipv4.map((ip, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg bg-black/70 border border-carbon-800 p-3 space-y-2 font-mono text-xs"
                              >
                                {/* Top Line: Address & Scope */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-bold text-sm select-all text-dorito-400">
                                      {ip.cidr}
                                    </span>
                                    <button
                                      onClick={() => copyToClipboard(ip.cidr, `cidr-${iface.name}-${idx}`)}
                                      className="p-1 rounded text-carbon-500 hover:text-dorito-400 transition-colors"
                                      title="Copy CIDR"
                                    >
                                      {copiedKey === `cidr-${iface.name}-${idx}` ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-carbon-800 border border-carbon-700 text-carbon-300">
                                      scope: {ip.scope}
                                    </span>
                                    {ip.totalHosts > 0 && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                        {ip.totalHosts.toLocaleString()} usable hosts
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Calculated Subnet Details Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-carbon-800/80 text-[11px]">
                                  <div>
                                    <span className="text-carbon-500 block text-[10px]">Netmask</span>
                                    <span className="text-carbon-200 select-all">{ip.netmask || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-carbon-500 block text-[10px]">Network</span>
                                    <span className="text-carbon-200 select-all">{ip.network || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-carbon-500 block text-[10px]">Usable Range</span>
                                    <span className="text-dorito-300 select-all truncate block" title={`${ip.rangeStart} - ${ip.rangeEnd}`}>
                                      {ip.rangeStart && ip.rangeEnd ? `${ip.rangeStart} → ${ip.rangeEnd}` : 'Single /32 Host'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-carbon-500 block text-[10px]">Broadcast</span>
                                    <span className="text-carbon-200 select-all">{ip.broadcast || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* IPv6 Addresses */}
                      {iface.ipv6.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-mono text-carbon-400 uppercase tracking-wider block">
                            IPv6 Addresses ({iface.ipv6.length})
                          </span>
                          <div className="space-y-1">
                            {iface.ipv6.map((ip6, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded bg-black/50 border border-carbon-800/80 font-mono text-xs"
                              >
                                <span className="text-carbon-200 select-all truncate max-w-[80%]">
                                  {ip6.cidr}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-carbon-800 text-carbon-400">
                                    scope: {ip6.scope}
                                  </span>
                                  <button
                                    onClick={() => copyToClipboard(ip6.cidr, `ip6-${iface.name}-${idx}`)}
                                    className="text-carbon-500 hover:text-white transition-colors"
                                    title="Copy IPv6"
                                  >
                                    {copiedKey === `ip6-${iface.name}-${idx}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {iface.ipv4.length === 0 && iface.ipv6.length === 0 && (
                        <p className="text-xs font-mono text-carbon-500 italic">
                          No IP addresses currently bound to this interface.
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-carbon-800 bg-[#0d0d0d] shrink-0 font-mono text-xs">
          <div className="text-[11px] text-carbon-400">
            {networkInfo?.checkedAt
              ? `Probed: ${new Date(networkInfo.checkedAt).toLocaleTimeString()}`
              : 'Live agentless query via SSH'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
