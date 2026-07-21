using System.Collections.Concurrent;
using System.Net.Sockets;
using System.Net.Security;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ECabinet.Api.Store;

// ============================================================
// REDIS BACKPLANE (.NET) — port server/src/redis.js. Client RESP tối giản TỰ VIẾT.
//
// MỤC ĐÍCH: chạy App×2 sau cân bằng tải (mô hình 4 cụm HSMT) bằng cách đồng bộ 2 thứ
// đang là state per-process: (1) WebSocket realtime broadcast -> Redis Pub/Sub
// (kênh `ecabinet:changes`); (2) rate-limit theo IP -> INCR + PEXPIRE (đếm CHUNG).
//
// TRIẾT LÝ (giống BlobStore.cs SigV4 tự viết): KHÔNG thêm NuGet. Nói RESP TRỰC TIẾP
// qua System.Net.Sockets.TcpClient. GATED — TƯƠNG THÍCH NGƯỢC: không REDIS_URL ->
// Configured()=false -> Realtime phát local + RateLimit dùng ConcurrentDictionary như cũ.
//
// FALLBACK: Redis rớt -> WS về fanout local + tự kết nối lại lũy tiến; rate-limit
// FAIL-OPEN (cho qua). PING keepalive. Lớp RESP (RespCodec) + fake (FakeRedis) test được
// không cần socket thật (sandbox chặn) — parity với Node.
// ============================================================

/// <summary>Cấu hình Redis từ REDIS_URL=redis://[:password@]host:port[/db] (+ rediss:// TLS).</summary>
public sealed record RedisConfig(string Host, int Port, string Password, string Username, int Db, bool Tls)
{
    public static RedisConfig? Parse(string? raw)
    {
        if (string.IsNullOrEmpty(raw)) return null;
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var u)) return null;
        var scheme = u.Scheme.ToLowerInvariant();
        if (scheme != "redis" && scheme != "rediss") return null;

        var db = 0;
        if (u.AbsolutePath.Length > 1 && int.TryParse(u.AbsolutePath.Substring(1), out var parsed)) db = parsed;

        // userinfo: ":pass" (chỉ password) hoặc "user:pass" (ACL Redis 6)
        var user = ""; var pass = "";
        var ui = u.UserInfo ?? "";
        if (ui.Length > 0)
        {
            var idx = ui.IndexOf(':');
            if (idx >= 0) { user = Uri.UnescapeDataString(ui.Substring(0, idx)); pass = Uri.UnescapeDataString(ui.Substring(idx + 1)); }
            else { pass = Uri.UnescapeDataString(ui); } // "pass@" không có ':' -> coi là password
        }
        // dạng ":pass@" -> user rỗng, pass có; dạng "user:pass@" -> cả hai
        return new RedisConfig(
            string.IsNullOrEmpty(u.Host) ? "127.0.0.1" : u.Host,
            u.Port > 0 ? u.Port : 6379,
            pass, user, db, scheme == "rediss");
    }

    public static RedisConfig? FromEnv() => Parse(Environment.GetEnvironmentVariable("REDIS_URL"));
}

// ============================================================
// RESP encode/parse — HÀM THUẦN (static), test-vector byte. Parity phần 1 của redis.js.
// ============================================================
public static class RespCodec
{
    private static readonly byte[] Crlf = { 0x0d, 0x0a };

    /// <summary>Mã hóa 1 lệnh Redis thành mảng Bulk String (dạng lệnh chuẩn). Trả byte[].</summary>
    public static byte[] EncodeCommand(params string[] args)
    {
        var ms = new MemoryStream();
        WriteAscii(ms, $"*{args.Length}\r\n");
        foreach (var a in args)
        {
            var bytes = Encoding.UTF8.GetBytes(a);
            WriteAscii(ms, $"${bytes.Length}\r\n");
            ms.Write(bytes, 0, bytes.Length);
            ms.Write(Crlf, 0, 2);
        }
        return ms.ToArray();
    }

