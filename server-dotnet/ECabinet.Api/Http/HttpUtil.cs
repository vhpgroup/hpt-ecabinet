using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;

namespace ECabinet.Api.Http;

/// <summary>Lỗi nghiệp vụ mang mã HTTP (tương đương Object.assign(new Error(msg), {status}) của Node).</summary>
public sealed class HttpError : Exception
{
    public int Status { get; }
    public HttpError(int status, string message) : base(message) => Status = status;
}

/// <summary>
/// Tiện ích HTTP — gửi JSON + CORS + đọc body an toàn. Port util.js.
/// CORS: Access-Control-Allow-Origin = CORS_ORIGIN ?? '*'.
/// </summary>
public static class HttpUtil
{
    public static string CorsOrigin() => Env.GetOr("CORS_ORIGIN", "*");

    public static void ApplyCors(HttpResponse res)
    {
        var h = res.Headers;
        h["Access-Control-Allow-Origin"] = CorsOrigin();
        h["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
        h["Access-Control-Allow-Methods"] = "GET,POST,PATCH,PUT,DELETE,OPTIONS";
        h["Access-Control-Max-Age"] = "86400";
    }

    /// <summary>Gửi JSON (JsonNode) với status + CORS. status 204 -> không body.</summary>
    public static async Task Send(HttpResponse res, int status, JsonNode? obj = null)
    {
        if (res.HasStarted) return;
        res.StatusCode = status;
        ApplyCors(res);
        if (status == 204)
        {
            await res.CompleteAsync();
            return;
        }
        var body = J.Stringify(obj ?? new JsonObject());
        var bytes = Encoding.UTF8.GetBytes(body);
        res.ContentType = "application/json; charset=utf-8";
        res.ContentLength = bytes.Length;
        await res.Body.WriteAsync(bytes);
    }

    /// <summary>Gửi lỗi { error }.</summary>
    public static Task SendError(HttpResponse res, int status, string message)
        => Send(res, status, new JsonObject { ["error"] = message });

    /// <summary>
    /// Đọc body JSON (giới hạn 25MB như Node). Trả null nếu rỗng.
    /// Ném HttpError(400) nếu JSON hỏng, HttpError(413) nếu quá lớn.
    /// </summary>
    public static async Task<JsonNode?> ReadBody(HttpRequest req, long limitBytes = 25L * 1024 * 1024)
    {
        if (req.ContentLength is > 0 and var cl && cl > limitBytes)
            throw new HttpError(413, "Dữ liệu gửi lên quá lớn (giới hạn 25MB)");

        using var ms = new MemoryStream();
        var buffer = new byte[81920];
        int read;
        long total = 0;
        while ((read = await req.Body.ReadAsync(buffer)) > 0)
        {
            total += read;
            if (total > limitBytes)
                throw new HttpError(413, "Dữ liệu gửi lên quá lớn (giới hạn 25MB)");
            ms.Write(buffer, 0, read);
        }
        if (ms.Length == 0) return null;
        try
        {
            return JsonNode.Parse(Encoding.UTF8.GetString(ms.ToArray()));
        }
        catch
        {
            throw new HttpError(400, "JSON không hợp lệ");
        }
    }

    /// <summary>Đọc body và ép về JsonObject; body rỗng -> object rỗng (tương đương `(await readBody(req)) ?? {}`).</summary>
    public static async Task<JsonObject> ReadBodyObj(HttpRequest req)
    {
        var node = await ReadBody(req);
        return node as JsonObject ?? new JsonObject();
    }

    /// <summary>IP client — port clientIp(): x-real-ip / x-forwarded-for / remote.</summary>
    public static string ClientIp(HttpRequest req)
    {
        var fwd = req.Headers["x-real-ip"].FirstOrDefault() ?? req.Headers["x-forwarded-for"].FirstOrDefault();
        var raw = !string.IsNullOrEmpty(fwd) ? fwd : (req.HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown");
        return raw.Split(',')[0].Trim();
    }
}
