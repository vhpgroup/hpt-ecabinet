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
    public static void ConfigurePipeline(IApplicationBuilder app, IDocStore store)
    {
        var router = BuildRouter(store);
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

    // ---------------- Router (port toàn bộ route index.js theo đúng thứ tự) ----------------
    private static Router BuildRouter(IDocStore store)
    {
        var app = new Router();
        var sessions = new Sessions(store);
        var access = new Access(store);
        var actions = new Actions(store);
        var rtc = new Rtc(store);
        var open = new OpenRoutes(store);

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
                var chk = await EnforceMeetingWrite(store, c.User!, "create", body);
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
            patch = Guard.GuardPatch(col, existing, patch, c.User!, meetingCtx, actorUnitId);

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
            await store.UpdateAsync(table, c.Params["id"], merged2);
            Realtime.NotifyChange(col, "update", c.Params["id"]);
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
            await store.DeleteAsync(table, c.Params["id"]);
            Realtime.NotifyChange(col, "remove", c.Params["id"]);
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

    /// <summary>
    /// P0-2 — KIỂM TRA SÂU khi QUẢN TRỊ ĐƠN VỊ (unit_admin) TẠO phiên họp (HSMT dòng
    /// 354-355). Meeting KHÔNG có field unitId riêng — "đơn vị của phiên" suy ra từ đơn vị
    /// của chủ trì/thư ký (giống Open API/Access.cs). unitId của unit_admin ĐỌC TỪ store
    /// (không tin body); chairId/secretaryId gửi lên cũng tra unitId THẬT từ store.
    /// admin/secretary/chairman: bỏ qua (đã được ACL cho tạo tự do như trước). Chỉ áp cho
    /// op "create" — PHẠM VI P0-2 không mở rộng quyền SỬA meeting cho unit_admin.
    /// </summary>
    private static async Task<(int status, string error)?> EnforceMeetingWrite(IDocStore store, JwtPayload user, string op, JsonObject body)
    {
        if (user.Role != "unit_admin" || op != "create") return null;
        var self = await store.GetByIdAsync("c_users", user.Sub);
        var myUnit = self is null ? null : J.Str(self, "unitId");
        if (string.IsNullOrEmpty(myUnit)) return (403, "Không xác định được đơn vị của bạn");

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
}
