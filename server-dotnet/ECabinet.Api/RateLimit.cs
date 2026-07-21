using System.Collections.Concurrent;

namespace ECabinet.Api;

/// <summary>Kết quả 1 lần hit (port trả về của hit() trong ratelimit.js).</summary>
public readonly record struct RateResult(bool Ok, int Remaining, int RetryAfterSec);

/// <summary>
/// RATE LIMIT — cửa sổ trượt đơn giản trong bộ nhớ (port ratelimit.js).
/// Toàn cục theo IP + giới hạn riêng cho đăng nhập (IP+tài khoản).
/// Tĩnh (static) để chia sẻ trạng thái toàn tiến trình như module Node.
///
/// SCALE NGANG (App×2 sau LB): khi Redis backplane BẬT, HitAsync đếm CHUNG toàn cụm
/// qua INCR+PEXPIRE (Store/RedisBackplane.cs) -> không lách được bằng đổi instance.
/// Redis rớt -> FAIL-OPEN (cho qua). Redis TẮT (mặc định) -> Bucket in-RAM như cũ (Hit()).
/// </summary>
public static class RateLimit
{
    private sealed class Bucket { public int Count; public long ResetAt; }

    private static readonly ConcurrentDictionary<string, Bucket> _buckets = new();

    /// <summary>Backplane Redis (nếu bật) — đặt 1 lần lúc boot. Null -> luôn dùng Bucket in-RAM.</summary>
    private static ECabinet.Api.Store.IRedisBackplane? _backplane;
    public static void SetBackplane(ECabinet.Api.Store.IRedisBackplane? bp) => _backplane = bp;

    /// <summary>
    /// Rate-limit hợp nhất (parity rateHit của index.js). Redis BẬT -> đếm chung; rớt -> fail-open;
    /// TẮT -> Bucket in-RAM. Trả cùng shape RateResult.
    /// </summary>
    public static async Task<RateResult> HitAsync(string key, int max, long windowMs)
    {
        var bp = _backplane;
        if (bp is not null && bp.Up)
        {
            var r = await bp.RateHitAsync(key, max, windowMs);
            if (r is { } v) return new RateResult(v.Ok, v.Remaining, v.RetryAfterSec);
            // Redis vừa rớt -> FAIL-OPEN (cho qua, không tụt về Map để tránh đếm lệch nửa vời)
            return new RateResult(true, max, 1);
        }
        return Hit(key, max, windowMs);
    }

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
