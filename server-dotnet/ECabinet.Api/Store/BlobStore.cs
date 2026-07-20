using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace ECabinet.Api.Store;

/// <summary>
/// TẦNG OBJECT STORAGE (S3/MinIO) — port blob.js sang .NET (BCL thuần).
///
/// TRIẾT LÝ: KHÔNG thêm NuGet (không AWSSDK). Ký AWS Signature V4 TỰ VIẾT bằng
/// System.Security.Cryptography (HMACSHA256/SHA256), gọi S3 REST qua HttpClient.
///
/// GATED — TƯƠNG THÍCH NGƯỢC: Configured()=false khi thiếu env S3 -> tầng ghi/đọc
/// GIỮ base64 trong cột NVARCHAR(MAX) như cũ. Đặt đủ env -> tách file mới sang S3,
/// DB lưu storageKey; bản ghi cũ có dataUrl vẫn đọc bình thường.
///
/// HÀM TÁCH/DỰNG + SigV4 tách riêng (static, thuần) để TEST không cần S3 thật —
/// SigV4 kiểm bằng test-vector chính thức của AWS; round-trip kiểm bằng IBlobStore giả.
/// </summary>
public interface IBlobStore
{
    bool Configured();
    Task PutAsync(string key, byte[] bytes, string? contentType);
    Task<byte[]> GetAsync(string key);
    Task DeleteAsync(string key);

    /// <summary>
    /// TỐI ƯU 1 — presigned GET URL TTL ngắn để client tải THẲNG từ S3 (không nạp RAM backend).
    /// filename -> gắn response-content-disposition=attachment (tải đúng tên, kể cả tiếng Việt).
    /// KHÔNG I/O (chỉ ký). Ném nếu S3 chưa cấu hình (điểm gọi đã kiểm Configured() trước).
    /// </summary>
    string PresignGetUrl(string key, int ttlSec = 300, string? filename = null, string? contentType = null);
}

/// <summary>Cấu hình S3 đọc từ env (parity s3Config của Node).</summary>
public sealed record S3Config(
    string Endpoint, string Bucket, string AccessKey, string SecretKey,
    string Region, bool ForcePathStyle, string Service = "s3")
{
    public static S3Config? FromEnv()
    {
        var endpoint = Environment.GetEnvironmentVariable("S3_ENDPOINT");
        var bucket = Environment.GetEnvironmentVariable("S3_BUCKET");
        var accessKey = Environment.GetEnvironmentVariable("S3_ACCESS_KEY");
        var secretKey = Environment.GetEnvironmentVariable("S3_SECRET_KEY");
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(bucket)
            || string.IsNullOrEmpty(accessKey) || string.IsNullOrEmpty(secretKey))
            return null;
        var region = Environment.GetEnvironmentVariable("S3_REGION");
        if (string.IsNullOrEmpty(region)) region = "us-east-1";
        var forcePath = (Environment.GetEnvironmentVariable("S3_FORCE_PATH_STYLE") ?? "true") != "false";
        return new S3Config(endpoint.TrimEnd('/'), bucket, accessKey, secretKey, region, forcePath);
    }
}

/// <summary>Kết quả 1 lần ký SigV4 (đủ trường để test-vector assert).</summary>
public sealed record SigV4Result(
    string Authorization, string AmzDate, string SignedHeaders,
    string CanonicalRequest, string StringToSign, string Signature);

/// <summary>Kết quả 1 lần ký PRESIGNED URL (đủ trường để round-trip assert).</summary>
public sealed record PresignResult(
    string Url, string AmzDate, string Signature, string CanonicalRequest,
    string StringToSign, string CanonicalQuery, int Expires);

