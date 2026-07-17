using System.Security.Cryptography;
using System.Text;
using ECabinet.Api.Store;

namespace ECabinet.Api;

/// <summary>
/// PHIÊN REFRESH TOKEN (port sessions.js).
/// - Token ngẫu nhiên 256-bit, chỉ lưu BĂM SHA-256 trong bảng c_sessions (lộ DB không dùng lại được).
/// - XOAY VÒNG: mỗi lần refresh, token cũ bị xóa và cấp token mới (dùng 1 lần).
/// - Thu hồi khi đăng xuất; tự dọn phiên hết hạn.
/// </summary>
public sealed class Sessions
{
    private readonly IDocStore _store;
    public Sessions(IDocStore store) => _store = store;

    private static int RefreshTtlSec => Env.GetInt("REFRESH_TTL_SEC", 7 * 24 * 3600); // mặc định 7 ngày

    private static string HashToken(string? t)
    {
        using var sha = SHA256.Create();
        return Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(t ?? ""))).ToLowerInvariant();
    }

    /// <summary>Cấp refresh token mới cho user; trả token THÔ (chỉ lưu băm).</summary>
    public async Task<string> IssueRefreshToken(string userId)
    {
        var token = Auth.B64Url(RandomNumberGenerator.GetBytes(32));
        var expiresAt = DateTime.UtcNow.AddSeconds(RefreshTtlSec);
        await _store.InsertSessionAsync(HashToken(token), userId, expiresAt);
        return token;
    }

    /// <summary>Đổi refresh token lấy phiên mới (rotation). Trả userId nếu hợp lệ; null nếu sai/hết hạn/đã dùng.</summary>
    public async Task<string?> RotateRefreshToken(string? token)
    {
        var id = HashToken(token);
        var row = await _store.GetSessionAsync(id);
        // dù hợp lệ hay không cũng xóa: token chỉ dùng một lần
        await _store.DeleteSessionAsync(id);
        await _store.DeleteExpiredSessionsAsync(); // dọn rác
        if (row is null) return null;
        if (row.Value.expiresAtUtc < DateTime.UtcNow) return null;
        return row.Value.userId;
    }

    public Task RevokeRefreshToken(string? token) => _store.DeleteSessionAsync(HashToken(token));

    public Task RevokeAllSessions(string userId) => _store.DeleteSessionsOfUserAsync(userId);
}