    private static void WriteAscii(Stream s, string txt)
    {
        var b = Encoding.ASCII.GetBytes(txt);
        s.Write(b, 0, b.Length);
    }

    /// <summary>
    /// Phân tích MỘT reply RESP từ đầu buffer[offset..]. Trả (value, consumed) khi đủ 1 reply,
    /// hoặc (null, 0) nếu chưa đủ byte. value: string | long | RespError | object?[] | null.
    /// </summary>
    public static (object? Value, int Consumed) ParseReply(byte[] buf, int offset = 0)
    {
        if (offset >= buf.Length) return (null, 0);
        var type = (char)buf[offset];
        var nl = IndexOfCrlf(buf, offset + 1);
        if (nl < 0) return (null, 0);
        var line = Encoding.UTF8.GetString(buf, offset + 1, nl - (offset + 1));
        var afterLine = nl + 2;

        switch (type)
        {
            case '+': return (line, afterLine - offset);
            case '-': return (new RespError(line), afterLine - offset);
            case ':': return (long.TryParse(line, out var n) ? n : 0L, afterLine - offset);
            case '$':
            {
                var len = int.Parse(line);
                if (len == -1) return (null, afterLine - offset);
                var end = afterLine + len;
                if (buf.Length < end + 2) return (null, 0); // chưa đủ payload + CRLF
                var val = Encoding.UTF8.GetString(buf, afterLine, len);
                return (val, end + 2 - offset);
            }
            case '*':
            {
                var count = int.Parse(line);
                if (count == -1) return (null, afterLine - offset);
                var arr = new object?[count];
                var pos = afterLine;
                for (var i = 0; i < count; i++)
                {
                    var (item, consumed) = ParseReply(buf, pos);
                    if (consumed == 0) return (null, 0); // chưa đủ -> chờ thêm
                    arr[i] = item;
                    pos += consumed;
                }
                return (arr, pos - offset);
            }
            default:
                return (new RespError($"RESP không nhận dạng: {type}"), afterLine - offset);
        }
    }

    private static int IndexOfCrlf(byte[] buf, int from)
    {
        for (var i = from; i < buf.Length - 1; i++)
            if (buf[i] == 0x0d && buf[i + 1] == 0x0a) return i;
        return -1;
    }

    /// <summary>Mã hóa 1 reply JS -> byte[] RESP (đối xứng ParseReply). Dùng cho fake.</summary>
    public static byte[] EncodeReply(object? reply)
    {
        switch (reply)
        {
            case null: return Encoding.ASCII.GetBytes("$-1\r\n");
            case long l: return Encoding.ASCII.GetBytes($":{l}\r\n");
            case int i: return Encoding.ASCII.GetBytes($":{i}\r\n");
            case RespError e: return Encoding.UTF8.GetBytes($"-{e.Message}\r\n");
            case string s: return Encoding.UTF8.GetBytes($"+{s}\r\n");
            case object?[] arr:
            {
                var ms = new MemoryStream();
                var head = Encoding.ASCII.GetBytes($"*{arr.Length}\r\n");
                ms.Write(head, 0, head.Length);
                foreach (var it in arr) { var b = EncodeReply(it); ms.Write(b, 0, b.Length); }
                return ms.ToArray();
            }
            default: return Encoding.ASCII.GetBytes("$-1\r\n");
        }
    }
}

/// <summary>Reply lỗi RESP ("-ERR ..."). KHÔNG throw ở tầng parse — tầng trên quyết.</summary>
public sealed record RespError(string Message);

/// <summary>Kết quả rate-limit (parity RateResult của RateLimit.cs).</summary>
public readonly record struct RedisRateResult(bool Ok, int Remaining, int RetryAfterSec);

