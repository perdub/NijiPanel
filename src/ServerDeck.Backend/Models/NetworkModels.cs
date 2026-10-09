namespace ServerDeck.Backend.Models;

public record GeoLocationInfoDto(
    string? PublicIp,
    string? Country,
    string? CountryCode,
    string? City,
    string? Region,
    string? Isp,
    string? Org,
    string? Asn,
    double? Latitude,
    double? Longitude,
    string? FlagEmoji
);

public record IpAddressDetailDto(
    string Address,
    int PrefixLength,
    string Cidr,
    string? Netmask,
    string? Network,
    string? Broadcast,
    string? RangeStart,
    string? RangeEnd,
    int TotalHosts,
    string Scope,
    string Family // "ipv4" or "ipv6"
);

public record NetworkInterfaceDetailDto(
    string Name,
    string Type, // "ethernet", "wireless", "bridge", "tunnel", "loopback", "virtual"
    string State, // "UP", "DOWN", "UNKNOWN"
    int Mtu,
    string? Mac,
    List<IpAddressDetailDto> Ipv4,
    List<IpAddressDetailDto> Ipv6,
    List<string> Flags
);

public record HostNetworkInfoDto(
    string HostId,
    GeoLocationInfoDto Geo,
    List<NetworkInterfaceDetailDto> Interfaces,
    string? DefaultGateway,
    List<string> DnsServers,
    DateTime CheckedAt
);

public record InspectNetworkRequest(
    string Host,
    int Port = 22,
    string Username = "root",
    string AuthType = "global_key",
    string? Credential = null,
    string? Passphrase = null
);
