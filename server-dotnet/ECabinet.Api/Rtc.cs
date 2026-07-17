using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using ECabinet.Api.Http;
using ECabinet.Api.Store;

namespace ECabinet.Api;

/// <summary>
/// RTC — Mint LiveKit access token (JWT HS256) bằng crypto thuần (port rtc.js).
/// GATED: chỉ hoạt động khi có LIVEKIT_URL/API_KEY/API_SECRET; thiếu -> /token trả 501.
/// LiveKit access token = JWT HS256 ký bằng LIVEKIT_API_SECRET, payload iss/sub/name/nbf/iat/exp/video.
/// </summary>
public sealed class Rtc
{
    private readonly IDocStore _store;
    public Rtc(IDocStore store) => _store = store;

    private static readonly string[] Manage = { "admin", "secretary", "chairman" };

    public static bool Configured()
        => Env.Has("LIVEKIT_URL") && Env.Has("LIVEKIT_API_KEY") && Env.Has("LIVEKIT_API_SECRET");

    public static string Url() => Env.GetOr("LIVEKIT_URL", "");

    /// <summary>Ký LiveKit access token (JWT HS256). Port mintLiveKitToken.</summary>
    public static string MintLiveKitToken(string identity, string? name, string room, int ttlSec = 6 * 3600)
    {
        var apiKey = Env.Get("LIVEKIT_API_KEY");
        var apiSecret = Env.Get("LIVEKIT_API_SECRET");
        if (string.IsNullOrEmpty(apiKey) || string.IsNullOrEmpty(apiSecret))
            throw new Exception("RTC chưa cấu hình (thiếu LIVEKIT_API_KEY/SECRET)");
        if (string.IsNullOrEmpty(identity)) throw new Exception("Thiếu identity");
        if (string.IsNullOrEmpty(room)) throw new Exception("Thiếu room");

        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var header = Auth.B64Url(J.Stringify(new JsonObject { ["alg"] = "HS256", ["typ"] = "JWT" }));
        var payload = new JsonObject
        {
            ["iss"] = apiKey,
            ["sub"] = identity,
        };
        if (!string.IsNullOrEmpty(name)) payload["name"] = name;
        payload["nbf"] = now;
        payload["iat"] = now;
        payload["exp"] = now + Math.Max(60, ttlSec);
        payload["video"] = new JsonObject
        {
            ["roomJoin"] = true,
            ["room"] = room,
            ["canPublish"] = true,
            ["canSubscribe"] = true,
            ["canPublishData"] = true,
        };
        var body = Auth.B64Url(J.Stringify(payload));
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(apiSecret));
        var sig = Auth.B64Url(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{header}.{body}")));
        return $"{header}.{body}.{sig}";
    }

    public void Register(Router app)
    {
        // LƯU Ý thứ tự: /api/rtc/* PHẢI đăng ký TRƯỚC CRUD chung /api/:collection.
        app.Add("GET", "/api/rtc/config", Auth.RequireAuth, async c =>
        {
            await HttpUtil.Send(c.Res, 200, new JsonObject { ["enabled"] = Configured() });
        });

        app.Add("POST", "/api/rtc/token", Auth.RequireAuth, async c =>
        {
            if (!Configured()) { await HttpUtil.SendError(c.Res, 501, "RTC chưa cấu hình"); return; }
            var body = await HttpUtil.ReadBodyObj(c.Req);
            var meetingId = (J.Str(body, "meetingId") ?? "").Trim();
            if (string.IsNullOrEmpty(meetingId)) { await HttpUtil.SendError(c.Res, 400, "Thiếu meetingId"); return; }

            var meeting = await _store.GetByIdAsync("c_meetings", meetingId);
            if (meeting is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy phiên họp"); return; }

            var parts = J.Arr(meeting, "participants") ?? new JsonArray();
            var isMember = parts.OfType<JsonObject>().Any(p => J.Str(p, "userId") == c.User!.Sub);
            var isManage = Manage.Contains(c.User!.Role);
            if (!isMember && !isManage) { await HttpUtil.SendError(c.Res, 403, "Bạn không thuộc thành phần phiên họp này"); return; }

            var profile = await _store.GetByIdAsync("c_users", c.User.Sub);
            var name = profile is not null ? (J.Str(profile, "fullName") ?? c.User.Name ?? c.User.Sub) : (c.User.Name ?? c.User.Sub);
            var room = $"meeting-{meetingId}";
            var token = MintLiveKitToken(c.User.Sub, name, room);
            await HttpUtil.Send(c.Res, 200, new JsonObject
            {
                ["url"] = Url(), ["token"] = token, ["room"] = room, ["identity"] = c.User.Sub,
            });
        });
    }
}
