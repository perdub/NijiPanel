using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.RegularExpressions;
using NijiPanel.Backend.Data;
using NijiPanel.Backend.Models;

namespace NijiPanel.Backend.Services;

public interface IHostNetworkService
{
    Task<HostNetworkInfoDto> GetHostNetworkInfoAsync(HostEntity host);
    Task<HostNetworkInfoDto> InspectNetworkAsync(string host, int port, string username, string authType, string? credential, string? passphrase);
}

public class HostNetworkService : IHostNetworkService
{
    private readonly ISshConnectionManager _sshManager;
    private readonly IEncryptionService _encryptionService;
    private readonly ICommandRegistry _cmdRegistry;
    private readonly ICacheService _cacheService;
    private readonly HttpClient _httpClient;
    private readonly ILogger<HostNetworkService> _logger;

    public HostNetworkService(
        ISshConnectionManager sshManager,
        IEncryptionService encryptionService,
        ICommandRegistry cmdRegistry,
        ICacheService cacheService,
        IHttpClientFactory httpClientFactory,
        ILogger<HostNetworkService> logger)
    {
        _sshManager = sshManager;
        _encryptionService = encryptionService;
        _cmdRegistry = cmdRegistry;
        _cacheService = cacheService;
        _httpClient = httpClientFactory.CreateClient();
        _httpClient.Timeout = TimeSpan.FromSeconds(5);
        _logger = logger;
    }

    public async Task<HostNetworkInfoDto> GetHostNetworkInfoAsync(HostEntity host)
    {
        return await _cacheService.GetOrCreateAsync(
            $"host_network_{host.Id}",
            () => ExecuteAndParseNetworkAsync(host),
            TimeSpan.FromSeconds(30)
        );
    }

    public async Task<HostNetworkInfoDto> InspectNetworkAsync(string host, int port, string username, string authType, string? credential, string? passphrase)
    {
        var tempHost = new HostEntity
        {
            Id = "temp-" + Guid.NewGuid().ToString("N")[..8],
            Name = "Inspect Host",
            Host = host,
            Port = port,
            Username = username,
            AuthType = authType,
            CredentialEncrypted = string.IsNullOrEmpty(credential) ? null : _encryptionService.Encrypt(credential),
            PassphraseEncrypted = string.IsNullOrEmpty(passphrase) ? null : _encryptionService.Encrypt(passphrase)
        };

        return await ExecuteAndParseNetworkAsync(tempHost);
    }

    private async Task<HostNetworkInfoDto> ExecuteAndParseNetworkAsync(HostEntity host)
    {
        var probeScript = _cmdRegistry.GetCommand("Network.Probe");
        var timeout = _cmdRegistry.GetTimeout("Network.Probe", 15);
        var cmdResult = await _sshManager.RunCommandAsync(host, probeScript, timeout);
        var rawOutput = cmdResult.Output ?? "";

        // Extract sections
        string interfacesSection = ExtractSection(rawOutput, "---INTERFACES_JSON---", "---ROUTE_JSON---");
        string routeSection = ExtractSection(rawOutput, "---ROUTE_JSON---", "---RESOLV_CONF---");
        string resolvSection = ExtractSection(rawOutput, "---RESOLV_CONF---", "---GEO_JSON---");
        string geoSection = ExtractSection(rawOutput, "---GEO_JSON---", null);

        // 1. Parse Interfaces
        var interfaces = ParseInterfaces(interfacesSection);

        // 2. Parse Default Gateway
        string? defaultGateway = ParseDefaultGateway(routeSection);

        // 3. Parse DNS
        var dnsServers = ParseDnsServers(resolvSection);

        // 4. Parse GeoIP
        var geoInfo = await ParseOrFetchGeoAsync(geoSection, host.Host);

        return new HostNetworkInfoDto(
            host.Id,
            geoInfo,
            interfaces,
            defaultGateway,
            dnsServers,
            DateTime.UtcNow
        );
    }

    private static string ExtractSection(string text, string startMarker, string? endMarker)
    {
        int start = text.IndexOf(startMarker, StringComparison.Ordinal);
        if (start < 0) return "";
        start += startMarker.Length;

        if (endMarker != null)
        {
            int end = text.IndexOf(endMarker, start, StringComparison.Ordinal);
            if (end >= 0)
            {
                return text[start..end].Trim();
            }
        }

        return text[start..].Trim();
    }

