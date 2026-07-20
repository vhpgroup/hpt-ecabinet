using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using ECabinet.Api.Http;
using ECabinet.Api.Store;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace ECabinet.Api;

/// <summary>
/// LẮP RÁP ỨNG DỤNG — port index.js (khởi động + route + rate-limit + CORS + WebSocket).
/// Tách khỏi entrypoint để test (TestHost) dựng cùng pipeline in-memory.
/// </summary>
public static class App
{
    public const long RateWindowMs = 60000;

    /// <summary>
    /// Tạo WebApplication đã cấu hình đầy đủ (Kestrel — production). store: cho phép tiêm sẵn.
    /// Nếu store == null: chọn theo DATABASE_URL (SqlServer) hoặc InMemory.
    /// </summary>
    public static async Task<WebApplication> BuildAsync(string[] args, IDocStore? store = null)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.Logging.SetMinimumLevel(Microsoft.Extensions.Logging.LogLevel.Warning);

        var dbUrl = Env.Get("DATABASE_URL");
        store ??= !string.IsNullOrEmpty(dbUrl) ? new SqlServerDocStore(dbUrl) : new InMemoryDocStore();
        builder.Services.AddSingleton(store);

        var app = builder.Build();

        await store.InitAsync();
        await Seed.SeedIfEmpty(store);