// ============================================================
// Hợp đồng backplane — cho phép bơm FakeRedis trong test (parity IBlobStore).
// ============================================================
public interface IRedisBackplane
{
    bool Configured();
    bool Up { get; }
    Task StartAsync();
    void Stop();
    /// <summary>PUBLISH sự kiện change. true = đã publish (caller KHÔNG fanout local); false = fallback local.</summary>
    Task<bool> PublishChangeAsync(JsonObject ev);
    /// <summary>INCR+PEXPIRE. null = Redis không sẵn sàng (caller fail-open / dùng Map).</summary>
    Task<RedisRateResult?> RateHitAsync(string key, int max, long windowMs);
}

// ============================================================
// KẾT NỐI RESP đơn (1 TcpClient). Handshake AUTH/SELECT, gửi lệnh + ghép reply FIFO,
// chế độ SUBSCRIBE đẩy message về onPush. Bơm IRespSocket để test bằng fake.
// ============================================================
public interface IRespSocket
{
    Task ConnectAsync();
    Task WriteAsync(byte[] data);
    /// <summary>Đọc dữ liệu tới; trả 0 khi đóng. Ghi vào buffer.</summary>
    Task<int> ReadAsync(byte[] buffer);
    void Close();
}

/// <summary>Socket thật qua TcpClient (+ SslStream nếu rediss://).</summary>
public sealed class TcpRespSocket : IRespSocket
{
    private readonly RedisConfig _cfg;
    private TcpClient? _tcp;
    private Stream? _stream;

    public TcpRespSocket(RedisConfig cfg) { _cfg = cfg; }

    public async Task ConnectAsync()
    {
        _tcp = new TcpClient { NoDelay = true };
        await _tcp.ConnectAsync(_cfg.Host, _cfg.Port);
        Stream s = _tcp.GetStream();
        if (_cfg.Tls)
        {
            var ssl = new SslStream(s, false);
            await ssl.AuthenticateAsClientAsync(_cfg.Host);
            s = ssl;
        }
        _stream = s;
    }

    public Task WriteAsync(byte[] data) => _stream!.WriteAsync(data, 0, data.Length);
    public Task<int> ReadAsync(byte[] buffer) => _stream!.ReadAsync(buffer, 0, buffer.Length);
    public void Close() { try { _stream?.Dispose(); } catch { } try { _tcp?.Close(); } catch { } }
}

internal sealed class RespConnection
{
    private readonly RedisConfig _cfg;
    private readonly IRespSocket _socket;
    private readonly Action<object?[]>? _onPush;
    private readonly Action<Exception?>? _onClose;
    private readonly ConcurrentQueue<TaskCompletionSource<object?>> _waiters = new();
    private byte[] _buffer = Array.Empty<byte>();
    private bool _subscribed;
    private volatile bool _closed;

    public RespConnection(RedisConfig cfg, IRespSocket socket, Action<object?[]>? onPush = null, Action<Exception?>? onClose = null)
    {
        _cfg = cfg; _socket = socket; _onPush = onPush; _onClose = onClose;
    }

    public bool Closed => _closed;

    public async Task ConnectAsync()
    {
        await _socket.ConnectAsync();
        _ = ReadLoop(); // vòng đọc nền
        if (!string.IsNullOrEmpty(_cfg.Password))
        {
            var r = string.IsNullOrEmpty(_cfg.Username)
                ? await Command("AUTH", _cfg.Password)
                : await Command("AUTH", _cfg.Username, _cfg.Password);
            if (r is RespError e) throw new Exception($"AUTH thất bại: {e.Message}");
        }
        if (_cfg.Db > 0)
        {
            var r = await Command("SELECT", _cfg.Db.ToString());
            if (r is RespError e) throw new Exception($"SELECT {_cfg.Db} thất bại: {e.Message}");
        }
    }

    private async Task ReadLoop()
    {
        var chunk = new byte[8192];
        try
        {
            while (!_closed)
            {
                var n = await _socket.ReadAsync(chunk);
                if (n <= 0) { Destroy(new Exception("kết nối Redis đóng")); return; }
                var grown = new byte[_buffer.Length + n];
                Buffer.BlockCopy(_buffer, 0, grown, 0, _buffer.Length);
                Buffer.BlockCopy(chunk, 0, grown, _buffer.Length, n);
                _buffer = grown;
                for (;;)
                {
                    var (value, consumed) = RespCodec.ParseReply(_buffer, 0);
                    if (consumed == 0) break;
                    var rest = new byte[_buffer.Length - consumed];
                    Buffer.BlockCopy(_buffer, consumed, rest, 0, rest.Length);
                    _buffer = rest;
                    Dispatch(value);
                }
            }
        }
        catch (Exception ex) { Destroy(ex); }
    }