    private List<NetworkInterfaceDetailDto> ParseInterfaces(string jsonText)
    {
        var list = new List<NetworkInterfaceDetailDto>();
        if (string.IsNullOrWhiteSpace(jsonText)) return list;

        try
        {
            if (jsonText.TrimStart().StartsWith("["))
            {
                using var doc = JsonDocument.Parse(jsonText);
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    string name = el.TryGetProperty("ifname", out var pName) ? pName.GetString() ?? "" : "";
                    if (string.IsNullOrEmpty(name)) continue;

                    string state = el.TryGetProperty("operstate", out var pState) ? pState.GetString() ?? "UNKNOWN" : "UNKNOWN";
                    int mtu = el.TryGetProperty("mtu", out var pMtu) && pMtu.TryGetInt32(out var mtuVal) ? mtuVal : 1500;
                    string mac = el.TryGetProperty("address", out var pMac) ? pMac.GetString() ?? "" : "";

                    var flags = new List<string>();
                    if (el.TryGetProperty("flags", out var pFlags) && pFlags.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var f in pFlags.EnumerateArray())
                        {
                            var flagStr = f.GetString();
                            if (!string.IsNullOrEmpty(flagStr)) flags.Add(flagStr);
                        }
                    }

                    var ipv4List = new List<IpAddressDetailDto>();
                    var ipv6List = new List<IpAddressDetailDto>();

                    if (el.TryGetProperty("addr_info", out var pAddrs) && pAddrs.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var addr in pAddrs.EnumerateArray())
                        {
                            string family = addr.TryGetProperty("family", out var pFam) ? pFam.GetString() ?? "" : "";
                            string local = addr.TryGetProperty("local", out var pLoc) ? pLoc.GetString() ?? "" : "";
                            int prefixlen = addr.TryGetProperty("prefixlen", out var pPre) && pPre.TryGetInt32(out var preVal) ? preVal : 0;
                            string scope = addr.TryGetProperty("scope", out var pScp) ? pScp.GetString() ?? "global" : "global";

                            if (string.IsNullOrEmpty(local)) continue;

                            if (family == "inet")
                            {
                                var (netmask, network, broadcast, rangeStart, rangeEnd, totalHosts) = CalculateIpv4Subnet(local, prefixlen);
                                ipv4List.Add(new IpAddressDetailDto(
                                    local,
                                    prefixlen,
                                    $"{local}/{prefixlen}",
                                    netmask,
                                    network,
                                    broadcast,
                                    rangeStart,
                                    rangeEnd,
                                    totalHosts,
                                    scope,
                                    "ipv4"
                                ));
                            }
                            else if (family == "inet6")
                            {
                                ipv6List.Add(new IpAddressDetailDto(
                                    local,
                                    prefixlen,
                                    $"{local}/{prefixlen}",
                                    null,
                                    null,
                                    null,
                                    null,
                                    null,
                                    0,
                                    scope,
                                    "ipv6"
                                ));
                            }
                        }
                    }

                    string ifType = DetermineInterfaceType(name);
                    list.Add(new NetworkInterfaceDetailDto(
                        name,
                        ifType,
                        state.ToUpperInvariant(),
                        mtu,
                        mac,
                        ipv4List,
                        ipv6List,
                        flags
                    ));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error parsing ip -j addr json");
        }

