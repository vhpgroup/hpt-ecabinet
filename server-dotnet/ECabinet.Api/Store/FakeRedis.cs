using System.Collections.Concurrent;

namespace ECabinet.Api.Store;

// ============================================================
// FAKE REDIS in-process (.NET) — port makeFakeRedis của redis.js. Giả pub/sub +
// INCR/PEXPIRE/PTTL/PING/AUTH/SELECT để test backplane + rate-limit KHÔNG cần socket
// thật (sandbox chặn). Nhiều RespConnection giả nối CÙNG 1 FakeRedisServer -> chia sẻ
// keyspace + bus (mô phỏng App×N nối chung 1 Redis).
// ============================================================
public sealed class FakeRedisServer
{
    private sealed class Entry { public long Value; public long? ExpireAt; }

    private readonly ConcurrentDictionary<string, Entry> _keyspace = new();
    // channel -> danh sách callback (mỗi subscriber 1 callback đẩy 'message')
    private readonly ConcurrentDictionary<string, List<Action<string>>> _subs = new();
    private readonly Func<long> _now;
    private readonly string? _failOn;

    /// <summary>Nhật ký lệnh (assert trong test).</summary>
    public List<string[]> Calls { get; } = new();

    public FakeRedisServer(Func<long>? now = null, string? failOn = null)
    {
        _now = now ?? (() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        _failOn = failOn;
    }

    /// <summary>TTL còn lại (ms) của key — dùng để assert PEXPIRE trong test. -2 nếu không tồn tại, -1 nếu không hạn.</summary>
    public long PttlOf(string key)
    {
        if (!_keyspace.TryGetValue(key, out var e)) return -2;
        if (e.ExpireAt is null) return -1;
        return Math.Max(0, e.ExpireAt.Value - _now());
    }

    internal object? Run(string[] args, Action<string, string> deliverPush)
    {
        lock (Calls) Calls.Add(args);
        var cmd = args[0].ToUpperInvariant();
        if (_failOn is not null && cmd == _failOn) return new RespError($"giả lập lỗi {cmd}");
        switch (cmd)
        {
            case "AUTH": return "OK";
            case "SELECT": return "OK";
            case "PING": return "PONG";
            case "PUBLISH":
            {
                var channel = args[1]; var payload = args[2];
                int count = 0;
                if (_subs.TryGetValue(channel, out var list))
                {
                    List<Action<string>> copy;
                    lock (list) copy = new List<Action<string>>(list);
                    count = copy.Count;
                    // deliverPush chỉ ENQUEUE byte vào inbox subscriber (thread-safe, không chặn) ->
                    // luồng đọc của RespConnection nhặt lên. Gọi trực tiếp cho tất định (test nhanh).
                    foreach (var cb in copy) cb(payload);
                }
                return (long)count;
            }
            case "SUBSCRIBE":
            {
                var channel = args[1];
                var list = _subs.GetOrAdd(channel, _ => new List<Action<string>>());
                lock (list) list.Add(p => deliverPush(channel, p));
                return new object?[] { "subscribe", channel, 1L };
            }
            case "INCR":
            {
                var key = args[1];
                var e = _keyspace.GetOrAdd(key, _ => new Entry { Value = 0, ExpireAt = null });
                lock (e)
                {
                    var alive = e.ExpireAt is null || e.ExpireAt.Value > _now();
                    if (!alive) { e.Value = 0; e.ExpireAt = null; }
                    e.Value += 1;
                    return e.Value;
                }
            }
            case "PEXPIRE":
            {
                var key = args[1]; var ms = long.Parse(args[2]);
                if (!_keyspace.TryGetValue(key, out var e)) return 0L;
                lock (e) e.ExpireAt = _now() + ms;
                return 1L;
            }
            case "PTTL": return PttlOf(args[1]);
            default: return new RespError($"lệnh giả chưa hỗ trợ: {cmd}");
        }
    }

    /// <summary>Factory IRespSocket giả cho backplane (bơm qua socketFactory).</summary>
    public IRespSocket Connect(RedisConfig cfg) => new FakeRespSocket(this);
}

/// <summary>Socket giả — không mạng. WriteAsync giải mã lệnh RESP, chạy trên server giả, trả reply.</summary>
internal sealed class FakeRespSocket : IRespSocket
{
    private readonly FakeRedisServer _server;
    private readonly BlockingCollection<byte[]> _inbox = new();
    private volatile bool _closed;

    public FakeRespSocket(FakeRedisServer server) { _server = server; }

    public Task ConnectAsync() => Task.CompletedTask;

    public Task WriteAsync(byte[] data)
    {
        // 1 write = 1 lệnh (backplane luôn ghi trọn 1 lệnh). Giải mã -> chạy -> đẩy reply vào inbox.
        var (value, consumed) = RespCodec.ParseReply(data, 0);
        if (consumed == 0) return Task.CompletedTask;
        if (value is object?[] arr)
        {
            var args = arr.Select(a => a?.ToString() ?? "").ToArray();
            var reply = _server.Run(args, DeliverPush);
            Enqueue(RespCodec.EncodeReply(reply));
        }
        return Task.CompletedTask;
    }

    private void DeliverPush(string channel, string payload)
    {
        // đẩy 1 mảng RESP ['message', channel, payload] vào inbox như thể đến từ mạng
        Enqueue(RespCodec.EncodeReply(new object?[] { "message", channel, payload }));
    }

    private void Enqueue(byte[] bytes) { if (!_closed) { try { _inbox.Add(bytes); } catch { } } }

    public Task<int> ReadAsync(byte[] buffer)
    {
        return Task.Run(() =>
        {
            try
            {
                var bytes = _inbox.Take();
                var n = Math.Min(bytes.Length, buffer.Length);
                Buffer.BlockCopy(bytes, 0, buffer, 0, n);
                return n;
            }
            catch { return 0; } // đóng
        });
    }

    public void Close()
    {
        if (_closed) return;
        _closed = true;
        try { _inbox.CompleteAdding(); } catch { }
    }
}