    private void Dispatch(object? value)
    {
        // chế độ subscribe: ['message', channel, payload] -> onPush; xác nhận SUBSCRIBE -> waiter
        if (_subscribed && value is object?[] arr && arr.Length > 0 && (arr[0] as string) == "message")
        {
            _onPush?.Invoke(arr);
            return;
        }
        if (_waiters.TryDequeue(out var w)) w.TrySetResult(value);
        else if (value is object?[] a) _onPush?.Invoke(a);
    }

    public async Task<object?> Command(params string[] args)
    {
        if (_closed) return new RespError("kết nối đã đóng");
        var tcs = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
        _waiters.Enqueue(tcs);
        try { await _socket.WriteAsync(RespCodec.EncodeCommand(args)); }
        catch (Exception e) { tcs.TrySetResult(new RespError(e.Message)); }
        return await tcs.Task;
    }

    public async Task Subscribe(string channel)
    {
        _subscribed = true;
        var r = await Command("SUBSCRIBE", channel);
        if (r is RespError e) throw new Exception($"SUBSCRIBE {channel} thất bại: {e.Message}");
    }

    public void Destroy(Exception? err)
    {
        if (_closed) return;
        _closed = true;
        while (_waiters.TryDequeue(out var w)) w.TrySetResult(new RespError("kết nối Redis mất"));
        try { _socket.Close(); } catch { }
        _onClose?.Invoke(err);
    }
}

// ============================================================
// REDIS BACKPLANE thật: 2 kết nối (1 SUBSCRIBE, 1 lệnh) + reconnect lũy tiến + ping.
// ============================================================
public sealed class RedisBackplane : IRedisBackplane
{
    public const string ChangesChannel = "ecabinet:changes";
    private const int ReconnectMaxMs = 15000;

    private readonly RedisConfig? _cfg;
    private readonly Action<JsonObject> _onMessage;
    private readonly Func<RedisConfig, IRespSocket> _socketFactory;
    private readonly Action<string, string> _log;
    private readonly int _pingMs;

    private RespConnection? _pub;
    private RespConnection? _sub;
    private volatile bool _up;
    private int _retry;
    private volatile bool _stopped;
    private Timer? _pingTimer;
    private readonly object _gate = new();

    public RedisBackplane(RedisConfig? cfg, Action<JsonObject> onMessage,
        Func<RedisConfig, IRespSocket>? socketFactory = null, Action<string, string>? log = null)
    {
        _cfg = cfg;
        _onMessage = onMessage;
        _socketFactory = socketFactory ?? (c => new TcpRespSocket(c));
        _log = log ?? ((lvl, m) => Console.WriteLine(m));
        _pingMs = int.TryParse(Environment.GetEnvironmentVariable("REDIS_PING_MS"), out var p) ? p : 30000;
    }

    public bool Configured() => _cfg is not null;
    public bool Up => _up;

    public async Task StartAsync()
    {
        if (_cfg is null || _stopped) return;
        await OpenBoth();
    }

    private async Task OpenBoth()
    {
        if (_stopped || _cfg is null) return;
        try
        {
            _pub = new RespConnection(_cfg, _socketFactory(_cfg), onClose: _ => OnDrop("pub"));
            _sub = new RespConnection(_cfg, _socketFactory(_cfg), onPush: OnPush, onClose: _ => OnDrop("sub"));
            await _pub.ConnectAsync();
            await _sub.ConnectAsync();
            await _sub.Subscribe(ChangesChannel);
            _up = true;
            _retry = 0;
            _log("log", $"[redis] backplane BẬT — pub/sub {_cfg.Host}:{_cfg.Port} db={_cfg.Db} kênh={ChangesChannel}");
            StartPing();
        }
        catch (Exception e)
        {
            _up = false;
            _log("warn", $"[redis] không kết nối được ({e.Message}) — WS về fanout LOCAL, rate-limit fail-open; sẽ thử lại");
            ScheduleReconnect();
        }
    }