        return list;
    }

    private static string DetermineInterfaceType(string name)
    {
        if (name == "lo") return "loopback";
        if (name.StartsWith("docker") || name.StartsWith("br-")) return "bridge";
        if (name.StartsWith("veth")) return "virtual";
        if (name.StartsWith("wg") || name.StartsWith("tun") || name.StartsWith("tap") || name.StartsWith("tailscale")) return "tunnel";
        if (name.StartsWith("wl")) return "wireless";
        if (name.StartsWith("eth") || name.StartsWith("en") || name.StartsWith("ens") || name.StartsWith("enp")) return "ethernet";
        return "other";
    }

    public static (string netmask, string network, string broadcast, string rangeStart, string rangeEnd, int totalHosts) CalculateIpv4Subnet(string ipStr, int prefix)
    {
        if (prefix < 0 || prefix > 32 || !IPAddress.TryParse(ipStr, out var ip) || ip.AddressFamily != AddressFamily.InterNetwork)
        {
            return ("", "", "", "", "", 0);
        }

        byte[] ipBytes = ip.GetAddressBytes();
        uint ipUint = ((uint)ipBytes[0] << 24) | ((uint)ipBytes[1] << 16) | ((uint)ipBytes[2] << 8) | ipBytes[3];

        uint mask = prefix == 0 ? 0 : 0xFFFFFFFF << (32 - prefix);
        uint netUint = ipUint & mask;
        uint bcastUint = netUint | ~mask;

        byte[] maskBytes = BitConverter.GetBytes(mask);
        if (BitConverter.IsLittleEndian) Array.Reverse(maskBytes);
        var netmask = new IPAddress(maskBytes).ToString();

        byte[] netBytes = BitConverter.GetBytes(netUint);
        if (BitConverter.IsLittleEndian) Array.Reverse(netBytes);
        var network = $"{new IPAddress(netBytes)}/{prefix}";

        byte[] bcastBytes = BitConverter.GetBytes(bcastUint);
        if (BitConverter.IsLittleEndian) Array.Reverse(bcastBytes);
        var broadcast = new IPAddress(bcastBytes).ToString();

        uint startUint = (prefix >= 31) ? netUint : netUint + 1;
        uint endUint = (prefix >= 31) ? bcastUint : bcastUint - 1;

        byte[] startBytes = BitConverter.GetBytes(startUint);
        if (BitConverter.IsLittleEndian) Array.Reverse(startBytes);
        var rangeStart = new IPAddress(startBytes).ToString();

        byte[] endBytes = BitConverter.GetBytes(endUint);
        if (BitConverter.IsLittleEndian) Array.Reverse(endBytes);
        var rangeEnd = new IPAddress(endBytes).ToString();

        long hostsCount = prefix == 32 ? 1 : prefix == 31 ? 2 : (long)bcastUint - netUint - 1;
        int totalHosts = (int)Math.Clamp(hostsCount, 1, int.MaxValue);

        return (netmask, network, broadcast, rangeStart, rangeEnd, totalHosts);
    }

    private static string? ParseDefaultGateway(string routeText)
    {
        if (string.IsNullOrWhiteSpace(routeText)) return null;

        // Try JSON
        try
        {
            if (routeText.TrimStart().StartsWith("["))
            {
                using var doc = JsonDocument.Parse(routeText);
                foreach (var r in doc.RootElement.EnumerateArray())
                {
                    if (r.TryGetProperty("dst", out var pDst) && pDst.GetString() == "default")
                    {
                        string gw = r.TryGetProperty("gateway", out var pGw) ? pGw.GetString() ?? "" : "";
                        string dev = r.TryGetProperty("dev", out var pDev) ? pDev.GetString() ?? "" : "";
                        if (!string.IsNullOrEmpty(gw))
                        {
                            return string.IsNullOrEmpty(dev) ? gw : $"{gw} via {dev}";
                        }
                    }
                }
            }
        }
        catch { }

        // Fallback plain regex
        var match = Regex.Match(routeText, @"default\s+via\s+([^\s]+)(?:\s+dev\s+([^\s]+))?");
        if (match.Success)
        {
            var gw = match.Groups[1].Value;
            var dev = match.Groups[2].Value;
            return string.IsNullOrEmpty(dev) ? gw : $"{gw} via {dev}";
        }

        return null;
    }

    private static List<string> ParseDnsServers(string resolvText)
    {
        var list = new List<string>();
        if (string.IsNullOrWhiteSpace(resolvText)) return list;

        var matches = Regex.Matches(resolvText, @"^\s*nameserver\s+([^\s#]+)", RegexOptions.Multiline);
        foreach (Match m in matches)
        {
            var ns = m.Groups[1].Value.Trim();
            if (!string.IsNullOrEmpty(ns) && !list.Contains(ns))
            {
                list.Add(ns);
            }
        }

        return list;
    }

    private async Task<GeoLocationInfoDto> ParseOrFetchGeoAsync(string geoJson, string hostAddress)
    {
        // Try parsing geoJson from remote curl
        if (!string.IsNullOrWhiteSpace(geoJson) && geoJson.Contains("\"status\":\"success\""))
        {
            try
            {
                using var doc = JsonDocument.Parse(geoJson);
                var root = doc.RootElement;
                string query = root.TryGetProperty("query", out var pQ) ? pQ.GetString() ?? "" : "";
                string country = root.TryGetProperty("country", out var pC) ? pC.GetString() ?? "" : "";
                string countryCode = root.TryGetProperty("countryCode", out var pCc) ? pCc.GetString() ?? "" : "";
                string city = root.TryGetProperty("city", out var pCity) ? pCity.GetString() ?? "" : "";
                string region = root.TryGetProperty("regionName", out var pR) ? pR.GetString() ?? "" : "";
                string isp = root.TryGetProperty("isp", out var pIsp) ? pIsp.GetString() ?? "" : "";
                string org = root.TryGetProperty("org", out var pOrg) ? pOrg.GetString() ?? "" : "";
                string asn = root.TryGetProperty("as", out var pAs) ? pAs.GetString() ?? "" : "";

                double? lat = root.TryGetProperty("lat", out var pLat) && pLat.TryGetDouble(out var latVal) ? latVal : null;
                double? lon = root.TryGetProperty("lon", out var pLon) && pLon.TryGetDouble(out var lonVal) ? lonVal : null;

                return new GeoLocationInfoDto(
                    query,
                    country,
                    countryCode,
                    city,
                    region,
                    isp,
                    org,
                    asn,
                    lat,
                    lon,
                    CountryCodeToFlag(countryCode)
                );
            }
            catch { }
        }

        // Check if hostAddress is private IP
        if (IsPrivateIp(hostAddress))
        {
            return new GeoLocationInfoDto(
                hostAddress,
                "Local Network",
                "LAN",
                "Private Subnet (RFC 1918)",
                "Localhost / Intranet",
                "Private Network",
                "Internal Infrastructure",
                "Private LAN",
                null,
                null,
                "🏠"
            );
        }

        // Fallback: Query ip-api for the target host from backend
        try
        {
            var resp = await _httpClient.GetStringAsync($"http://ip-api.com/json/{hostAddress}?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp,org,as,query");
            using var doc = JsonDocument.Parse(resp);
            var root = doc.RootElement;
            if (root.TryGetProperty("status", out var pSt) && pSt.GetString() == "success")
            {
                string query = root.TryGetProperty("query", out var pQ) ? pQ.GetString() ?? hostAddress : hostAddress;
                string country = root.TryGetProperty("country", out var pC) ? pC.GetString() ?? "" : "";
                string countryCode = root.TryGetProperty("countryCode", out var pCc) ? pCc.GetString() ?? "" : "";
                string city = root.TryGetProperty("city", out var pCity) ? pCity.GetString() ?? "" : "";
                string region = root.TryGetProperty("regionName", out var pR) ? pR.GetString() ?? "" : "";
                string isp = root.TryGetProperty("isp", out var pIsp) ? pIsp.GetString() ?? "" : "";
                string org = root.TryGetProperty("org", out var pOrg) ? pOrg.GetString() ?? "" : "";
                string asn = root.TryGetProperty("as", out var pAs) ? pAs.GetString() ?? "" : "";

                double? lat = root.TryGetProperty("lat", out var pLat) && pLat.TryGetDouble(out var latVal) ? latVal : null;
                double? lon = root.TryGetProperty("lon", out var pLon) && pLon.TryGetDouble(out var lonVal) ? lonVal : null;

                return new GeoLocationInfoDto(
                    query,
                    country,
                    countryCode,
                    city,
                    region,
                    isp,
                    org,
                    asn,
                    lat,
                    lon,
                    CountryCodeToFlag(countryCode)
                );
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to resolve external GeoIP for {Host}", hostAddress);
        }

        return new GeoLocationInfoDto(
            hostAddress,
            "Unknown Location",
            "UN",
            "Unknown City",
            null,
            "Unknown ISP",
            null,
            null,
            null,
            null,
            "🌐"
        );
    }

    private static bool IsPrivateIp(string ipStr)
    {
        if (ipStr.Equals("localhost", StringComparison.OrdinalIgnoreCase) || ipStr == "127.0.0.1" || ipStr == "::1")
            return true;

        if (IPAddress.TryParse(ipStr, out var ip))
        {
            byte[] bytes = ip.GetAddressBytes();
            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                // 10.0.0.0/8
                if (bytes[0] == 10) return true;
                // 172.16.0.0/12
                if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
                // 192.168.0.0/16
                if (bytes[0] == 192 && bytes[1] == 168) return true;
                // 127.0.0.0/8
                if (bytes[0] == 127) return true;
            }
        }

        return false;
    }

    public static string CountryCodeToFlag(string? code)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Length != 2) return "🌐";
        code = code.ToUpperInvariant();
        if (code[0] < 'A' || code[0] > 'Z' || code[1] < 'A' || code[1] > 'Z') return "🌐";

        int first = 0x1F1E6 + (code[0] - 'A');
        int second = 0x1F1E6 + (code[1] - 'A');
        return char.ConvertFromUtf32(first) + char.ConvertFromUtf32(second);
    }
}
