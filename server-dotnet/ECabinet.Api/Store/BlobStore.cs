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
}
