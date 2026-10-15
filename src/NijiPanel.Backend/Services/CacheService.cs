using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;

namespace NijiPanel.Backend.Services;

public interface ICacheService
{
    T? Get<T>(string key);
    void Set<T>(string key, T value, TimeSpan? ttl = null);
    Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? ttl = null);
    void Remove(string key);
    void RemoveByPrefix(string prefix);
    void Clear();
}

public class CacheService : ICacheService
{
    private readonly IMemoryCache _memoryCache;
    private readonly ILogger<CacheService> _logger;
    private readonly ConcurrentDictionary<string, Lazy<Task<object?>>> _inFlightTasks = new();
    private readonly ConcurrentDictionary<string, byte> _trackedKeys = new();

    public CacheService(IMemoryCache memoryCache, ILogger<CacheService> logger)
    {
        _memoryCache = memoryCache;
        _logger = logger;
    }

    public T? Get<T>(string key)
    {
        if (_memoryCache.TryGetValue(key, out T? value))
        {
            return value;
        }
        return default;
    }

    public void Set<T>(string key, T value, TimeSpan? ttl = null)
    {
        var options = new MemoryCacheEntryOptions();
        if (ttl.HasValue)
        {
            options.AbsoluteExpirationRelativeToNow = ttl.Value;
        }
        options.RegisterPostEvictionCallback((k, _, _, _) =>
        {
            if (k is string keyStr)
            {
                _trackedKeys.TryRemove(keyStr, out _);
            }
        });

        _memoryCache.Set(key, value, options);
        _trackedKeys.TryAdd(key, 0);
    }

    public async Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? ttl = null)
    {
        // 1. Fast path: already cached
        if (_memoryCache.TryGetValue(key, out T? cachedValue) && cachedValue != null)
        {
            return cachedValue;
        }

        // 2. Slow path with single in-flight factory execution per key
        var lazyTask = _inFlightTasks.GetOrAdd(key, k => new Lazy<Task<object?>>(async () =>
        {
            if (_memoryCache.TryGetValue(k, out T? existing) && existing != null)
            {
                return (object?)existing;
            }

            var value = await factory();
            if (value != null)
            {
                Set(k, value, ttl);
            }
            return (object?)value;
        }));

        try
        {
            var result = await lazyTask.Value;
            return (T)result!;
        }
        finally
        {
            _inFlightTasks.TryRemove(new KeyValuePair<string, Lazy<Task<object?>>>(key, lazyTask));
        }
    }

    public void Remove(string key)
    {
        _memoryCache.Remove(key);
        _trackedKeys.TryRemove(key, out _);
    }

    public void RemoveByPrefix(string prefix)
    {
        var matchingKeys = _trackedKeys.Keys
            .Where(k => k.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            .ToList();

        foreach (var k in matchingKeys)
        {
            _memoryCache.Remove(k);
            _trackedKeys.TryRemove(k, out _);
        }

        if (matchingKeys.Count > 0)
        {
            _logger.LogDebug("Cache invalidated {Count} entries matching prefix '{Prefix}'", matchingKeys.Count, prefix);
        }
    }

    public void Clear()
    {
        foreach (var k in _trackedKeys.Keys)
        {
            _memoryCache.Remove(k);
        }
        _trackedKeys.Clear();
    }
}
