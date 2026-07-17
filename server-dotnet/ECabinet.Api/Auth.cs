using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using ECabinet.Api.Http;

namespace ECabinet.Api;

/// <summary>Payload JWT đã giải mã (port { sub, role, name, iat, exp } của Node).</summary>
public sealed class JwtPayload
{
    public string Sub { get; set; } = "";
    public string Role { get; set; } = "";
    public string? Name { get; set; }
    public long Iat { get; set; }
    public long Exp { get; set; }
}

/// <summary>
/// XÁC THỰC — JWT HS256 (HMACSHA256 + base64url) tự ký, port auth.js.
///
/// ĐỘ LỆCH CHỦ ĐÍCH: mật khẩu dùng PBKDF2-SHA256 (Rfc2898DeriveBytes, 210000 vòng) thay cho
/// scrypt của Node — .NET không có scrypt trong BCL. Định dạng lưu:
///   pbkdf2$&lt;iter&gt;$&lt;saltBase64&gt;$&lt;hashBase64&gt;
/// Seed sẽ hash LẠI mật khẩu bằng hàm này nên không cần migrate; hai backend độc lập về DB.
/// JWT vẫn TƯƠNG THÍCH Node (cùng thuật toán HS256, cùng cấu trúc header/body/sig).
/// </summary>
public static class Auth
{
    private static string Secret => Env.GetOr("JWT_SECRET", "ecabinet-dev-secret-change-me");
    private static int Ttl => Env.GetInt("JWT_TTL", 3600); // access token 1 giờ

    // ---------- base64url (không đệm '=') ----------
    public static string B64Url(byte[] bytes)
        => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static string B64Url(string s) => B64Url(Encoding.UTF8.GetBytes(s));

    public static byte[] B64UrlDecode(string s)
    {
        var t = s.Replace('-', '+').Replace('_', '/');
        switch (t.Length % 4) { case 2: t += "=="; break; case 3: t += "="; break; }
        return Convert.FromBase64String(t);
    }

    // ---------- Mật khẩu (PBKDF2-SHA256) ----------
    private const int PbkdfIter = 210_000;
    private const int SaltLen = 16;
    private const int HashLen = 32;

    public static string HashPassword(string? password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltLen);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password ?? ""), salt, PbkdfIter, HashAlgorithmName.SHA256, HashLen);
        return $"pbkdf2${PbkdfIter}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public static bool VerifyPassword(string? password, string? stored)
    {
        if (string.IsNullOrEmpty(stored)) return false;
        var parts = stored.Split('$');
        if (parts.Length != 4 || parts[0] != "pbkdf2") return false;
        if (!int.TryParse(parts[1], out var iter) || iter <= 0) return false;
        byte[] salt, hash;
        try { salt = Convert.FromBase64String(parts[2]); hash = Convert.FromBase64String(parts[3]); }
        catch { return false; }
        var check = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password ?? ""), salt, iter, HashAlgorithmName.SHA256, hash.Length);
        return CryptographicOperations.FixedTimeEquals(hash, check);
    }

    // ---------- JWT HS256 ----------
    private static byte[] HmacSha256(string key, string data)
    {
        using var h = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        return h.ComputeHash(Encoding.UTF8.GetBytes(data));
    }

    /// <summary>Ký token với payload tùy ý (thêm iat/exp). Port signToken.</summary>
    public static string SignToken(JsonObject payload)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var header = B64Url(J.Stringify(new JsonObject { ["alg"] = "HS256", ["typ"] = "JWT" }));
        var body = J.CloneObj(payload);
        body["iat"] = now;
        body["exp"] = now + Ttl;
        var bodyEnc = B64Url(J.Stringify(body));
        var sig = B64Url(HmacSha256(Secret, $"{header}.{bodyEnc}"));
        return $"{header}.{bodyEnc}.{sig}";
    }

    /// <summary>Tiện dựng token cho user (sub/role/name) — dùng ở login/refresh.</summary>
    public static string SignUser(string sub, string role, string? name)
        => SignToken(new JsonObject { ["sub"] = sub, ["role"] = role, ["name"] = name });

    /// <summary>Xác minh & giải mã token. null nếu sai chữ ký / hết hạn / hỏng. Port verifyToken.</summary>
    public static JwtPayload? VerifyToken(string? token)
    {
        if (string.IsNullOrEmpty(token)) return null;
        var parts = token.Split('.');
        if (parts.Length != 3) return null;
        var (h, b, s) = (parts[0], parts[1], parts[2]);
        var expect = B64Url(HmacSha256(Secret, $"{h}.{b}"));
        // so sánh hằng thời gian (timingSafeEqual) trên chuỗi base64url
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(s), Encoding.UTF8.GetBytes(expect)))
            return null;
        try
        {
            var json = Encoding.UTF8.GetString(B64UrlDecode(b));
            var node = JsonNode.Parse(json) as JsonObject;
            if (node is null) return null;
            var exp = J.Num(node, "exp");
            if (exp.HasValue && exp.Value * 1000 < DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) return null;
            return new JwtPayload
            {
                Sub = J.Str(node, "sub") ?? "",
                Role = J.Str(node, "role") ?? "",
                Name = J.Str(node, "name"),
                Iat = (long)(J.Num(node, "iat") ?? 0),
                Exp = (long)(exp ?? 0),
            };
        }
        catch { return null; }
    }

    // ---------- Middleware ----------
    /// <summary>Yêu cầu đã đăng nhập (Bearer token hợp lệ). Gắn c.User; gửi 401 nếu thiếu/sai. Port requireAuth.</summary>
    public static async Task RequireAuth(Ctx c)
    {
        var header = c.Req.Headers.Authorization.FirstOrDefault() ?? "";
        var token = header.StartsWith("Bearer ") ? header.Substring(7) : null;
        var payload = token != null ? VerifyToken(token) : null;
        if (payload is null)
        {
            await HttpUtil.SendError(c.Res, 401, "Chưa đăng nhập hoặc phiên làm việc đã hết hạn");
            return;
        }
        c.User = payload;
    }

    /// <summary>Yêu cầu vai trò admin (gọi SAU RequireAuth). Port requireAdmin.</summary>
    public static async Task RequireAdmin(Ctx c)
    {
        if (c.User?.Role != "admin")
            await HttpUtil.SendError(c.Res, 403, "Chỉ quản trị viên được thực hiện thao tác này");
    }
}