    private void OnPush(object?[] arr)
    {
        if (arr.Length < 3 || (arr[0] as string) != "message") return;
        try
        {
            var node = JsonNode.Parse(arr[2] as string ?? "");
            if (node is JsonObject obj) _onMessage(obj); // fanout local ĐÚNG 1 lần
        }
        catch { /* payload lạ — bỏ qua */ }
    }

    private void OnDrop(string which)
    {
        lock (_gate)
        {
            if (_stopped) return;
            if (_up) _log("warn", $"[redis] mất kết nối ({which}) — CHUYỂN fanout LOCAL-only + rate-limit fail-open; tự kết nối lại");
            _up = false;
            StopPing();
            try { _pub?.Destroy(null); } catch { }
            try { _sub?.Destroy(null); } catch { }
            ScheduleReconnect();
        }
    }

    private void ScheduleReconnect()
    {
        if (_stopped) return;
        var delay = (int)Math.Min(ReconnectMaxMs, 1500 * Math.Pow(1.7, _retry++));
        _ = Task.Delay(delay).ContinueWith(_ => { if (!_stopped) _ = OpenBoth(); });
    }

    private void StartPing()
    {
        StopPing();
        _pingTimer = new Timer(async _ =>
        {
            if (!_up || _pub is null) return;
            try
            {
                var r = await _pub.Command("PING");
                if (r is RespError e) throw new Exception(e.Message);
            }
            catch (Exception ex)
            {
                _log("warn", $"[redis] PING lỗi ({ex.Message}) — coi như mất kết nối");
                OnDrop("ping");
            }
        }, null, _pingMs, _pingMs);
    }

    private void StopPing() { _pingTimer?.Dispose(); _pingTimer = null; }

    public async Task<bool> PublishChangeAsync(JsonObject ev)
    {
        if (!_up || _pub is null) return false;
        try
        {
            var r = await _pub.Command("PUBLISH", ChangesChannel, J.Stringify(ev));
            if (r is RespError e) throw new Exception(e.Message);
            return true;
        }
        catch (Exception ex)
        {
            _log("warn", $"[redis] PUBLISH lỗi ({ex.Message}) — fallback fanout LOCAL");
            OnDrop("publish");
            return false;
        }
    }

    public async Task<RedisRateResult?> RateHitAsync(string key, int max, long windowMs)
    {
        if (!_up || _pub is null) return null;
        try
        {
            var n = await _pub.Command("INCR", key);
            if (n is RespError e) throw new Exception(e.Message);
            var count = Convert.ToInt64(n);
            long ttlMs = windowMs;
            if (count == 1)
            {
                var px = await _pub.Command("PEXPIRE", key, windowMs.ToString());
                if (px is RespError pe) throw new Exception(pe.Message);
            }
            else
            {
                var pttl = await _pub.Command("PTTL", key);
                if (pttl is long v && v > 0) ttlMs = v;
            }
            return new RedisRateResult(
                Ok: count <= max,
                Remaining: (int)Math.Max(0, max - count),
                RetryAfterSec: (int)Math.Max(1, Math.Ceiling(ttlMs / 1000.0)));
        }
        catch (Exception ex)
        {
            _log("warn", $"[redis] rate-limit INCR lỗi ({ex.Message}) — FAIL-OPEN (cho qua)");
            OnDrop("ratelimit");
            return null;
        }
    }

    public void Stop()
    {
        _stopped = true;
        _up = false;
        StopPing();
        try { _pub?.Destroy(null); } catch { }
        try { _sub?.Destroy(null); } catch { }
    }
}