        ConfigurePipeline(app, store);
        return app;
    }

    /// <summary>
    /// Cấu hình pipeline HTTP dùng chung cho production (Kestrel) + test (TestHost).
    /// PUBLIC để ECabinet.Tests dựng TestServer với cùng pipeline (chỉ dùng IApplicationBuilder
    /// của shared framework — không kéo thêm gói NuGet vào ECabinet.Api).
    /// Gọi InitAsync + SeedIfEmpty cho store TRƯỚC khi gọi hàm này.
    /// </summary>
    public static void ConfigurePipeline(IApplicationBuilder app, IDocStore store, IBlobStore? blob = null)
    {
        var router = BuildRouter(store, blob ?? new S3BlobStore());
        app.UseWebSockets();

        // Pipeline chính (1 middleware terminal) — port http.createServer(...) + app.handle.
        app.Run(async ctx =>
        {
            // WebSocket nâng cấp: /api/realtime
            if (ctx.WebSockets.IsWebSocketRequest)
            {
                await Realtime.TryHandle(ctx, "/api/realtime");
                return;
            }

            var c = new Ctx { Http = ctx };
            ApplyCors(c); // CORS cho mọi phản hồi (kể cả preflight/429)

            // rate-limit toàn cục theo IP (trừ /health) — port hit('ip:'+clientIp)
            if (ctx.Request.Path != "/health")
            {
                var max = Env.GetInt("RATE_LIMIT_MAX", 300);
                var rl = RateLimit.Hit("ip:" + HttpUtil.ClientIp(ctx.Request), max, Env.GetInt("RATE_LIMIT_WINDOW_MS", (int)RateWindowMs));
                if (!rl.Ok)
                {
                    ctx.Response.StatusCode = 429;
                    ctx.Response.Headers["Retry-After"] = rl.RetryAfterSec.ToString();
                    ApplyCors(c);
                    ctx.Response.ContentType = "application/json; charset=utf-8";
                    await ctx.Response.WriteAsync(J.Stringify(new JsonObject { ["error"] = "Quá nhiều yêu cầu — vui lòng thử lại sau" }));
                    return;
                }
            }

            var matched = await router.Handle(c);
            if (!matched && !c.Ended)
                await HttpUtil.Send(c.Res, 404, new JsonObject { ["error"] = "Không tìm thấy endpoint" });
        });
    }

    // ---------------- CORS (port util.js + bổ sung mobile) ----------------
    /// <summary>
    /// Áp CORS. Node: Access-Control-Allow-Origin = CORS_ORIGIN ?? '*'.
    /// Bổ sung (chủ đích): nếu request có Origin trùng danh sách cho phép (CORS_ORIGIN/CORS_ORIGINS
    /// + mặc định mobile capacitor://localhost, ionic://localhost, http://localhost), echo lại đúng
    /// origin đó (cho phép app di động Capacitor/Ionic). Tắt phần mobile bằng MOBILE_CORS=off.
    /// Khi không khớp -> giữ NGUYÊN hành vi Node.
    /// </summary>
    public static void ApplyCors(Ctx c)
    {
        var origin = c.Req.Headers.Origin.FirstOrDefault();
        var nodeDefault = Env.GetOr("CORS_ORIGIN", "*");

        string allow = nodeDefault;
        var allowed = AllowedOrigins();
        if (!string.IsNullOrEmpty(origin) && allowed.Contains(origin))
            allow = origin; // echo origin cụ thể (mobile / cấu hình)
        else if (nodeDefault != "*" && !string.IsNullOrEmpty(origin) && string.Equals(origin, nodeDefault, StringComparison.Ordinal))
            allow = origin;

        var h = c.Res.Headers;
        h["Access-Control-Allow-Origin"] = allow;
        h["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
        h["Access-Control-Allow-Methods"] = "GET,POST,PATCH,PUT,DELETE,OPTIONS";
        h["Access-Control-Max-Age"] = "86400";
        if (allow != "*") h["Vary"] = "Origin";
    }

    private static HashSet<string> AllowedOrigins()
    {
        var set = new HashSet<string>(StringComparer.Ordinal);
        var single = Env.Get("CORS_ORIGIN");
        if (!string.IsNullOrEmpty(single) && single != "*") set.Add(single);
        var multi = Env.Get("CORS_ORIGINS");
        if (!string.IsNullOrEmpty(multi))
            foreach (var o in multi.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                set.Add(o);
        if (!string.Equals(Env.Get("MOBILE_CORS"), "off", StringComparison.OrdinalIgnoreCase))
        {
            set.Add("capacitor://localhost");
            set.Add("ionic://localhost");
            set.Add("http://localhost");
        }
        return set;
    }

    // ---------------- Sanitizers ----------------
    private static JsonObject SanitizeUser(JsonObject? u)
    {
        var outp = u is null ? new JsonObject() : J.CloneObj(u);
        outp.Remove("password");
        outp["password"] = "";
        return outp;
    }

    private static JsonObject SanitizeApiKey(JsonObject? k)
    {
        var outp = k is null ? new JsonObject() : J.CloneObj(k);
        outp.Remove("keyHash");
        return outp;
    }

    private static string Sha256Hex(string t)
    {
        using var sha = SHA256.Create();
        return Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(t))).ToLowerInvariant();
    }

    // Tách file (GĐ3): dựng lại dataUrl/fileData cho phản hồi PATCH; lỗi S3 -> trả merged
    // (parity Node `inlineDocumentRead(merged).catch(() => merged)` — ghi đã thành công).
    private static async Task<JsonObject> SafeInlineDoc(JsonObject doc, IBlobStore blob)
    {
        try { return await Blob.InlineDocumentReadAsync(doc, blob); } catch { return doc; }
    }

    private static async Task<JsonObject> SafeInlineGuide(JsonObject guide, IBlobStore blob)
    {
        try { return await Blob.InlineGuideReadAsync(guide, blob); } catch { return guide; }
    }

    // TỐI ƯU 1: tải nội dung tệp KHÔNG qua base64 (port handleFileDownload của Node).
    private static async Task HandleFileDownload(Ctx c, IDocStore store, Access access, IBlobStore blob, string col)
    {
        var table = col == "documents" ? "c_documents" : "c_guides";
        var data = await store.GetByIdAsync(table, c.Params["id"]);
        if (data is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy bản ghi"); return; }
        // KIỂM QUYỀN ĐỌC Y HỆT GET :id (tài liệu mật/chưa duyệt/không thuộc phạm vi -> 404).
        var readable = await access.ReadOne(col, data, c.User!);
        if (readable is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy bản ghi"); return; }

        var name = col == "documents"
            ? J.Str(readable, "name")
            : (J.Str(readable, "fileName") ?? J.Str(readable, "name") ?? "download");
        var key = J.Str(readable, "storageKey");

        // Nhánh 1: đã externalize (storageKey) + S3 bật.
        if (!string.IsNullOrEmpty(key) && blob.Configured())
        {
            var mime = col == "documents" ? (J.Str(readable, "mime") ?? Blob.MimeFromKey(key!)) : Blob.MimeFromKey(key!);
            if (Blob.DownloadMode() == "redirect")
            {
                string url;
                try { url = blob.PresignGetUrl(key!, Blob.PresignTtlSec(), name, mime); }
                catch (Exception e) { await HttpUtil.SendError(c.Res, 502, $"Không tạo được liên kết tải tệp: {e.Message}"); return; }
                await SendRedirect(c.Res, url);
                return;
            }
            // stream: kéo bytes rồi trả với Content-Type/Disposition/Length đúng.
            try
            {
                var bytes = await blob.GetAsync(key!);
                await SendBinary(c.Res, bytes, mime, name);
            }
            catch (Exception e) { await HttpUtil.SendError(c.Res, 502, $"Không đọc được nội dung tệp từ kho lưu trữ: {e.Message}"); return; }
            return;
        }

        // Nhánh 2: bản ghi cũ (base64 trong DB) hoặc S3 tắt -> giải mã base64 rồi stream.
        var dataUrl = col == "documents" ? J.Str(readable, "dataUrl") : J.Str(readable, "fileData");
        if (!string.IsNullOrEmpty(dataUrl) && Blob.IsDataUri(dataUrl))
        {
            var (mime, bytes) = Blob.DecodeDataUri(dataUrl!);
            var mimeOut = col == "documents" ? (J.Str(readable, "mime") ?? mime) : mime;
            await SendBinary(c.Res, bytes, mimeOut, name);
            return;
        }
        // Tài liệu soạn tay (content thuần) / không có tệp.
        await HttpUtil.SendError(c.Res, 404, "Tài liệu không có tệp đính kèm để tải");
    }

    /// <summary>
    /// Gửi 302 redirect tới presigned URL (TỐI ƯU 1). Ghi body RỖNG để đánh dấu response đã bắt
    /// đầu (Res.HasStarted=true) — nếu không Router sẽ tưởng handler chưa trả và ghi đè 500.
    /// KHÔNG log URL (chứa chữ ký cấp quyền đọc tạm thời).
    /// </summary>
    private static async Task SendRedirect(HttpResponse res, string url)
    {
        if (res.HasStarted) return;
        res.StatusCode = 302;
        res.Headers["Location"] = url;
        res.Headers["Cache-Control"] = "no-store";
        res.Headers["Access-Control-Allow-Origin"] = HttpUtil.CorsOrigin();
        res.ContentLength = 0;
        await res.Body.WriteAsync(Array.Empty<byte>());
    }

    /// <summary>Gửi nhị phân (attachment) với Content-Type/Disposition/Length + CORS. Dùng cho stream/base64.</summary>
    private static async Task SendBinary(HttpResponse res, byte[] bytes, string mime, string? name)
    {
        if (res.HasStarted) return;
        res.StatusCode = 200;
        res.Headers["Access-Control-Allow-Origin"] = HttpUtil.CorsOrigin();
        res.Headers["Content-Disposition"] = Blob.ContentDisposition(name);
        res.Headers["Cache-Control"] = "no-store";
        res.ContentType = string.IsNullOrEmpty(mime) ? "application/octet-stream" : mime;
        res.ContentLength = bytes.Length;
        await res.Body.WriteAsync(bytes);
    }

    // ---------------- Router (port toàn bộ route index.js theo đúng thứ tự) ----------------
    private static Router BuildRouter(IDocStore store, IBlobStore blob)
    {
        var app = new Router();
        var sessions = new Sessions(store);
        var access = new Access(store);
        var actions = new Actions(store);
        var rtc = new Rtc(store);
        var open = new OpenRoutes(store, blob);

        async Task<bool> EnsureTable(Ctx c)
        {
            if (Db.TableOf(c.Params["collection"]) is null)
            {
                await HttpUtil.SendError(c.Res, 404, $"Bộ dữ liệu \"{c.Params["collection"]}\" không tồn tại");
                return false;
            }
            return true;
        }

        // ---------------- Health ----------------
        app.Add("GET", "/health", async c =>
        {
            try
            {
                await store.CountUsersAsync(); // ping store (tương đương SELECT 1)
                await HttpUtil.Send(c.Res, 200, new JsonObject
                {
                    ["ok"] = true,
                    ["service"] = "ecabinet-api",
                    ["db"] = string.IsNullOrEmpty(Env.Get("DATABASE_URL")) ? "inmemory" : "sqlserver",
                    ["realtimeClients"] = Realtime.ClientCount,
                });
            }
            catch { await HttpUtil.Send(c.Res, 503, new JsonObject { ["ok"] = false }); }
        });

        // ---------------- Auth ----------------
        app.Add("POST", "/api/auth/login", async c =>
        {
            var body = await HttpUtil.ReadBodyObj(c.Req);
            var username = (J.Str(body, "username") ?? "").Trim().ToLowerInvariant();

            var loginMax = Env.GetInt("LOGIN_RATE_MAX", 10);
            var loginWindow = Env.GetInt("LOGIN_RATE_WINDOW_MS", 15 * 60000);
            var rl = RateLimit.Hit($"login:{HttpUtil.ClientIp(c.Req)}:{username}", loginMax, loginWindow);
            if (!rl.Ok)
            {
                await HttpUtil.SendError(c.Res, 429, $"Đăng nhập sai quá nhiều lần — thử lại sau {Math.Ceiling(rl.RetryAfterSec / 60.0)} phút");
                return;
            }

            var found = await store.FindUserByUsernameAsync(username);
            if (found is null) { await HttpUtil.SendError(c.Res, 401, "Tài khoản không tồn tại"); return; }
            var (data, passwordHash) = found.Value;
            if (J.Str(data, "status") != "active") { await HttpUtil.SendError(c.Res, 401, "Tài khoản đã bị khóa"); return; }
            if (!Auth.VerifyPassword(J.Str(body, "password"), passwordHash)) { await HttpUtil.SendError(c.Res, 401, "Mật khẩu không đúng"); return; }

            var user = SanitizeUser(data);
            var id = J.Str(data, "id")!;
            var token = Auth.SignUser(id, J.Str(user, "role") ?? "", J.Str(user, "fullName"));
            var refreshToken = await sessions.IssueRefreshToken(id);
            var auditId = Guid.NewGuid().ToString();
            await store.InsertAsync("c_audit", auditId, new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString(), ["userId"] = id, ["userName"] = J.Str(user, "fullName"),
                ["action"] = "Đăng nhập", ["detail"] = "Đăng nhập hệ thống thành công (JWT)", ["at"] = NowIso(),
            });
            await HttpUtil.Send(c.Res, 200, new JsonObject { ["token"] = token, ["refreshToken"] = refreshToken, ["user"] = user });
        });

        app.Add("POST", "/api/auth/refresh", async c =>
        {
            var body = await HttpUtil.ReadBodyObj(c.Req);
            var userId = await sessions.RotateRefreshToken(J.Str(body, "refreshToken"));
            if (userId is null) { await HttpUtil.SendError(c.Res, 401, "Phiên gia hạn không hợp lệ hoặc đã hết hạn — vui lòng đăng nhập lại"); return; }
            var data = await store.GetByIdAsync("c_users", userId);
            if (data is null || J.Str(data, "status") != "active") { await HttpUtil.SendError(c.Res, 401, "Tài khoản không còn hiệu lực"); return; }
            var user = SanitizeUser(data);
            var token = Auth.SignUser(userId, J.Str(user, "role") ?? "", J.Str(user, "fullName"));
            var refreshToken = await sessions.IssueRefreshToken(userId);
            await HttpUtil.Send(c.Res, 200, new JsonObject { ["token"] = token, ["refreshToken"] = refreshToken, ["user"] = user });
        });

        app.Add("POST", "/api/auth/logout", async c =>
        {
            var body = await HttpUtil.ReadBodyObj(c.Req);
            var rt = J.Str(body, "refreshToken");
            if (!string.IsNullOrEmpty(rt)) await sessions.RevokeRefreshToken(rt);
            await HttpUtil.Send(c.Res, 200, new JsonObject { ["ok"] = true });
        });

        app.Add("GET", "/api/auth/me", Auth.RequireAuth, async c =>
        {
            var data = await store.GetByIdAsync("c_users", c.User!.Sub);
            if (data is null) { await HttpUtil.SendError(c.Res, 401, "Tài khoản không còn tồn tại"); return; }
            await HttpUtil.Send(c.Res, 200, SanitizeUser(data));
        });

        // ---------------- RTC (TRƯỚC CRUD chung) ----------------
        rtc.Register(app);

        // ---------------- Khóa API nghiệp vụ (TRƯỚC CRUD chung) ----------------
        app.Add("POST", "/api/apikeys/create", Auth.RequireAuth, Auth.RequireAdmin, async c =>
        {
            var body = await HttpUtil.ReadBodyObj(c.Req);
            var name = (J.Str(body, "name") ?? "").Trim();
            if (string.IsNullOrEmpty(name)) { await HttpUtil.SendError(c.Res, 400, "Vui lòng nhập tên hệ thống/đơn vị tích hợp"); return; }
            var scopesIn = J.Arr(body, "scopes") ?? new JsonArray();
            var scopes = new JsonArray();
            foreach (var s in scopesIn) { var sv = J.Str(s); if (sv is "meetings" or "documents") scopes.Add(sv); }
            if (scopes.Count == 0) { await HttpUtil.SendError(c.Res, 400, "Chọn ít nhất một phạm vi (meetings / documents)"); return; }

            var raw = $"ecab_{Auth.B64Url(RandomNumberGenerator.GetBytes(24))}";
            var recId = Guid.NewGuid().ToString();
            var noteRaw = J.Str(body, "note");
            var record = new JsonObject
            {
                ["id"] = recId,
                ["name"] = name,
                ["prefix"] = raw.Substring(0, 8),
                ["keyHash"] = Sha256Hex(raw),
                ["scopes"] = scopes,
                ["active"] = true,
                ["createdAt"] = NowIso(),
                ["createdById"] = c.User!.Sub,
                ["callCount"] = 0,
            };
            if (noteRaw != null) { var t = noteRaw.Trim(); record["note"] = t.Length > 1000 ? t.Substring(0, 1000) : t; }
            await store.InsertAsync("c_apikeys", recId, record);
            var auditId = Guid.NewGuid().ToString();
            await store.InsertAsync("c_audit", auditId, new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString(), ["userId"] = c.User.Sub, ["userName"] = c.User.Name,
                ["action"] = "Tạo khóa API", ["detail"] = $"Cấp khóa API cho \"{name}\" (prefix {record["prefix"]}…, scope {string.Join(", ", scopes.Select(J.Str))})", ["at"] = NowIso(),
            });
            Realtime.NotifyChange("apiKeys", "create", recId);
            await HttpUtil.Send(c.Res, 201, new JsonObject { ["key"] = raw, ["record"] = SanitizeApiKey(record) });
        });

        app.Add("POST", "/api/apikeys/:id/revoke", Auth.RequireAuth, Auth.RequireAdmin, async c =>
        {
            var data = await store.GetByIdAsync("c_apikeys", c.Params["id"]);
            if (data is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy khóa API"); return; }
            var next = J.CloneObj(data); next["active"] = false;
            await store.UpdateAsync("c_apikeys", c.Params["id"], next);
            await store.InsertAsync("c_audit", Guid.NewGuid().ToString(), new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString(), ["userId"] = c.User!.Sub, ["userName"] = c.User.Name,
                ["action"] = "Thu hồi khóa API", ["detail"] = $"Thu hồi khóa API \"{J.Str(data, "name")}\" (prefix {J.Str(data, "prefix")}…)", ["at"] = NowIso(),
            });
            Realtime.NotifyChange("apiKeys", "update", c.Params["id"]);
            await HttpUtil.Send(c.Res, 200, SanitizeApiKey(next));
        });

        app.Add("POST", "/api/apikeys/:id/enable", Auth.RequireAuth, Auth.RequireAdmin, async c =>
        {
            var data = await store.GetByIdAsync("c_apikeys", c.Params["id"]);
            if (data is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy khóa API"); return; }
            var next = J.CloneObj(data); next["active"] = true;
            await store.UpdateAsync("c_apikeys", c.Params["id"], next);
            await store.InsertAsync("c_audit", Guid.NewGuid().ToString(), new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString(), ["userId"] = c.User!.Sub, ["userName"] = c.User.Name,
                ["action"] = "Kích hoạt khóa API", ["detail"] = $"Kích hoạt lại khóa API \"{J.Str(data, "name")}\" (prefix {J.Str(data, "prefix")}…)", ["at"] = NowIso(),
            });
            Realtime.NotifyChange("apiKeys", "update", c.Params["id"]);
            await HttpUtil.Send(c.Res, 200, SanitizeApiKey(next));
        });

        // ---------------- BỘ API CÔNG BỐ (TRƯỚC CRUD chung) ----------------
        open.Register(app);

        // ---------------- TỐI ƯU 1: TẢI NỘI DUNG TỆP KHÔNG QUA BASE64 ----------------
        // GET /api/documents/:id/download và /api/guides/:id/download (TRƯỚC CRUD chung).
        // Kiểm quyền đọc Y HỆT GET :id (Access.ReadOne — tài liệu mật/lọc bản ghi -> 404) TRƯỚC
        // khi cấp presigned. redirect (mặc định): 302 tới presigned URL TTL ngắn (client tải
        // thẳng từ S3, backend 0 byte RAM). stream: backend kéo bytes rồi trả. Bản ghi cũ
        // (base64) / S3 tắt: giải mã base64 rồi stream (giữ tải được, không phá tương thích).
        app.Add("GET", "/api/documents/:id/download", Auth.RequireAuth, c => HandleFileDownload(c, store, access, blob, "documents"));
        app.Add("GET", "/api/guides/:id/download", Auth.RequireAuth, c => HandleFileDownload(c, store, access, blob, "guides"));

        // ---------------- Quản trị ----------------
        app.Add("POST", "/api/admin/reset", Auth.RequireAuth, Auth.RequireAdmin, async c =>
        {
            await Seed.SeedIfEmpty(store, true);
            Realtime.NotifyChange("*", "reset", "*");
            await HttpUtil.Send(c.Res, 200, new JsonObject { ["ok"] = true, ["message"] = "Đã khôi phục dữ liệu mẫu" });
        });

        // ---------------- CRUD chung ----------------
        app.Add("GET", "/api/:collection", Auth.RequireAuth, async c =>
        {
            var col = c.Params["collection"];
            if (!await EnsureTable(c)) return;
            var table = Db.TableOf(col)!;
            if (col == "audit" && c.User!.Role != "admin") { await HttpUtil.Send(c.Res, 200, new JsonArray()); return; }
            var rows = await store.GetAllAsync(table);
            if (col == "users") rows = rows.Select(SanitizeUser).ToList();
            if (col == "apiKeys") rows = rows.Select(SanitizeApiKey).ToList();
            var filtered = await access.FilterList(col, rows, c.User!);
            var arr = new JsonArray();
            foreach (var r in filtered) arr.Add(r);
            await HttpUtil.Send(c.Res, 200, arr);
        });

        app.Add("GET", "/api/:collection/:id", Auth.RequireAuth, async c =>
        {
            var col = c.Params["collection"];
            if (!await EnsureTable(c)) return;
            var table = Db.TableOf(col)!;
            if (col == "audit" && c.User!.Role != "admin") { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy bản ghi"); return; }
            var data = await store.GetByIdAsync(table, c.Params["id"]);
            if (data is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy bản ghi"); return; }
            var projected = col == "users" ? SanitizeUser(data) : col == "apiKeys" ? SanitizeApiKey(data) : data;
            var readable = await access.ReadOne(col, projected, c.User!);
            if (readable is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy bản ghi"); return; }
            // Tách file (GĐ3): nếu bản ghi đã externalize sang S3 (storageKey) -> dựng lại
            // dataUrl/fileData từ S3 để FE hiển thị y như cũ (khóa S3 KHÔNG lộ ra client).
            // S3 tắt hoặc bản ghi cũ (chỉ có dataUrl) -> trả nguyên (tương thích ngược).
            try
            {
                if (col == "documents") { await HttpUtil.Send(c.Res, 200, await Blob.InlineDocumentReadAsync(readable, blob)); return; }
                if (col == "guides") { await HttpUtil.Send(c.Res, 200, await Blob.InlineGuideReadAsync(readable, blob)); return; }
            }
            catch (Exception e) { await HttpUtil.SendError(c.Res, 502, $"Không đọc được nội dung tệp từ kho lưu trữ: {e.Message}"); return; }
            await HttpUtil.Send(c.Res, 200, readable);
        });

        app.Add("POST", "/api/:collection", Auth.RequireAuth, async c =>
        {
            var col = c.Params["collection"];
            if (!await EnsureTable(c)) return;
            var table = Db.TableOf(col)!;
            var bodyNode = await HttpUtil.ReadBody(c.Req);
            var body = bodyNode as JsonObject;
            if (body is null || J.Str(body, "id") is null) { await HttpUtil.SendError(c.Res, 400, "Thiếu id bản ghi"); return; }
            if (!Acl.Allowed(Acl.Rules[col].Create, c.User!, null, body)) { await HttpUtil.SendError(c.Res, 403, "Bạn không có quyền tạo dữ liệu này"); return; }
            if (col == "users")
            {
                var chk = await EnforceUserWrite(store, c.User!, "create", null, body);
                if (chk is not null) { await HttpUtil.SendError(c.Res, chk.Value.status, chk.Value.error); return; }
            }
            // P0-2: quản trị đơn vị tạo phiên họp — chủ trì/thư ký PHẢI thuộc đơn vị mình
            if (col == "meetings")
            {
                var chk = await EnforceMeetingWrite(store, c.User!, "create", null, body);
                if (chk is not null) { await HttpUtil.SendError(c.Res, chk.Value.status, chk.Value.error); return; }
            }
            // Khuyến nghị 1 (2026-07-18): unit_admin thêm tài liệu gắn phiên họp — CHỈ phiên thuộc đơn vị mình.
            if (col == "documents")
            {
                var chk = await EnforceDocumentWrite(store, c.User!, "create", body);
                if (chk is not null) { await HttpUtil.SendError(c.Res, chk.Value.status, chk.Value.error); return; }
            }
            // P1-6 — Phản hồi/góp ý: SERVER ép danh tính người gửi + phạm vi đơn vị (KHÔNG
            // tin client) — chống giả danh gửi hộ người khác hoặc lách phạm vi đơn vị.
            if (col == "feedbacks")
            {
                body["userId"] = c.User!.Sub;
                var self = await store.GetByIdAsync("c_users", c.User.Sub);
                body["unitId"] = self is not null ? J.Str(self, "unitId") : null;
                if (!J.Has(body, "status")) body["status"] = "new";
            }
            Guard.ValidatePatch(col, body); // ném 400 nếu sai kiểu
            // Tách file (GĐ3): S3 bật + payload có dataUrl/fileData base64 -> PUT S3, set
            // storageKey, XÓA base64 khỏi bản ghi lưu DB (chống phình DB). S3 tắt -> no-op.
            try
            {
                if (col == "documents") await Blob.ExternalizeDocumentWriteAsync(body, blob);
                if (col == "guides") await Blob.ExternalizeGuideWriteAsync(body, blob);
            }
            catch (Exception e) { await HttpUtil.SendError(c.Res, 502, $"Không lưu được tệp lên kho lưu trữ: {e.Message}"); return; }
            try
            {
                var id = J.Str(body, "id")!;
                if (col == "users")
                {
                    var password = J.Str(body, "password");
                    var data = J.CloneObj(body); data.Remove("password"); data["password"] = "";
                    await store.InsertUserAsync(id, data, (J.Str(body, "username") ?? "").ToLowerInvariant(), Auth.HashPassword(string.IsNullOrEmpty(password) ? "123456" : password));
                    Realtime.NotifyChange(col, "create", id);
                    await HttpUtil.Send(c.Res, 201, SanitizeUser(body));
                    return;
                }
                await store.InsertAsync(table, id, body);
                Realtime.NotifyChange(col, "create", id);
                await HttpUtil.Send(c.Res, 201, body);
            }
            catch (DuplicateKeyException)
            {
                await HttpUtil.SendError(c.Res, 400, col == "users" ? "Tên đăng nhập hoặc id đã tồn tại" : "Bản ghi đã tồn tại");
            }
        });

        app.Add("PATCH", "/api/:collection/:id", Auth.RequireAuth, async c =>
        {
            var col = c.Params["collection"];
            if (!await EnsureTable(c)) return;
            var table = Db.TableOf(col)!;
            var existing = await store.GetByIdAsync(table, c.Params["id"]);
            if (existing is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy bản ghi"); return; }
            var patch = await HttpUtil.ReadBodyObj(c.Req);
            var aclOk = Acl.Allowed(Acl.Rules[col].Update, c.User!, existing, patch);
            // P0-3: tài liệu — ACL thô "ownerOrManage" sẽ chặn "Thành viên dự họp" (không phải
            // owner/MANAGE) TRƯỚC KHI GuardDocuments có cơ hội chạy. Mở lối đi HẸP: cho qua ACL
            // NẾU đây đúng là 1 yêu cầu DUYỆT hợp lệ của thành phần phiên.
            JsonObject? meetingForDocs = null;
            if (!aclOk && col == "documents" && J.Str(existing, "meetingId") is string mid1)
            {
                meetingForDocs = await store.GetByIdAsync("c_meetings", mid1);
                aclOk = Guard.CanReviewDocumentAsMeetingMember(existing, patch, c.User!, meetingForDocs);
            }
            if (!aclOk) { await HttpUtil.SendError(c.Res, 403, "Bạn không có quyền cập nhật bản ghi này"); return; }
            if (col == "users")
            {
                var chk = await EnforceUserWrite(store, c.User!, "update", existing, patch);
                if (chk is not null) { await HttpUtil.SendError(c.Res, chk.Value.status, chk.Value.error); return; }
            }
            // Khuyến nghị 1 (2026-07-18): unit_admin SỬA phiên họp — chỉ trong phạm vi đơn vị
            // mình, không "chuyển" phiên sang đơn vị khác (xem EnforceMeetingWrite).
            if (col == "meetings")
            {
                var chk = await EnforceMeetingWrite(store, c.User!, "update", existing, patch);
                if (chk is not null) { await HttpUtil.SendError(c.Res, chk.Value.status, chk.Value.error); return; }
            }
            Guard.ValidatePatch(col, patch, existing); // P1-7: chặn kiểu sai + định dạng tệp trước khi ghi
            // P0-3: tài liệu gắn phiên họp — nạp phiên đó (tái dùng nếu đã nạp ở bước ACL trên)
            // để GuardDocuments biết ai là "thành phần phiên" được phép duyệt, không chỉ MANAGE.
            // GuardDocuments ĐỘC LẬP kiểm tra lại toàn bộ điều kiện (defense-in-depth).
            JsonObject? meetingCtx = meetingForDocs;
            if (col == "documents" && meetingCtx is null && J.Str(existing, "meetingId") is string mid)
                meetingCtx = await store.GetByIdAsync("c_meetings", mid);
            // P1-6 (vá QA 18/07): unit_admin xử lý phản hồi TRONG ĐƠN VỊ MÌNH — unitId đọc từ DB (JWT không mang unitId).
            string? actorUnitId = null;
            if (col == "feedbacks" && c.User!.Role == "unit_admin")
            {
                var selfU = await store.GetByIdAsync("c_users", c.User.Sub);
                actorUnitId = selfU is null ? null : J.Str(selfU, "unitId");
            }
            // Khuyến nghị 1: unit_admin SỬA phiên — GuardMeetings cần đơn vị của CHÍNH unit_admin
            // (actorUnitId) + đơn vị của phiên ĐANG SỬA (meetingUnitId, suy từ chairId/secretaryId
            // HIỆN CÓ) để coi unit_admin-cùng-đơn-vị như MANAGE cho field nội dung.
            // EnforceMeetingWrite() ở trên đã chặn 403 nếu KHÔNG cùng đơn vị — đây chỉ tính GIÁ
            // TRỊ để GuardMeetings tự kiểm tra lại độc lập (defense-in-depth).
            string? meetingUnitId = null;
            if (col == "meetings" && c.User!.Role == "unit_admin")
            {
                var selfM = await store.GetByIdAsync("c_users", c.User.Sub);
                actorUnitId = selfM is null ? null : J.Str(selfM, "unitId");
                meetingUnitId = await UnitOfMeeting(store, existing);
            }
            patch = Guard.GuardPatch(col, existing, patch, c.User!, meetingCtx, actorUnitId, meetingUnitId);

            if (col == "users")
            {
                if (c.User!.Role != "admin" && c.User.Role != "unit_admin")
                {
                    patch.Remove("role"); patch.Remove("status"); patch.Remove("username");
                }
                string? passwordHash = null;
                if (J.Str(patch, "password") is string pw && !string.IsNullOrEmpty(pw)) { passwordHash = Auth.HashPassword(pw); patch.Remove("password"); }
                else patch.Remove("password");
                var merged = J.ShallowMerge(existing, patch); merged["password"] = "";
                await store.UpdateUserAsync(c.Params["id"], merged, (J.Str(merged, "username") ?? "").ToLowerInvariant(), passwordHash);
                Realtime.NotifyChange(col, "update", c.Params["id"]);
                await HttpUtil.Send(c.Res, 200, SanitizeUser(merged));
                return;
            }

            var merged2 = J.ShallowMerge(existing, patch);
            // Tách file (GĐ3): nếu PATCH mang dataUrl/fileData base64 MỚI (tải lại tệp) và S3
            // bật -> PUT S3, set storageKey, xóa base64. Patch không đụng tệp -> giữ storageKey
            // đã có (no-op). S3 tắt -> giữ base64 như cũ.
            try
            {
                if (col == "documents") await Blob.ExternalizeDocumentWriteAsync(merged2, blob);
                if (col == "guides") await Blob.ExternalizeGuideWriteAsync(merged2, blob);
            }
            catch (Exception e) { await HttpUtil.SendError(c.Res, 502, $"Không lưu được tệp lên kho lưu trữ: {e.Message}"); return; }
            await store.UpdateAsync(table, c.Params["id"], merged2);
            Realtime.NotifyChange(col, "update", c.Params["id"]);
            // Trả cho FE: nếu đã externalize thì dựng lại dataUrl/fileData (hiển thị như cũ).
            if (col == "documents") { await HttpUtil.Send(c.Res, 200, await SafeInlineDoc(merged2, blob)); return; }
            if (col == "guides") { await HttpUtil.Send(c.Res, 200, await SafeInlineGuide(merged2, blob)); return; }
            await HttpUtil.Send(c.Res, 200, col == "apiKeys" ? SanitizeApiKey(merged2) : merged2);
        });

        app.Add("DELETE", "/api/:collection/:id", Auth.RequireAuth, async c =>
        {
            var col = c.Params["collection"];
            if (!await EnsureTable(c)) return;
            var table = Db.TableOf(col)!;
            var existing = await store.GetByIdAsync(table, c.Params["id"]);
            if (existing is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy bản ghi"); return; }
            if (!Acl.Allowed(Acl.Rules[col].Remove, c.User!, existing, null)) { await HttpUtil.SendError(c.Res, 403, "Bạn không có quyền xóa bản ghi này"); return; }
            if (col == "users" && c.Params["id"] == c.User!.Sub) { await HttpUtil.SendError(c.Res, 400, "Không thể tự xóa tài khoản đang đăng nhập"); return; }
            // Khuyến nghị 1 (2026-07-18): unit_admin XÓA phiên họp — chỉ đơn vị mình + CHƯA
            // diễn ra (draft/invited) để tránh mất dữ liệu phiên "live"/"finished".
            if (col == "meetings")
            {
                var chk = await EnforceMeetingWrite(store, c.User!, "delete", existing, null);
                if (chk is not null) { await HttpUtil.SendError(c.Res, chk.Value.status, chk.Value.error); return; }
            }
            await store.DeleteAsync(table, c.Params["id"]);
            Realtime.NotifyChange(col, "remove", c.Params["id"]);
            // TỐI ƯU 2: tài liệu/guide đã externalize (storageKey) + S3 bật -> DỌN object S3 mồ côi.
            // BEST-EFFORT sau khi xóa DB thành công; lỗi S3 chỉ nuốt (không ném) để rác S3 không
            // chặn nghiệp vụ xóa. Xóa HẾT key liên quan (kể cả version cũ nếu có versions[]).
            if ((col == "documents" || col == "guides") && blob.Configured())
            {
                var keys = col == "documents" ? Blob.DocumentStorageKeys(existing) : Blob.GuideStorageKeys(existing);
                foreach (var k in keys)
                {
                    try { await blob.DeleteAsync(k); }
                    catch (Exception e) { Console.Error.WriteLine($"[blob] Dọn object S3 khi xóa {col}/{c.Params["id"]} thất bại (bỏ qua): {e.Message}"); }
                }
            }
            await HttpUtil.Send(c.Res, 200, new JsonObject { ["ok"] = true });
        });

        app.Add("PUT", "/api/:collection", Auth.RequireAuth, Auth.RequireAdmin, async c =>
        {
            var col = c.Params["collection"];
            if (!await EnsureTable(c)) return;
            var table = Db.TableOf(col)!;
            var itemsNode = await HttpUtil.ReadBody(c.Req);
            if (itemsNode is not JsonArray items) { await HttpUtil.SendError(c.Res, 400, "Body phải là mảng"); return; }
            await store.DeleteAllAsync(table);
            foreach (var itemN in items)
            {
                if (itemN is not JsonObject item) continue;
                var id = J.Str(item, "id") ?? Guid.NewGuid().ToString();
                if (col == "users")
                {
                    var password = J.Str(item, "password");
                    var data = J.CloneObj(item); data.Remove("password"); data["password"] = "";
                    await store.InsertUserAsync(id, data, (J.Str(item, "username") ?? "").ToLowerInvariant(), Auth.HashPassword(string.IsNullOrEmpty(password) ? "123456" : password));
                }
                else
                {
                    await store.InsertAsync(table, id, item);
                }
            }
            Realtime.NotifyChange(col, "replace", "*");
            await HttpUtil.Send(c.Res, 200, new JsonObject { ["ok"] = true, ["count"] = items.Count });
        });

        // ---------------- Actions nghiệp vụ ----------------
        actions.Register(app);

        return app;
    }

    private static string NowIso() => DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

    /// <summary>
    /// KIỂM TRA SÂU thao tác users cho unit_admin (port enforceUserWrite). Trả null nếu OK,
    /// hoặc (status,error) để chặn. unitId của unit_admin ĐỌC TỪ store (không tin body).
    /// </summary>
    private static async Task<(int status, string error)?> EnforceUserWrite(IDocStore store, JwtPayload user, string op, JsonObject? existing, JsonObject body)
    {
        if (user.Role != "unit_admin") return null;
        var self = await store.GetByIdAsync("c_users", user.Sub);
        var myUnit = self is null ? null : J.Str(self, "unitId");
        if (string.IsNullOrEmpty(myUnit)) return (403, "Không xác định được đơn vị của bạn");

        // (b) không gán vai trò admin cho bất kỳ ai
        if (J.Has(body, "role") && J.Str(body, "role") == "admin")
            return (403, "Quản trị đơn vị không được cấp vai trò Quản trị hệ thống");

        if (op == "update")
        {
            if (existing is not null && J.Str(existing, "id") == user.Sub)
            {
                if (J.Has(body, "unitId") && J.Str(body, "unitId") != myUnit)
                    return (403, "Không được tự đổi đơn vị của mình");
                if (J.Has(body, "role") && J.Str(body, "role") != J.Str(existing, "role"))
                    return (403, "Không được tự đổi vai trò của mình");
                return null;
            }
            if (existing is not null && J.Str(existing, "role") == "admin")
                return (403, "Không được sửa tài khoản Quản trị hệ thống");
            if (existing is null || J.Str(existing, "unitId") != myUnit)
                return (403, "Bạn chỉ quản lý người dùng trong đơn vị của mình");
            if (J.Has(body, "unitId") && J.Str(body, "unitId") != myUnit)
                return (403, "Không được chuyển người dùng sang đơn vị khác");
        }
        else // create
        {
            if (J.Str(body, "unitId") != myUnit)
                return (403, "Chỉ được tạo người dùng trong đơn vị của mình");
        }
        return null;
    }

    /// <summary>Trạng thái phiên coi là "CHƯA diễn ra" (đủ điều kiện cho unit_admin XÓA).</summary>
    private static readonly string[] NotStartedStatuses = { "draft", "invited" };

    /// <summary>
    /// Đơn vị của MỘT phiên họp — suy từ đơn vị của chủ trì HOẶC thư ký (Meeting KHÔNG có
    /// field unitId riêng). Port unitOfMeeting (index.js) — cùng khái niệm với Access.cs
    /// MeetingInvolvesUnit nhưng đơn giản hơn (chỉ cần "đơn vị chủ trì/thư ký").
    /// </summary>
    private static async Task<string?> UnitOfMeeting(IDocStore store, JsonObject? m)
    {
        var chairId = m is null ? null : J.Str(m, "chairId");
        var chair = !string.IsNullOrEmpty(chairId) ? await store.GetByIdAsync("c_users", chairId) : null;
        var chairUnit = chair is null ? null : J.Str(chair, "unitId");
        if (!string.IsNullOrEmpty(chairUnit)) return chairUnit;
        var secId = m is null ? null : J.Str(m, "secretaryId");
        var sec = !string.IsNullOrEmpty(secId) ? await store.GetByIdAsync("c_users", secId) : null;
        return sec is null ? null : J.Str(sec, "unitId");
    }

    /// <summary>
    /// P0-2 (mở rộng đợt vá 2026-07-18, khuyến nghị 1) — KIỂM TRA SÂU khi QUẢN TRỊ ĐƠN VỊ
    /// (unit_admin) TẠO/SỬA/XÓA phiên họp (HSMT dòng 354-355: "Quản trị đơn vị nhập thông
    /// tin cuộc họp... quản lý phiên họp trong phạm vi đơn vị mình"). Meeting KHÔNG có field
    /// unitId riêng — "đơn vị của phiên" suy từ đơn vị của chủ trì/thư ký (UnitOfMeeting()).
    /// unitId của unit_admin ĐỌC TỪ store (không tin body); chairId/secretaryId (hiện có LẪN
    /// gửi lên trong body) cũng tra unitId THẬT từ store. admin/secretary/chairman: bỏ qua
    /// hoàn toàn ở MỌI op (không đổi hành vi MANAGE).
    /// Port EnforceMeetingWrite (index.js).
    ///
    /// op = "create" | "update" | "delete".
    ///  - create : chairId/secretaryId trong body PHẢI thuộc đơn vị mình (logic cũ, giữ nguyên).
    ///  - update : đơn vị của phiên HIỆN TẠI (existing) PHẢI thuộc đơn vị mình; nếu body cố
    ///             đổi chairId/secretaryId sang người KHÁC đơn vị -> chặn (chống "chuyển"
    ///             phiên sang đơn vị khác).
    ///  - delete : đơn vị của phiên (existing) PHẢI thuộc đơn vị mình; VÀ status phải CHƯA
    ///             diễn ra (draft/invited) để tránh mất dữ liệu phiên "live"/"finished".
    /// </summary>
    private static async Task<(int status, string error)?> EnforceMeetingWrite(IDocStore store, JwtPayload user, string op, JsonObject? existing, JsonObject? body)
    {
        if (user.Role != "unit_admin") return null;
        var self = await store.GetByIdAsync("c_users", user.Sub);
        var myUnit = self is null ? null : J.Str(self, "unitId");
        if (string.IsNullOrEmpty(myUnit)) return (403, "Không xác định được đơn vị của bạn");

        if (op == "create")
        {
            var chairId = J.Str(body, "chairId");
            var chair = !string.IsNullOrEmpty(chairId) ? await store.GetByIdAsync("c_users", chairId) : null;
            if (chair is null || J.Str(chair, "unitId") != myUnit)
                return (403, "Chủ trì phiên họp phải thuộc đơn vị của bạn");

            var secId = J.Str(body, "secretaryId");
            if (!string.IsNullOrEmpty(secId))
            {
                var sec = await store.GetByIdAsync("c_users", secId);
                if (sec is null || J.Str(sec, "unitId") != myUnit)
                    return (403, "Thư ký phiên họp phải thuộc đơn vị của bạn");
            }
            return null;
        }

        // update/delete: phiên HIỆN TẠI phải thuộc đơn vị mình
        var currentUnit = await UnitOfMeeting(store, existing);
        if (currentUnit != myUnit)
            return (403, "Bạn chỉ quản lý phiên họp trong phạm vi đơn vị của mình");

        if (op == "delete")
        {
            var st = existing is null ? null : J.Str(existing, "status");
            if (st is null || !NotStartedStatuses.Contains(st))
                return (403, "Chỉ xóa được phiên họp CHƯA diễn ra (nháp/đã gửi giấy mời)");
            return null;
        }

        // op == "update": nếu body cố đổi chủ trì/thư ký -> người MỚI cũng phải thuộc đơn vị mình
        if (body is not null && J.Has(body, "chairId") && J.Str(body, "chairId") != J.Str(existing, "chairId"))
        {
            var newChairId = J.Str(body, "chairId");
            var newChair = !string.IsNullOrEmpty(newChairId) ? await store.GetByIdAsync("c_users", newChairId) : null;
            if (newChair is null || J.Str(newChair, "unitId") != myUnit)
                return (403, "Chủ trì mới phải thuộc đơn vị của bạn");
        }
        if (body is not null && J.Has(body, "secretaryId") && J.Str(body, "secretaryId") != J.Str(existing, "secretaryId"))
        {
            var newSecId = J.Str(body, "secretaryId");
            var newSec = !string.IsNullOrEmpty(newSecId) ? await store.GetByIdAsync("c_users", newSecId) : null;
            if (newSec is null || J.Str(newSec, "unitId") != myUnit)
                return (403, "Thư ký mới phải thuộc đơn vị của bạn");
        }
        return null;
    }

    /// <summary>
    /// Khuyến nghị 1 (2026-07-18, chốt code chéo) — QUẢN TRỊ ĐƠN VỊ (unit_admin) THÊM/GẮN
    /// TÀI LIỆU VÀO PHIÊN HỌP: chỉ được thao tác cho phiên THUỘC ĐƠN VỊ MÌNH. Acl.Rules
    /// documents.Create = "any" vốn cho MỌI vai trò đăng nhập tạo tài liệu (kể cả không
    /// gắn phiên); nhánh này SIẾT THÊM riêng cho unit_admin khi body có meetingId — tra đơn
    /// vị của phiên đó (UnitOfMeeting) và so với đơn vị của unit_admin. delegate/MANAGE
    /// không bị ảnh hưởng. Port EnforceDocumentWrite (index.js).
    /// Chỉ áp cho op "create" — sửa/trình-duyệt tài liệu ĐÃ TỒN TẠI đi qua ACL "ownerOrManage"
    /// (chỉ owner/MANAGE update nội dung); tài liệu unit_admin tạo vốn đã đúng phạm vi.
    /// </summary>
    private static async Task<(int status, string error)?> EnforceDocumentWrite(IDocStore store, JwtPayload user, string op, JsonObject body)
    {
        var meetingId = J.Str(body, "meetingId");
        if (user.Role != "unit_admin" || op != "create" || string.IsNullOrEmpty(meetingId)) return null;
        var self = await store.GetByIdAsync("c_users", user.Sub);
        var myUnit = self is null ? null : J.Str(self, "unitId");
        if (string.IsNullOrEmpty(myUnit)) return (403, "Không xác định được đơn vị của bạn");
        var meeting = await store.GetByIdAsync("c_meetings", meetingId);
        if (meeting is null) return (404, "Không tìm thấy phiên họp");
        var meetingUnit = await UnitOfMeeting(store, meeting);
        if (meetingUnit != myUnit)
            return (403, "Bạn chỉ được thêm tài liệu cho phiên họp thuộc đơn vị của mình");
        return null;
    }
}
