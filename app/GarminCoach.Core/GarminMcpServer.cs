namespace GarminCoach.Core;

/// <summary>Where to reach the Garmin MCP server, and the Garmin key to use for the connection.</summary>
public sealed record GarminMcpServer(string BaseUrl, string ToolNamespace = "garmin")
{
    /// <summary>The address the Android emulator uses to reach the developer's machine.</summary>
    public const string DefaultBaseUrl = "http://10.0.2.2:8000";

    /// <summary>The address a server bound to the developer's machine listens on by default.</summary>
    public const string DefaultHost = "127.0.0.1";
    public const int DefaultPort = 8000;

    /// <summary>Settings key holding an override for the server address.</summary>
    public const string BaseUrlKey = "garmin.server.url";

    public static GarminMcpServer Create(string? baseUrl) => new(NormalizeUrl(baseUrl));

    /// <summary>A usable, slash-terminated base URL, defaulting to the emulator's host address.</summary>
    public static string NormalizeUrl(string? baseUrl)
    {
        var text = (baseUrl ?? "").Trim();
        if (text.Length == 0) return DefaultBaseUrl.TrimEnd('/') + "/";
        if (!text.Contains("://", StringComparison.Ordinal)) text = "http://" + text.TrimStart('/');
        return text.TrimEnd('/') + "/";
    }

    /// <summary>True when the server runs on this device, the emulator host or the local machine.</summary>
    public bool IsLocalHost => IsLocalHostName(Endpoint.Host);

    public Uri Endpoint => new(NormalizeUrl(BaseUrl));

    public static bool IsLocalHostName(string? host) =>
        !string.IsNullOrWhiteSpace(host) &&
        (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(host, "10.0.2.2", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(host, "::1", StringComparison.OrdinalIgnoreCase) ||
         host.StartsWith("127.", StringComparison.Ordinal));

    /// <summary>The listen port, falling back to the default when the value is not a real port.</summary>
    public static int NormalizePort(int port) => port is >= 1 and <= 65535 ? port : DefaultPort;

    /// <summary>The address a server should bind to, defaulting to the loopback interface.</summary>
    public static string NormalizeHost(string? host) =>
        string.IsNullOrWhiteSpace(host) ? DefaultHost : host.Trim();
}