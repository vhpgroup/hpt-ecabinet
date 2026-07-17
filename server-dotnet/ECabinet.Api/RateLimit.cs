using System.Collections.Concurrent;

namespace ECabinet.Api;

/// <summary>Kết quả 1 lần hit (port trả về của hit() trong ratelimit.js).</summary>
public readonly record struct RateResult(bool Ok, int Remaining, int RetryAfterSec);

/// <summary>
/// RATE LIMIT — cửa sổ trượt đơn giản trong bộ nhớ (port ratelimit.js).
/// Toàn cục theo IP + giới hạn riêng cho đăng nhập (IP+tài khoản). Nhiều instance -> thay Redis.
/// Tĩnh (static) để chia sẻ trạng thái toàn tiến trình như module Node.
/// </summary>
public static class RateLimit
{
    private sealed class Bucket { public int Count; public long ResetAt; }

    private static readonly ConcurrentDictionary<string, Bucket> _buckets = new();

    public static RateResult Hit(string key, int max, long windowMs)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        // lấy/tạo bucket nguyên tử; reset khi hết cửa sổ
        var b = _buckets.AddOrUpdate(key,
            _ => new Bucket { Count = 1, ResetAt = now + windowMs },
            (_, cur) =>
            {
                if (cur.ResetAt <= now) { cur.Count = 1; cur.ResetAt = now + windowMs; }
                else cur.Count += 1;
                return cur;
            });
        var count = b.Count;
        var resetAt = b.ResetAt;
        return new RateResult(
            Ok: count <= max,
            Remaining: Math.Max(0, max - count),
            RetryAfterSec: (int)Math.Max(1, Math.Ceiling((resetAt - now) / 1000.0)));
    }

    /// <summary>Xóa toàn bộ bucket (dùng cho test giữa các nhóm để không rò trạng thái).</summary>
    public static void Reset() => _buckets.Clear();
}