/// <summary>Hàm SigV4 thuần + tách/dựng data URI thuần (test không cần mạng).</summary>
public static class Blob
{
    // ---------------- data URI <-> bytes (thuần) ----------------
    /// <summary>true nếu là data URI base64 (nhị phân tệp) — điều kiện tách sang S3.</summary>
    public static bool IsDataUri(string? s)
    {
        if (string.IsNullOrEmpty(s) || s!.Length < 6 || !s.StartsWith("data:", StringComparison.Ordinal)) return false;
        var comma = s.IndexOf(',');
        if (comma < 0) return false;
        var meta = s.Substring(5, comma - 5); // giữa "data:" và ","
        return meta.Contains(";base64", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Tách data URI base64 -> (mime, bytes). Ném nếu không hợp lệ.</summary>
    public static (string mime, byte[] bytes) DecodeDataUri(string dataUrl)
    {
        if (!IsDataUri(dataUrl)) throw new Exception("Không phải data URI base64 hợp lệ");
        var comma = dataUrl.IndexOf(',');
        var meta = dataUrl.Substring(5, comma - 5);
        var semi = meta.IndexOf(';');
        var mime = (semi >= 0 ? meta.Substring(0, semi) : meta);
        if (string.IsNullOrEmpty(mime)) mime = "application/octet-stream";
        var bytes = Convert.FromBase64String(dataUrl[(comma + 1)..]);
        return (mime, bytes);
    }

    /// <summary>Dựng lại data URI base64 từ bytes + mime.</summary>
    public static string EncodeDataUri(byte[] bytes, string? mime)
        => $"data:{(string.IsNullOrEmpty(mime) ? "application/octet-stream" : mime)};base64,{Convert.ToBase64String(bytes)}";

    /// <summary>Phần mở rộng suy từ tên tệp; fallback theo mime; cuối cùng 'bin'.</summary>
    public static string ExtFor(string? name, string? mime)
    {
        if (!string.IsNullOrEmpty(name))
        {
            var dot = name!.TrimEnd().LastIndexOf('.');
            if (dot >= 0 && dot < name.Length - 1)
            {
                var ext = name[(dot + 1)..].ToLowerInvariant();
                if (System.Text.RegularExpressions.Regex.IsMatch(ext, "^[a-z0-9]+$")) return ext;
            }
        }
        return mime switch
        {
            "application/pdf" => "pdf", "image/png" => "png", "image/jpeg" => "jpg",
            "image/gif" => "gif", "text/plain" => "txt", "application/zip" => "zip",
            _ => "bin",
        };
    }

    public static string DocumentKey(string docId, double? version, string? name, string? mime)
    {
        var v = version is { } d && double.IsFinite(d) ? (int)d : 1;
        return $"documents/{docId}/v{v}.{ExtFor(name, mime)}";
    }

    public static string GuideKey(string docId, string? name, string? mime)
        => $"guides/{docId}/file.{ExtFor(name, mime)}";

    public static string MimeFromKey(string key)
    {
        var dot = key.LastIndexOf('.');
        var ext = dot >= 0 ? key[(dot + 1)..].ToLowerInvariant() : "";
        return ext switch
        {
            "pdf" => "application/pdf", "png" => "image/png", "jpg" => "image/jpeg",
            "jpeg" => "image/jpeg", "txt" => "text/plain", "zip" => "application/zip",
            _ => "application/octet-stream",
        };
    }

    // ---------------- AWS Signature V4 (thuần) ----------------
    private static byte[] Sha256(byte[] data) { using var h = SHA256.Create(); return h.ComputeHash(data); }
    public static string Sha256Hex(byte[] data) => Convert.ToHexString(Sha256(data)).ToLowerInvariant();
    private static byte[] Hmac(byte[] key, string data) { using var h = new HMACSHA256(key); return h.ComputeHash(Encoding.UTF8.GetBytes(data)); }

    /// <summary>RFC 3986 encode (S3 SigV4). encodeSlash=false để GIỮ '/' trong key path.</summary>
    public static string UriEncode(string str, bool encodeSlash = true)
    {
        var sb = new StringBuilder();
        foreach (var b in Encoding.UTF8.GetBytes(str))
        {
            var c = (char)b;
            if ((b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || (b >= 0x30 && b <= 0x39)
                || c is '-' or '_' or '.' or '~')
                sb.Append(c);
            else if (c == '/')
                sb.Append(encodeSlash ? "%2F" : "/");
            else
                sb.Append('%').Append(b.ToString("X2", CultureInfo.InvariantCulture));
        }
        return sb.ToString();
    }

    public static (string amzDate, string dateStamp) AmzDates(DateTime date)
    {
        var utc = date.ToUniversalTime();
        var amz = utc.ToString("yyyyMMddTHHmmssZ", CultureInfo.InvariantCulture);
        return (amz, amz[..8]);
    }

    public static byte[] SigningKey(string secretKey, string dateStamp, string region, string service)
    {
        var kDate = Hmac(Encoding.UTF8.GetBytes("AWS4" + secretKey), dateStamp);
        var kRegion = Hmac(kDate, region);
        var kService = Hmac(kRegion, service);
        return Hmac(kService, "aws4_request");
    }

    /// <summary>
    /// Ký 1 request S3 (SigV4 header-based). THUẦN (không I/O) -> test-vector được.
    /// headers: khóa LOWERCASE, phải gồm host. payloadHash: hex sha256(body) hoặc 'UNSIGNED-PAYLOAD'.
    /// </summary>
    public static SigV4Result SignRequestV4(
        string method, string canonicalUri, IDictionary<string, string> query,
        IDictionary<string, string> headers, string payloadHash,
        string accessKey, string secretKey, string region, string service, DateTime date)
    {
        var (amzDate, dateStamp) = AmzDates(date);

        var sortedKeys = headers.Keys.Select(k => k.ToLowerInvariant()).OrderBy(k => k, StringComparer.Ordinal).ToList();
        var canonicalHeaders = string.Concat(sortedKeys.Select(k =>
        {
            var val = System.Text.RegularExpressions.Regex.Replace(headers[k].Trim(), "\\s+", " ");
            return $"{k}:{val}\n";
        }));
        var signedHeaders = string.Join(";", sortedKeys);

        var canonicalQuery = string.Join("&", query
            .Select(kv => (k: UriEncode(kv.Key), v: UriEncode(kv.Value)))
            .OrderBy(p => p.k, StringComparer.Ordinal)
            .Select(p => $"{p.k}={p.v}"));

        var canonicalRequest = string.Join("\n", new[]
        {
            method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash,
        });

        var scope = $"{dateStamp}/{region}/{service}/aws4_request";
        var stringToSign = string.Join("\n", new[]
        {
            "AWS4-HMAC-SHA256", amzDate, scope, Sha256Hex(Encoding.UTF8.GetBytes(canonicalRequest)),
        });

        var key = SigningKey(secretKey, dateStamp, region, service);
        var signature = Convert.ToHexString(Hmac(key, stringToSign)).ToLowerInvariant();
        var authorization = $"AWS4-HMAC-SHA256 Credential={accessKey}/{scope}, "
            + $"SignedHeaders={signedHeaders}, Signature={signature}";

        return new SigV4Result(authorization, amzDate, signedHeaders, canonicalRequest, stringToSign, signature);
    }

    /// <summary>
    /// Ký PRESIGNED URL (SigV4 query-string). THUẦN (không I/O) -> round-trip test được.
    /// Khác header-based: credential/date/expires/signed-headers nằm trong QUERY (X-Amz-*),
    /// payloadHash = 'UNSIGNED-PAYLOAD', CHỈ ký host. Port presignV4 (blob.js). Parity BYTE.
    /// </summary>
    public static PresignResult PresignV4(
        string method, string href, string host, string canonicalUri, int expiresSec,
        IDictionary<string, string>? extraQuery,
        string accessKey, string secretKey, string region, string service, DateTime date)
    {
        var (amzDate, dateStamp) = AmzDates(date);
        var expires = Math.Max(1, Math.Min(604800, expiresSec));
        var scope = $"{dateStamp}/{region}/{service}/aws4_request";
        const string signedHeaders = "host";
        var canonicalHeaders = $"host:{host.Trim()}\n";

        var query = new Dictionary<string, string>
        {
            ["X-Amz-Algorithm"] = "AWS4-HMAC-SHA256",
            ["X-Amz-Credential"] = $"{accessKey}/{scope}",
            ["X-Amz-Date"] = amzDate,
            ["X-Amz-Expires"] = expires.ToString(CultureInfo.InvariantCulture),
            ["X-Amz-SignedHeaders"] = signedHeaders,
        };
        if (extraQuery != null) foreach (var kv in extraQuery) query[kv.Key] = kv.Value;

        var canonicalQuery = string.Join("&", query
            .Select(kv => (k: UriEncode(kv.Key), v: UriEncode(kv.Value)))
            .OrderBy(p => p.k, StringComparer.Ordinal)
            .Select(p => $"{p.k}={p.v}"));

        var canonicalRequest = string.Join("\n", new[]
        {
            method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD",
        });
        var stringToSign = string.Join("\n", new[]
        {
            "AWS4-HMAC-SHA256", amzDate, scope, Sha256Hex(Encoding.UTF8.GetBytes(canonicalRequest)),
        });
        var key = SigningKey(secretKey, dateStamp, region, service);
        var signature = Convert.ToHexString(Hmac(key, stringToSign)).ToLowerInvariant();
        var url = $"{href}?{canonicalQuery}&X-Amz-Signature={signature}";
        return new PresignResult(url, amzDate, signature, canonicalRequest, stringToSign, canonicalQuery, expires);
    }

    // ---------------- TỐI ƯU 1/2 — cấu hình tải + gom khóa dọn (thuần) ----------------
    /// <summary>
    /// Chế độ tải tệp có storageKey khi S3 bật: "redirect" (mặc định, 302 tới presigned —
    /// client tải thẳng từ S3, backend 0 byte RAM) | "stream" (backend kéo bytes rồi trả).
    /// Env S3_DOWNLOAD_MODE (parity downloadMode() của Node).
    /// </summary>
    public static string DownloadMode()
        => (Environment.GetEnvironmentVariable("S3_DOWNLOAD_MODE") ?? "redirect").ToLowerInvariant() == "stream" ? "stream" : "redirect";

    /// <summary>
    /// ĐỢT 3 — chế độ tải với QUYỀN GHI ĐÈ theo QUERY (?mode=stream|redirect). THUẦN (test được).
    /// Ưu tiên: query > env S3_DOWNLOAD_MODE. Chỉ nhận 'stream'/'redirect'; giá trị lạ -> theo env.
    /// Cần cho FALLBACK phía FE: fetch-theo-302→MinIO lỗi (CORS/mạng) -> gọi lại ?mode=stream.
    /// Port downloadModeFrom (blob.js).
    /// </summary>
    public static string DownloadModeFrom(Microsoft.AspNetCore.Http.IQueryCollection? query)
    {
        var raw = (query?["mode"].FirstOrDefault() ?? "").ToLowerInvariant();
        if (raw == "stream") return "stream";
        if (raw == "redirect") return "redirect";
        return DownloadMode();
    }

    /// <summary>
    /// ĐỢT 3 — công tắc KHẨN CẤP dựng lại dataUrl base64 khi GET document/guide (khôi phục hành vi
    /// cũ trước đợt 3). Mặc định TẮT: GET trả contentUrl trỏ /download thay vì nhồi base64. Bật
    /// S3_INLINE_READ=on -> GET dựng lại dataUrl như đợt 1/2. Port inlineReadEnabled (blob.js).
    /// </summary>
    public static bool InlineReadEnabled()
        => (Environment.GetEnvironmentVariable("S3_INLINE_READ") ?? "").ToLowerInvariant() == "on";

    // ============================================================
    // ĐỢT 3 — CHIẾU BẢN GHI CHO ĐƯỜNG XEM (GET document/guide): trả contentUrl thay base64.
    // Port projectDocumentRead/projectGuideRead (blob.js). THUẦN — không I/O, không đọc env
    // (điểm gọi tự chọn nhánh S3_INLINE_READ). Trả BẢN SAO (không đột biến bản ghi DB/cache).
    //   - Bản ghi CŨ còn dataUrl/fileData -> GIỮ NGUYÊN (tương thích ngược).
    //   - Có storageKey -> XÓA storageKey (KHÔNG lộ khóa S3), THÊM contentUrl /download, KHÔNG base64.
    //   - Tài liệu soạn tay (chỉ content) -> trả nguyên.
    // ============================================================
    public static JsonObject ProjectDocumentRead(JsonObject doc)
    {
        if (J.Str(doc, "dataUrl") is not null) return doc;      // bản ghi cũ còn base64
        if (string.IsNullOrEmpty(J.Str(doc, "storageKey"))) return doc; // soạn tay / không tệp
        var outp = J.CloneObj(doc);
        outp.Remove("storageKey");                              // KHÔNG lộ khóa S3
        outp["contentUrl"] = $"/api/documents/{Uri.EscapeDataString(J.Str(doc, "id")!)}/download";
        return outp;
    }

    public static JsonObject ProjectGuideRead(JsonObject guide)
    {
        if (J.Str(guide, "fileData") is not null) return guide;
        if (string.IsNullOrEmpty(J.Str(guide, "storageKey"))) return guide;
        var outp = J.CloneObj(guide);
        outp.Remove("storageKey");
        outp["contentUrl"] = $"/api/guides/{Uri.EscapeDataString(J.Str(guide, "id")!)}/download";
        return outp;
    }

    /// <summary>TTL (giây) presigned URL — env S3_PRESIGN_TTL, mặc định 300, kẹp 1..604800.</summary>
    public static int PresignTtlSec()
    {
        var raw = Environment.GetEnvironmentVariable("S3_PRESIGN_TTL");
        if (int.TryParse(raw, out var n)) return Math.Max(1, Math.Min(604800, n));
        return 300;
    }

    /// <summary>
    /// TỐI ƯU 2 — gom TẤT CẢ khóa S3 cần dọn khi XÓA 1 tài liệu: storageKey hiện tại +
    /// storageKey của mỗi version cũ (versions[]). Loại trùng/rỗng. Port documentStorageKeys.
    /// </summary>
    public static List<string> DocumentStorageKeys(JsonObject? doc)
    {
        var keys = new List<string>();
        if (doc is null) return keys;
        void Add(string? k) { if (!string.IsNullOrEmpty(k) && !keys.Contains(k)) keys.Add(k!); }
        Add(J.Str(doc, "storageKey"));
        if (J.Arr(doc, "versions") is JsonArray versions)
            foreach (var v in versions.OfType<JsonObject>()) Add(J.Str(v, "storageKey"));
        return keys;
    }

    /// <summary>TỐI ƯU 2 — khóa S3 của 1 guide (0/1 phần tử). Port guideStorageKeys.</summary>
    public static List<string> GuideStorageKeys(JsonObject? guide)
    {
        var k = guide is null ? null : J.Str(guide, "storageKey");
        return string.IsNullOrEmpty(k) ? new List<string>() : new List<string> { k! };
    }

    /// <summary>
    /// TỐI ƯU 1 — dựng response-content-disposition=attachment với ASCII fallback + filename*
    /// UTF-8 (RFC 5987/6266) để tải đúng tên tiếng Việt. Dùng chung presign + stream.
    /// </summary>
    public static string ContentDisposition(string? name)
    {
        var raw = string.IsNullOrEmpty(name) ? "download" : name!;
        var sb = new StringBuilder();
        foreach (var ch in raw)
            sb.Append(ch is >= (char)0x20 and <= (char)0x7E && ch is not '"' and not '\\' ? ch : '_');
        return $"attachment; filename=\"{sb}\"; filename*=UTF-8''{UriEncode(raw)}";
    }

    // ---------------- Tách / dựng (thuần, bơm store để test) ----------------
    /// <summary>Ghi document: S3 bật + có dataUrl base64 -> PUT S3, set storageKey/size, xóa dataUrl (đột biến tại chỗ).</summary>
    public static async Task<JsonObject> ExternalizeDocumentWriteAsync(JsonObject doc, IBlobStore store)
    {
        if (!store.Configured()) return doc;
        var dataUrl = J.Str(doc, "dataUrl");
        if (!IsDataUri(dataUrl)) return doc;
        var (mime, bytes) = DecodeDataUri(dataUrl!);
        var docMime = J.Str(doc, "mime") ?? mime;
        var key = DocumentKey(J.Str(doc, "id")!, J.Num(doc, "version"), J.Str(doc, "name"), docMime);
        await store.PutAsync(key, bytes, docMime);
        doc["storageKey"] = key;
        var size = J.Num(doc, "size");
        if (size is null || size.Value <= 0) doc["size"] = bytes.Length;
        doc.Remove("dataUrl");
        return doc;
    }

    /// <summary>Đọc document: có storageKey + chưa có dataUrl + S3 bật -> GET S3, dựng dataUrl (trả BẢN SAO).</summary>
    public static async Task<JsonObject> InlineDocumentReadAsync(JsonObject doc, IBlobStore store)
    {
        var key = J.Str(doc, "storageKey");
        if (string.IsNullOrEmpty(key) || J.Str(doc, "dataUrl") is not null) return doc;
        if (!store.Configured()) return doc;
        var bytes = await store.GetAsync(key!);
        var outp = J.CloneObj(doc);
        outp["dataUrl"] = EncodeDataUri(bytes, J.Str(doc, "mime"));
        return outp;
    }

    public static async Task<JsonObject> ExternalizeGuideWriteAsync(JsonObject guide, IBlobStore store)
    {
        if (!store.Configured()) return guide;
        var fileData = J.Str(guide, "fileData");
        if (!IsDataUri(fileData)) return guide;
        var (mime, bytes) = DecodeDataUri(fileData!);
        var key = GuideKey(J.Str(guide, "id")!, J.Str(guide, "fileName"), mime);
        await store.PutAsync(key, bytes, mime);
        guide["storageKey"] = key;
        guide.Remove("fileData");
        return guide;
    }

    public static async Task<JsonObject> InlineGuideReadAsync(JsonObject guide, IBlobStore store)
    {
        var key = J.Str(guide, "storageKey");
        if (string.IsNullOrEmpty(key) || J.Str(guide, "fileData") is not null) return guide;
        if (!store.Configured()) return guide;
        var bytes = await store.GetAsync(key!);
        var outp = J.CloneObj(guide);
        outp["fileData"] = EncodeDataUri(bytes, MimeFromKey(key!));
        return outp;
    }
}

/// <summary>
/// blobStore thật trên S3/MinIO (HttpClient + SigV4). GATED bởi S3Config.FromEnv().
/// Một HttpClient tĩnh dùng lại (tránh cạn socket) — parity fetch() của Node.
/// </summary>
public sealed class S3BlobStore : IBlobStore
{
    private static readonly HttpClient Http = new();

    public bool Configured() => S3Config.FromEnv() is not null;

    private static (string host, string canonicalUri, string href) Target(S3Config cfg, string key)
    {
        var u = new Uri(cfg.Endpoint);
        var host = cfg.ForcePathStyle ? u.Authority : $"{cfg.Bucket}.{u.Authority}";
        var bucketSeg = cfg.ForcePathStyle ? $"/{cfg.Bucket}" : "";
        var encKey = string.Join("/", key.Split('/').Select(s => Blob.UriEncode(s, false)));
        var canonicalUri = $"{bucketSeg}/{encKey}";
        var href = $"{u.Scheme}://{host}{canonicalUri}";
        return (host, canonicalUri, href);
    }

    private static HttpRequestMessage BuildSigned(string method, string key, byte[] payload, string? contentType)
    {
        var cfg = S3Config.FromEnv() ?? throw new Exception("S3 chưa cấu hình");
        var (host, canonicalUri, href) = Target(cfg, key);
        var payloadHash = Blob.Sha256Hex(payload);
        var date = DateTime.UtcNow;
        var (amzDate, _) = Blob.AmzDates(date);
        var headers = new Dictionary<string, string>
        {
            ["host"] = host,
            ["x-amz-content-sha256"] = payloadHash,
            ["x-amz-date"] = amzDate,
        };
        if (method == "PUT" && !string.IsNullOrEmpty(contentType)) headers["content-type"] = contentType!;

        var sig = Blob.SignRequestV4(method, canonicalUri, new Dictionary<string, string>(), headers, payloadHash,
            cfg.AccessKey, cfg.SecretKey, cfg.Region, cfg.Service, date);

        var req = new HttpRequestMessage(new HttpMethod(method), href);
        req.Headers.TryAddWithoutValidation("x-amz-content-sha256", payloadHash);
        req.Headers.TryAddWithoutValidation("x-amz-date", amzDate);
        req.Headers.TryAddWithoutValidation("Authorization", sig.Authorization);
        if (method is "PUT" or "POST")
        {
            req.Content = new ByteArrayContent(payload);
            if (!string.IsNullOrEmpty(contentType))
                req.Content.Headers.TryAddWithoutValidation("Content-Type", contentType);
        }
        return req;
    }

    public async Task PutAsync(string key, byte[] bytes, string? contentType)
    {
        using var req = BuildSigned("PUT", key, bytes, contentType);
        using var res = await Http.SendAsync(req);
        if (!res.IsSuccessStatusCode)
        {
            var text = await res.Content.ReadAsStringAsync();
            throw new Exception($"S3 PUT {key} thất bại: {(int)res.StatusCode} {text[..Math.Min(200, text.Length)]}");
        }
    }

    public async Task<byte[]> GetAsync(string key)
    {
        using var req = BuildSigned("GET", key, Array.Empty<byte>(), null);
        using var res = await Http.SendAsync(req);
        if (!res.IsSuccessStatusCode) throw new Exception($"S3 GET {key} thất bại: {(int)res.StatusCode}");
        return await res.Content.ReadAsByteArrayAsync();
    }

    public async Task DeleteAsync(string key)
    {
        using var req = BuildSigned("DELETE", key, Array.Empty<byte>(), null);
        using var res = await Http.SendAsync(req);
        if (!res.IsSuccessStatusCode && (int)res.StatusCode != 404)
            throw new Exception($"S3 DELETE {key} thất bại: {(int)res.StatusCode}");
    }

    public string PresignGetUrl(string key, int ttlSec = 300, string? filename = null, string? contentType = null)
    {
        var cfg = S3Config.FromEnv() ?? throw new Exception("S3 chưa cấu hình");
        var (host, canonicalUri, href) = Target(cfg, key);
        var extra = new Dictionary<string, string>();
        if (!string.IsNullOrEmpty(filename)) extra["response-content-disposition"] = Blob.ContentDisposition(filename);
        if (!string.IsNullOrEmpty(contentType)) extra["response-content-type"] = contentType!;
        var r = Blob.PresignV4("GET", href, host, canonicalUri, ttlSec, extra,
            cfg.AccessKey, cfg.SecretKey, cfg.Region, cfg.Service, DateTime.UtcNow);
        return r.Url; // KHÔNG log URL (chứa chữ ký cấp quyền đọc tạm thời)
    }
}
