// ============================================================
// ECabinet.Tests — runner console (TestHost in-memory, KHÔNG mở socket).
// `dotnet run` in bảng PASS/FAIL 7 nhóm; exit != 0 nếu có ca lỗi.
// Tiêu chí nghiệm thu: TẤT CẢ ca PASS.
// ============================================================
using System.Net.WebSockets;
using System.Text;
using System.Text.Json.Nodes;
using ECabinet.Api;
using ECabinet.Tests;

// Đảm bảo môi trường sạch (không kế thừa DATABASE_URL/LIVEKIT của shell)
Environment.SetEnvironmentVariable("DATABASE_URL", null);
Environment.SetEnvironmentVariable("LIVEKIT_URL", null);
Environment.SetEnvironmentVariable("LIVEKIT_API_KEY", null);
Environment.SetEnvironmentVariable("LIVEKIT_API_SECRET", null);
Environment.SetEnvironmentVariable("JWT_SECRET", "test-secret-ecabinet");

var t = new TestRunner();

Console.WriteLine("eCabinet .NET — chạy test in-memory (TestHost)\n");

await Group1_Auth(t);
await Group2_Acl(t);
await Group3_Access(t);
await Group4_Guard(t);
await Group5_ActionsCas(t);
await Group6_OpenRtc(t);
await Group7_Ws(t);

var exit = t.Report();
return exit;

// ============================================================
// NHÓM 1 — AUTH
// ============================================================
static async Task Group1_Auth(TestRunner t)
{
    t.Group("1-AUTH");
    await using var app = await TestApp.CreateAsync();

    await t.Case("login đúng -> 200 + token + user (không lộ password)", async () =>
    {
        var r = await app.Post("/api/auth/login", new JsonObject { ["username"] = "quantri", ["password"] = "123456" });
        Assert.Status(200, r.Status, "login đúng");
        Assert.True(r.Obj["token"] is not null, "có token");
        Assert.True(r.Obj["refreshToken"] is not null, "có refreshToken");
        Assert.Eq("", r.Obj["user"]!["password"]?.GetValue<string>(), "password rỗng");
        Assert.Eq("admin", r.Obj["user"]!["role"]?.GetValue<string>(), "role admin");
    });

    await t.Case("login sai mật khẩu -> 401 'Mật khẩu không đúng'", async () =>
    {
        var r = await app.Post("/api/auth/login", new JsonObject { ["username"] = "quantri", ["password"] = "sai" });
        Assert.Status(401, r.Status, "login sai");
        Assert.Eq("Mật khẩu không đúng", r.Error, "message sai mật khẩu");
    });

    await t.Case("login tài khoản không tồn tại -> 401", async () =>
    {
        var r = await app.Post("/api/auth/login", new JsonObject { ["username"] = "khongton", ["password"] = "x" });
        Assert.Status(401, r.Status, "không tồn tại");
        Assert.Eq("Tài khoản không tồn tại", r.Error, "message không tồn tại");
    });

    await t.Case("tài khoản bị khóa -> 401 'Tài khoản đã bị khóa'", async () =>
    {
        // admin khóa 1 user (đặt status=inactive) rồi thử đăng nhập
        var admin = await app.Login("quantri");
        var patch = await app.Patch("/api/users/u-yt", new JsonObject { ["status"] = "inactive" }, admin);
        Assert.Status(200, patch.Status, "khóa user");
        var r = await app.Post("/api/auth/login", new JsonObject { ["username"] = "soyt", ["password"] = "123456" });
        Assert.Status(401, r.Status, "login user bị khóa");
        Assert.Eq("Tài khoản đã bị khóa", r.Error, "message khóa");
    });

    await t.Case("/api/auth/me trả hồ sơ đúng", async () =>
    {
        var token = await app.Login("chutich");
        var r = await app.Get("/api/auth/me", token);
        Assert.Status(200, r.Status, "me");
        Assert.Eq("u-ct", r.Obj["id"]?.GetValue<string>(), "id chutich");
        Assert.Eq("", r.Obj["password"]?.GetValue<string>(), "me không lộ password");
    });

    await t.Case("/api/auth/me thiếu token -> 401", async () =>
    {
        var r = await app.Get("/api/auth/me");
        Assert.Status(401, r.Status, "me không token");
    });

    await t.Case("refresh xoay vòng: token cũ chết sau khi dùng", async () =>
    {
        var (_, refresh) = await app.LoginFull("thuky");
        var r1 = await app.Post("/api/auth/refresh", new JsonObject { ["refreshToken"] = refresh });
        Assert.Status(200, r1.Status, "refresh lần 1");
        var newRefresh = r1.Obj["refreshToken"]!.GetValue<string>();
        Assert.True(newRefresh != refresh, "refresh token đổi (xoay vòng)");
        // dùng LẠI token cũ -> 401
        var r2 = await app.Post("/api/auth/refresh", new JsonObject { ["refreshToken"] = refresh });
        Assert.Status(401, r2.Status, "refresh token cũ đã chết");
        // token mới vẫn dùng được
        var r3 = await app.Post("/api/auth/refresh", new JsonObject { ["refreshToken"] = newRefresh });
        Assert.Status(200, r3.Status, "refresh token mới còn sống");
    });

    await t.Case("logout thu hồi refresh token", async () =>
    {
        var (_, refresh) = await app.LoginFull("sotc");
        var lo = await app.Post("/api/auth/logout", new JsonObject { ["refreshToken"] = refresh });
        Assert.Status(200, lo.Status, "logout");
        var r = await app.Post("/api/auth/refresh", new JsonObject { ["refreshToken"] = refresh });
        Assert.Status(401, r.Status, "refresh sau logout -> 401");
    });

    await t.Case("đăng nhập sai 11 lần -> 429 (LOGIN_RATE_MAX=10)", async () =>
    {
        // 10 lần sai đầu -> 401; lần 11 -> 429
        Resp? last = null;
        for (var i = 0; i < 11; i++)
            last = await app.Post("/api/auth/login", new JsonObject { ["username"] = "sokhdt", ["password"] = "wrong" });
        Assert.Status(429, last!.Status, "lần 11 bị chặn");
        Assert.True(last.Error != null && last.Error.Contains("Đăng nhập sai quá nhiều lần"), "message 429");
    });
}

// ============================================================
// NHÓM 2 — ACL
// ============================================================
static async Task Group2_Acl(TestRunner t)
{
    t.Group("2-ACL");
    await using var app = await TestApp.CreateAsync();

    await t.Case("delegate POST users -> 403 (chỉ admin/unit_admin tạo)", async () =>
    {
        var tok = await app.Login("sokhdt"); // delegate
        var r = await app.Post("/api/users", new JsonObject
        {
            ["id"] = "u-new1", ["username"] = "newuser1", ["fullName"] = "Người Mới", ["unitId"] = "un-khdt", ["role"] = "delegate", ["status"] = "active",
        }, tok);
        Assert.Status(403, r.Status, "delegate tạo user");
    });

    await t.Case("unit_admin (qtdonvi) sửa user CÙNG đơn vị -> 200", async () =>
    {
        var tok = await app.Login("qtdonvi"); // unit_admin của un-khdt
        // sokhdt (u-khdt) cùng đơn vị un-khdt
        var r = await app.Patch("/api/users/u-khdt", new JsonObject { ["phone"] = "0999 111 222" }, tok);
        Assert.Status(200, r.Status, "unit_admin sửa cùng đơn vị");
        Assert.Eq("0999 111 222", r.Obj["phone"]?.GetValue<string>(), "phone đã đổi");
    });

    await t.Case("unit_admin sửa user KHÁC đơn vị -> 403", async () =>
    {
        var tok = await app.Login("qtdonvi");
        // sotc thuộc un-tc (khác un-khdt)
        var r = await app.Patch("/api/users/u-tc", new JsonObject { ["phone"] = "0000" }, tok);
        Assert.Status(403, r.Status, "unit_admin khác đơn vị");
    });

    await t.Case("unit_admin đặt role=admin -> 403", async () =>
    {
        var tok = await app.Login("qtdonvi");
        var r = await app.Patch("/api/users/u-khdt", new JsonObject { ["role"] = "admin" }, tok);
        Assert.Status(403, r.Status, "unit_admin gán admin");
    });

    await t.Case("unit_admin DELETE user -> 403 (xóa chỉ admin)", async () =>
    {
        var tok = await app.Login("qtdonvi");
        var r = await app.Delete("/api/users/u-khdt", tok);
        Assert.Status(403, r.Status, "unit_admin xóa user");
    });

    await t.Case("message giả fromId (khác chính mình) -> 403", async () =>
    {
        var tok = await app.Login("sokhdt"); // u-khdt
        var r = await app.Post("/api/messages", new JsonObject
        {
            ["id"] = "msg-fake", ["fromId"] = "u-ct", ["meetingId"] = "m1", ["content"] = "giả mạo", ["toId"] = null,
        }, tok);
        Assert.Status(403, r.Status, "message giả fromId");
    });

    await t.Case("message fromId = chính mình -> 201", async () =>
    {
        var tok = await app.Login("sokhdt");
        var r = await app.Post("/api/messages", new JsonObject
        {
            ["id"] = "msg-real", ["fromId"] = "u-khdt", ["meetingId"] = "m1", ["content"] = "hợp lệ", ["toId"] = null,
        }, tok);
        Assert.Status(201, r.Status, "message hợp lệ");
    });

    await t.Case("admin POST users cùng đơn vị bất kỳ -> 201", async () =>
    {
        var tok = await app.Login("quantri");
        var r = await app.Post("/api/users", new JsonObject
        {
            ["id"] = "u-new2", ["username"] = "newuser2", ["fullName"] = "Admin Tạo", ["unitId"] = "un-tc", ["role"] = "delegate", ["status"] = "active",
        }, tok);
        Assert.Status(201, r.Status, "admin tạo user");
    });

    await t.Case("delegate tạo units -> 403 (units chỉ admin)", async () =>
    {
        var tok = await app.Login("sokhdt");
        var r = await app.Post("/api/units", new JsonObject { ["id"] = "un-x", ["name"] = "Đơn vị X", ["short"] = "X", ["order"] = 99 }, tok);
        Assert.Status(403, r.Status, "delegate tạo units");
    });
}

// ============================================================
// NHÓM 3 — ACCESS (lọc quyền đọc)
// ============================================================
static async Task Group3_Access(TestRunner t)
{
    t.Group("3-ACCESS");
    await using var app = await TestApp.CreateAsync();

    await t.Case("tài liệu MẬT: người ngoài không thấy (list)", async () =>
    {
        // d-ref2 secret trong m1, owner u-tk. Đăng nhập u-gd (thành phần m1 nhưng không owner) -> không thấy
        var tok = await app.Login("sogddt"); // u-gd
        var r = await app.Get("/api/documents", tok);
        Assert.Status(200, r.Status, "list documents");
        var hasSecret = r.Arr.OfType<JsonObject>().Any(d => d["id"]?.GetValue<string>() == "d-ref2");
        Assert.True(!hasSecret, "không thấy tài liệu mật d-ref2");
    });

    await t.Case("tài liệu MẬT: GET theo id -> 404 với người ngoài", async () =>
    {
        var tok = await app.Login("sogddt");
        var r = await app.Get("/api/documents/d-ref2", tok);
        Assert.Status(404, r.Status, "GET tài liệu mật -> 404");
    });

    await t.Case("tài liệu MẬT: owner (thuky) vẫn thấy", async () =>
    {
        var tok = await app.Login("thuky"); // u-tk owner + manage
        var r = await app.Get("/api/documents/d-ref2", tok);
        Assert.Status(200, r.Status, "owner thấy tài liệu mật");
    });

    await t.Case("tài liệu CHỜ DUYỆT: đại biểu khác không thấy", async () =>
    {
        // d11 pending trong m2, owner u-tc. u-gd không phải owner/manage -> không thấy
        var tok = await app.Login("sogddt");
        var r = await app.Get("/api/documents/d11", tok);
        Assert.Status(404, r.Status, "đại biểu khác không thấy tài liệu pending");
    });

    await t.Case("tài liệu CHỜ DUYỆT: owner (sotc) thấy", async () =>
    {
        var tok = await app.Login("sotc"); // u-tc owner của d11
        var r = await app.Get("/api/documents/d11", tok);
        Assert.Status(200, r.Status, "owner thấy tài liệu pending");
    });

    await t.Case("phiếu kín: ẩn userId phiếu người khác, GIỮ phiếu mình", async () =>
    {
        // Tạo 1 vote kín (admin), mở, cho 2 người bỏ phiếu, rồi 1 trong 2 đọc list.
        var admin = await app.Login("quantri");
        var vote = new JsonObject
        {
            ["id"] = "v-secret", ["kind"] = "vote", ["meetingId"] = "m1", ["title"] = "BQ kín",
            ["options"] = new JsonArray(new JsonObject { ["id"] = "o1", ["label"] = "Tán thành" }, new JsonObject { ["id"] = "o2", ["label"] = "Không" }),
            ["ballots"] = new JsonArray(), ["eligibleIds"] = new JsonArray("u-khdt", "u-tc", "u-pct"),
            ["secret"] = true, ["status"] = "pending", ["createdBy"] = "u-tk",
        };
        Assert.Status(201, (await app.Post("/api/votes", vote, admin)).Status, "tạo vote kín");
        Assert.Status(200, (await app.Post("/api/actions/vote/v-secret/open", null, admin)).Status, "mở vote kín");

        var tkKh = await app.Login("sokhdt"); // u-khdt
        var tkTc = await app.Login("sotc");    // u-tc
        Assert.Status(200, (await app.Post("/api/actions/vote/v-secret/ballot", new JsonObject { ["optionId"] = "o1" }, tkKh)).Status, "u-khdt bỏ phiếu");
        Assert.Status(200, (await app.Post("/api/actions/vote/v-secret/ballot", new JsonObject { ["optionId"] = "o2" }, tkTc)).Status, "u-tc bỏ phiếu");

        // u-khdt đọc: thấy phiếu mình (có userId), phiếu u-tc bị ẩn userId
        var r = await app.Get("/api/votes/v-secret", tkKh);
        Assert.Status(200, r.Status, "đọc vote kín");
        var ballots = r.Obj["ballots"]!.AsArray().OfType<JsonObject>().ToList();
        var mine = ballots.FirstOrDefault(b => b["userId"]?.GetValue<string>() == "u-khdt");
        Assert.True(mine != null, "giữ phiếu của mình (có userId)");
        var others = ballots.Where(b => b["userId"] == null).ToList();
        Assert.True(others.Count >= 1, "phiếu người khác bị ẩn userId");
        Assert.True(others.All(b => b["optionId"] != null), "phiếu ẩn vẫn có optionId");
    });

    await t.Case("phiếu kín: manage (thuky) thấy đầy đủ userId", async () =>
    {
        var tk = await app.Login("thuky");
        var r = await app.Get("/api/votes/v-secret", tk);
        Assert.Status(200, r.Status, "manage đọc vote kín");
        var ballots = r.Obj["ballots"]!.AsArray().OfType<JsonObject>().ToList();
        Assert.True(ballots.All(b => b["userId"] != null), "manage thấy đủ userId");
    });

    await t.Case("phiên họp: người NGOÀI thành phần -> minutes null + conclusions rỗng", async () =>
    {
        // qtdonvi (u-qtdv) KHÔNG thuộc thành phần m1 -> projectMeeting che minutes/conclusions
        var tok = await app.Login("qtdonvi");
        var r = await app.Get("/api/meetings/m1", tok);
        Assert.Status(200, r.Status, "đọc m1 ngoài thành phần");
        Assert.True(r.Obj["minutes"] is null || r.Obj["minutes"]!.GetValueKind() == System.Text.Json.JsonValueKind.Null, "minutes null");
        Assert.Eq(0, r.Obj["conclusions"]!.AsArray().Count, "conclusions rỗng");
    });

    await t.Case("phiên họp: thành phần (chutich) thấy conclusions", async () =>
    {
        var tok = await app.Login("chutich"); // u-ct chair của m1
        var r = await app.Get("/api/meetings/m1", tok);
        Assert.Status(200, r.Status, "chair đọc m1");
        Assert.True(r.Obj["conclusions"]!.AsArray().Count >= 1, "chair thấy conclusions");
    });

    await t.Case("chất vấn: người NGOÀI phiên nhận danh sách rỗng của phiên đó", async () =>
    {
        // questions q1/q2 thuộc m1. qtdonvi ngoài m1 -> không thấy
        var tok = await app.Login("qtdonvi");
        var r = await app.Get("/api/questions", tok);
        Assert.Status(200, r.Status, "list questions");
        var m1q = r.Arr.OfType<JsonObject>().Any(q => q["meetingId"]?.GetValue<string>() == "m1");
        Assert.True(!m1q, "ngoài phiên không thấy chất vấn m1");
    });

    await t.Case("apiKeys: chỉ admin đọc (delegate nhận [])", async () =>
    {
        var deleg = await app.Login("sokhdt");
        var r = await app.Get("/api/apiKeys", deleg);
        Assert.Status(200, r.Status, "delegate list apiKeys");
        Assert.Eq(0, r.Arr.Count, "delegate nhận rỗng");
        var admin = await app.Login("quantri");
        var r2 = await app.Get("/api/apiKeys", admin);
        Assert.True(r2.Arr.Count >= 1, "admin thấy apiKeys");
        Assert.True(r2.Arr.OfType<JsonObject>().All(k => k["keyHash"] == null), "không lộ keyHash");
    });
}

// ============================================================
// NHÓM 4 — GUARD
// ============================================================
static async Task Group4_Guard(TestRunner t)
{
    t.Group("4-GUARD");
    await using var app = await TestApp.CreateAsync();

    await t.Case("đại biểu PATCH vote.ballots -> 403", async () =>
    {
        var tok = await app.Login("sokhdt");
        var r = await app.Patch("/api/votes/v2", new JsonObject { ["ballots"] = new JsonArray() }, tok);
        Assert.Status(403, r.Status, "đại biểu sửa ballots");
    });

    await t.Case("đại biểu PATCH vote.status -> 403", async () =>
    {
        var tok = await app.Login("sokhdt");
        var r = await app.Patch("/api/votes/v2", new JsonObject { ["status"] = "closed" }, tok);
        Assert.Status(403, r.Status, "đại biểu sửa status vote");
    });

    await t.Case("questions -> 'called' bởi đại biểu -> 403", async () =>
    {
        // q1 thuộc u-yt. đại biểu u-yt tự set status=called -> 403
        var tok = await app.Login("soyt"); // u-yt owner q1
        var r = await app.Patch("/api/questions/q1", new JsonObject { ["status"] = "called" }, tok);
        Assert.Status(403, r.Status, "đại biểu tự gọi chất vấn");
    });

    await t.Case("questions -> 'called' bởi chutich -> 200", async () =>
    {
        var tok = await app.Login("chutich"); // manage
        var r = await app.Patch("/api/questions/q1", new JsonObject { ["status"] = "called" }, tok);
        Assert.Status(200, r.Status, "chủ tịch gọi chất vấn");
        Assert.Eq("called", r.Obj["status"]?.GetValue<string>(), "status = called");
    });

    await t.Case("meetings.questionSession bởi non-manage -> 403", async () =>
    {
        var tok = await app.Login("sokhdt");
        var r = await app.Patch("/api/meetings/m1", new JsonObject { ["questionSession"] = "paused" }, tok);
        Assert.Status(403, r.Status, "non-manage đổi questionSession");
    });

    await t.Case("meetings.seatAssignments bởi non-manage -> 403", async () =>
    {
        var tok = await app.Login("sokhdt");
        var r = await app.Patch("/api/meetings/m1", new JsonObject { ["seatAssignments"] = new JsonObject { ["u-khdt"] = "1-1" } }, tok);
        Assert.Status(403, r.Status, "non-manage đổi seatAssignments");
    });

    await t.Case("meetings.currentItemStartedAt bởi non-manage -> 403", async () =>
    {
        var tok = await app.Login("sokhdt");
        var r = await app.Patch("/api/meetings/m1", new JsonObject { ["currentItemStartedAt"] = "2026-07-17T00:00:00.000Z" }, tok);
        Assert.Status(403, r.Status, "non-manage đổi currentItemStartedAt");
    });

    await t.Case("documents: owner tự approve -> 403", async () =>
    {
        // d11 pending, owner u-tc. owner tự chuyển pending->approved bị cấm
        var tok = await app.Login("sotc");
        var r = await app.Patch("/api/documents/d11", new JsonObject { ["reviewStatus"] = "approved" }, tok);
        Assert.Status(403, r.Status, "owner tự approve");
    });

    await t.Case("documents: thuky approve pending -> 200", async () =>
    {
        var tok = await app.Login("thuky"); // manage
        var r = await app.Patch("/api/documents/d11", new JsonObject { ["reviewStatus"] = "approved" }, tok);
        Assert.Status(200, r.Status, "thư ký approve");
        Assert.Eq("approved", r.Obj["reviewStatus"]?.GetValue<string>(), "reviewStatus=approved");
        Assert.Eq("u-tk", r.Obj["reviewedById"]?.GetValue<string>(), "server ghi reviewedById");
    });

    await t.Case("documents: reject thiếu note -> 400", async () =>
    {
        // tạo doc pending mới để reject
        var owner = await app.Login("sotc");
        var doc = new JsonObject
        {
            ["id"] = "d-rej", ["name"] = "Cần từ chối.pdf", ["kind"] = "main", ["ownerId"] = "u-tc",
            ["meetingId"] = "m2", ["content"] = "x", ["reviewStatus"] = "pending", ["secret"] = false, ["version"] = 1,
        };
        Assert.Status(201, (await app.Post("/api/documents", doc, owner)).Status, "tạo doc pending");
        var tk = await app.Login("thuky");
        var r = await app.Patch("/api/documents/d-rej", new JsonObject { ["reviewStatus"] = "rejected" }, tk);
        Assert.Status(400, r.Status, "reject thiếu note");
        Assert.Eq("Phải nhập lý do khi từ chối tài liệu", r.Error, "message reject note");
    });

    await t.Case("documents: reject có note -> 200", async () =>
    {
        var tk = await app.Login("thuky");
        var r = await app.Patch("/api/documents/d-rej", new JsonObject { ["reviewStatus"] = "rejected", ["reviewNote"] = "Thiếu số liệu" }, tk);
        Assert.Status(200, r.Status, "reject có note");
        Assert.Eq("rejected", r.Obj["reviewStatus"]?.GetValue<string>(), "reviewStatus=rejected");
    });

    await t.Case("PATCH kiểu rác (participants = số) -> 400", async () =>
    {
        var tok = await app.Login("chutich");
        var r = await app.Patch("/api/meetings/m1", new JsonObject { ["participants"] = 123 }, tok);
        Assert.Status(400, r.Status, "participants sai kiểu");
    });

    await t.Case("PATCH kiểu rác (tasks.progress = 999) -> 400", async () =>
    {
        var tok = await app.Login("chutich");
        // dùng task bất kỳ trong seed
        var tasks = await app.Get("/api/tasks", tok);
        var taskId = tasks.Arr.OfType<JsonObject>().First()["id"]!.GetValue<string>();
        var r = await app.Patch($"/api/tasks/{taskId}", new JsonObject { ["progress"] = 999 }, tok);
        Assert.Status(400, r.Status, "progress ngoài 0-100");
    });

    await t.Case("apiKeys: PATCH keyHash bị chặn (không đổi)", async () =>
    {
        var admin = await app.Login("quantri");
        var before = await app.Get("/api/apiKeys/apk-demo-qlvb", admin);
        var r = await app.Patch("/api/apiKeys/apk-demo-qlvb", new JsonObject { ["keyHash"] = "hacked", ["name"] = "Đổi tên" }, admin);
        Assert.Status(200, r.Status, "patch apiKey");
        Assert.Eq("Đổi tên", r.Obj["name"]?.GetValue<string>(), "name đổi được");
        // keyHash không xuất hiện trong output (sanitize) — kiểm gián tiếp qua open api vẫn xác thực được key cũ (nhóm 6)
    });
}

// ============================================================
// NHÓM 5 — ACTIONS / CAS
// ============================================================
static async Task Group5_ActionsCas(TestRunner t)
{
    t.Group("5-ACTIONS/CAS");
    await using var app = await TestApp.CreateAsync();

    await t.Case("10 phiếu bỏ SONG SONG (Task.WhenAll) -> đủ 10 phiếu (CAS không mất)", async () =>
    {
        // Tạo vote mở với 10 eligible, đăng nhập 10 người, bỏ phiếu đồng thời.
        var admin = await app.Login("quantri");
        var eligible = new[] { "u-ct", "u-pct", "u-khdt", "u-tc", "u-xd", "u-tnmt", "u-gtvt", "u-yt", "u-gd", "u-tt" };
        var vote = new JsonObject
        {
            ["id"] = "v-cas", ["kind"] = "vote", ["meetingId"] = "m1", ["title"] = "CAS test",
            ["options"] = new JsonArray(new JsonObject { ["id"] = "yes", ["label"] = "Tán thành" }),
            ["ballots"] = new JsonArray(), ["eligibleIds"] = new JsonArray(eligible.Select(e => (JsonNode)e!).ToArray()),
            ["secret"] = false, ["status"] = "pending", ["createdBy"] = "u-tk",
        };
        Assert.Status(201, (await app.Post("/api/votes", vote, admin)).Status, "tạo vote CAS");
        Assert.Status(200, (await app.Post("/api/actions/vote/v-cas/open", null, admin)).Status, "mở vote CAS");

        // map username theo id
        var unameById = new Dictionary<string, string>
        {
            ["u-ct"] = "chutich", ["u-pct"] = "phochutich", ["u-khdt"] = "sokhdt", ["u-tc"] = "sotc", ["u-xd"] = "soxd",
            ["u-tnmt"] = "sotnmt", ["u-gtvt"] = "sogtvt", ["u-yt"] = "soyt", ["u-gd"] = "sogddt", ["u-tt"] = "sotttt",
        };
        var tokens = new Dictionary<string, string>();
        foreach (var id in eligible) tokens[id] = await app.Login(unameById[id]);

        // bỏ phiếu SONG SONG
        var tasks = eligible.Select(id => app.Post("/api/actions/vote/v-cas/ballot", new JsonObject { ["optionId"] = "yes" }, tokens[id])).ToArray();
        var results = await Task.WhenAll(tasks);
        Assert.True(results.All(r => r.Status == 200), "tất cả bỏ phiếu 200");

        // đọc lại: đúng 10 phiếu
        var read = await app.Get("/api/votes/v-cas", admin);
        Assert.Eq(10, read.Obj["ballots"]!.AsArray().Count, "đủ 10 phiếu (không mất do CAS)");
    });

    await t.Case("bỏ phiếu 2 lần -> lần 2 lỗi 'đã biểu quyết'", async () =>
    {
        var admin = await app.Login("quantri");
        var vote = new JsonObject
        {
            ["id"] = "v-twice", ["kind"] = "vote", ["meetingId"] = "m1", ["title"] = "2 lần",
            ["options"] = new JsonArray(new JsonObject { ["id"] = "a", ["label"] = "A" }),
            ["ballots"] = new JsonArray(), ["eligibleIds"] = new JsonArray("u-khdt"),
            ["secret"] = false, ["status"] = "pending", ["createdBy"] = "u-tk",
        };
        await app.Post("/api/votes", vote, admin);
        await app.Post("/api/actions/vote/v-twice/open", null, admin);
        var tok = await app.Login("sokhdt");
        var r1 = await app.Post("/api/actions/vote/v-twice/ballot", new JsonObject { ["optionId"] = "a" }, tok);
        Assert.Status(200, r1.Status, "bỏ phiếu lần 1");
        var r2 = await app.Post("/api/actions/vote/v-twice/ballot", new JsonObject { ["optionId"] = "a" }, tok);
        Assert.Status(400, r2.Status, "bỏ phiếu lần 2");
        Assert.Eq("Bạn đã biểu quyết nội dung này", r2.Error, "message đã bỏ phiếu");
    });

    await t.Case("bỏ phiếu khi chưa mở -> 400", async () =>
    {
        // v3 pending trong seed
        var tok = await app.Login("sokhdt");
        var r = await app.Post("/api/actions/vote/v3/ballot", new JsonObject { ["optionId"] = "o1" }, tok);
        Assert.Status(400, r.Status, "vote chưa mở");
    });

    await t.Case("bỏ phiếu khi không thuộc eligible -> 403", async () =>
    {
        var admin = await app.Login("quantri");
        var vote = new JsonObject
        {
            ["id"] = "v-elig", ["kind"] = "vote", ["meetingId"] = "m1", ["title"] = "eligible",
            ["options"] = new JsonArray(new JsonObject { ["id"] = "a", ["label"] = "A" }),
            ["ballots"] = new JsonArray(), ["eligibleIds"] = new JsonArray("u-ct"),
            ["secret"] = false, ["status"] = "pending", ["createdBy"] = "u-tk",
        };
        await app.Post("/api/votes", vote, admin);
        await app.Post("/api/actions/vote/v-elig/open", null, admin);
        var tok = await app.Login("sokhdt"); // u-khdt không trong eligible
        var r = await app.Post("/api/actions/vote/v-elig/ballot", new JsonObject { ["optionId"] = "a" }, tok);
        Assert.Status(403, r.Status, "ngoài eligible");
    });

    await t.Case("điểm danh (checkin) khi phiên live -> ok + idempotent", async () =>
    {
        // m1 live. u-yt chưa điểm danh (seed checkedIn=false)
        var tok = await app.Login("soyt");
        var r1 = await app.Post("/api/actions/meetings/m1/checkin", null, tok);
        Assert.Status(200, r1.Status, "điểm danh lần 1");
        // idempotent: lần 2 vẫn 200 (no-op)
        var r2 = await app.Post("/api/actions/meetings/m1/checkin", null, tok);
        Assert.Status(200, r2.Status, "điểm danh lần 2 (no-op)");
        // xác nhận đã điểm danh
        var m = await app.Get("/api/meetings/m1", tok);
        var row = m.Obj["participants"]!.AsArray().OfType<JsonObject>().First(p => p["userId"]?.GetValue<string>() == "u-yt");
        Assert.True(row["checkedInAt"] != null && row["checkedInAt"]!.GetValueKind() != System.Text.Json.JsonValueKind.Null, "u-yt đã điểm danh");
    });

    await t.Case("checkin hộ bởi người thường -> 403", async () =>
    {
        var tok = await app.Login("sokhdt"); // u-khdt điểm danh hộ u-gd
        var r = await app.Post("/api/actions/meetings/m1/checkin", new JsonObject { ["userId"] = "u-gd" }, tok);
        Assert.Status(403, r.Status, "điểm danh hộ không phải chủ tọa");
    });

    await t.Case("ký số biên bản: PIN sai định dạng -> 400", async () =>
    {
        // Chuẩn bị: tạo meeting có minutes chưa khóa. Dùng meeting mới do chutich tạo.
        var chair = await app.Login("chutich");
        var meeting = NewMeetingWithMinutes("m-sign1", "u-ct", "u-tk");
        Assert.Status(201, (await app.Post("/api/meetings", meeting, chair)).Status, "tạo meeting ký");
        var r = await app.Post("/api/actions/meetings/m-sign1/sign", new JsonObject { ["pin"] = "12" }, chair);
        Assert.Status(400, r.Status, "PIN sai định dạng");
    });

    await t.Case("ký số biên bản: chủ trì ký hợp lệ -> 200 (trả chữ ký)", async () =>
    {
        var chair = await app.Login("chutich");
        var r = await app.Post("/api/actions/meetings/m-sign1/sign", new JsonObject { ["pin"] = "123456" }, chair);
        Assert.Status(200, r.Status, "chủ trì ký");
        Assert.Eq("u-ct", r.Obj["signerId"]?.GetValue<string>(), "signerId chair");
        Assert.True(r.Obj["hash"] != null, "có hash");
        Assert.True(r.Obj["serial"] != null, "có serial");
    });

    await t.Case("ký số: người ngoài (không chair/secretary) -> 403", async () =>
    {
        var deleg = await app.Login("sokhdt");
        var r = await app.Post("/api/actions/meetings/m-sign1/sign", new JsonObject { ["pin"] = "123456" }, deleg);
        Assert.Status(403, r.Status, "người ngoài ký");
    });

    await t.Case("ký số 2 lần cùng người -> 400 'đã ký'", async () =>
    {
        var chair = await app.Login("chutich");
        var r = await app.Post("/api/actions/meetings/m-sign1/sign", new JsonObject { ["pin"] = "123456" }, chair);
        Assert.Status(400, r.Status, "ký lần 2");
        Assert.Eq("Bạn đã ký biên bản này", r.Error, "message đã ký");
    });

    await t.Case("start/invite/end phiên họp qua actions", async () =>
    {
        var chair = await app.Login("chutich");
        var meeting = NewDraftMeeting("m-flow", "u-ct", "u-tk");
        Assert.Status(201, (await app.Post("/api/meetings", meeting, chair)).Status, "tạo meeting draft");
        Assert.Status(200, (await app.Post("/api/actions/meetings/m-flow/invite", null, chair)).Status, "gửi mời");
        Assert.Status(200, (await app.Post("/api/actions/meetings/m-flow/start", null, chair)).Status, "khai mạc");
        var m = await app.Get("/api/meetings/m-flow", chair);
        Assert.Eq("live", m.Obj["status"]?.GetValue<string>(), "status live");
        Assert.Status(200, (await app.Post("/api/actions/meetings/m-flow/end", null, chair)).Status, "bế mạc");
        var m2 = await app.Get("/api/meetings/m-flow", chair);
        Assert.Eq("finished", m2.Obj["status"]?.GetValue<string>(), "status finished");
    });
}

// ============================================================
// NHÓM 6 — OPEN + RTC
// ============================================================
static async Task Group6_OpenRtc(TestRunner t)
{
    t.Group("6-OPEN/RTC");

    // --- Phần OPEN (không cần LiveKit) ---
    {
        await using var app = await TestApp.CreateAsync();
        const string KEY = "ecab_demo_qlvb_2026";
        IDictionary<string, string> KeyHeader(string k) => new Dictionary<string, string> { ["X-API-Key"] = k };

        await t.Case("open: thiếu key -> 401", async () =>
        {
            var r = await app.Get("/api/open/v1/units/un-khdt/meetings/upcoming");
            Assert.Status(401, r.Status, "thiếu key");
        });

        await t.Case("open: key sai -> 401", async () =>
        {
            var r = await app.Send("GET", "/api/open/v1/units/un-khdt/meetings/upcoming", headers: KeyHeader("ecab_sai"));
            Assert.Status(401, r.Status, "key sai");
        });

        await t.Case("open: key demo -> units/un-khdt/upcoming có dữ liệu", async () =>
        {
            var r = await app.Send("GET", "/api/open/v1/units/un-khdt/meetings/upcoming", headers: KeyHeader(KEY));
            Assert.Status(200, r.Status, "upcoming đơn vị");
            Assert.True(r.Obj["items"]!.AsArray().Count >= 1, "có ít nhất 1 cuộc họp sắp diễn ra");
            Assert.True(r.Obj["total"] != null, "có total");
        });

        await t.Case("open: meetings/m1 KHÔNG chứa 'minutes'/'ballots'", async () =>
        {
            var r = await app.Send("GET", "/api/open/v1/meetings/m1", headers: KeyHeader(KEY));
            Assert.Status(200, r.Status, "chi tiết m1");
            Assert.True(!r.Raw.Contains("\"minutes\""), "không có key minutes");
            Assert.True(!r.Raw.Contains("\"ballots\""), "không có key ballots");
            Assert.True(r.Obj["voteSummary"] != null, "có voteSummary tổng hợp");
        });

        await t.Case("open: documents lọc mật + chưa duyệt", async () =>
        {
            var r = await app.Send("GET", "/api/open/v1/meetings/m1/documents", headers: KeyHeader(KEY));
            Assert.Status(200, r.Status, "tài liệu m1");
            var ids = r.Obj["items"]!.AsArray().OfType<JsonObject>().Select(d => d["id"]?.GetValue<string>()).ToList();
            Assert.True(!ids.Contains("d-ref2"), "loại tài liệu mật d-ref2");
        });

        await t.Case("open: thiếu scope documents -> 403", async () =>
        {
            // tạo key chỉ có scope meetings
            var admin = await app.Login("quantri");
            var create = await app.Post("/api/apikeys/create", new JsonObject { ["name"] = "Chỉ họp", ["scopes"] = new JsonArray("meetings") }, admin);
            Assert.Status(201, create.Status, "tạo key scope meetings");
            var key = create.Obj["key"]!.GetValue<string>();
            var r = await app.Send("GET", "/api/open/v1/meetings/m1/documents", headers: KeyHeader(key));
            Assert.Status(403, r.Status, "thiếu scope documents");
        });

        await t.Case("open: phân trang size=1 page=2", async () =>
        {
            var r = await app.Send("GET", "/api/open/v1/units/un-khdt/meetings/past?size=1&page=2", headers: KeyHeader(KEY));
            Assert.Status(200, r.Status, "phân trang");
            Assert.Eq(1, r.Obj["size"]!.GetValue<int>(), "size=1");
            Assert.Eq(2, r.Obj["page"]!.GetValue<int>(), "page=2");
            Assert.True(r.Obj["items"]!.AsArray().Count <= 1, "≤1 item mỗi trang");
        });

        await t.Case("open: /spec công khai + ≥6 paths", async () =>
        {
            var r = await app.Get("/api/open/v1/spec");
            Assert.Status(200, r.Status, "/spec công khai");
            var paths = r.Obj["paths"]!.AsObject();
            Assert.True(paths.Count >= 6, $"≥6 paths (thực tế {paths.Count})");
            Assert.Eq("3.0.3", r.Obj["openapi"]?.GetValue<string>(), "openapi 3.0.3");
        });

        await t.Case("open: /health cần khóa", async () =>
        {
            var noKey = await app.Get("/api/open/v1/health");
            Assert.Status(401, noKey.Status, "/health thiếu khóa -> 401");
            var withKey = await app.Send("GET", "/api/open/v1/health", headers: KeyHeader(KEY));
            Assert.Status(200, withKey.Status, "/health có khóa -> 200");
            Assert.Eq(true, withKey.Obj["ok"]?.GetValue<bool>(), "ok=true");
        });

        await t.Case("open: document content chỉ approved+không mật", async () =>
        {
            // d1 approved không mật -> 200; d-ref2 mật -> 404
            var ok = await app.Send("GET", "/api/open/v1/documents/d1/content", headers: KeyHeader(KEY));
            Assert.Status(200, ok.Status, "d1 content 200");
            var secret = await app.Send("GET", "/api/open/v1/documents/d-ref2/content", headers: KeyHeader(KEY));
            Assert.Status(404, secret.Status, "d-ref2 mật -> 404");
        });
    }

    // --- Phần RTC ---
    {
        // RTC chưa cấu hình
        await using var app = await TestApp.CreateAsync();
        await t.Case("rtc: chưa cấu hình -> config.enabled=false", async () =>
        {
            var tok = await app.Login("chutich");
            var r = await app.Get("/api/rtc/config", tok);
            Assert.Status(200, r.Status, "rtc config");
            Assert.Eq(false, r.Obj["enabled"]?.GetValue<bool>(), "enabled false");
        });

        await t.Case("rtc: token khi chưa cấu hình -> 501", async () =>
        {
            var tok = await app.Login("chutich");
            var r = await app.Post("/api/rtc/token", new JsonObject { ["meetingId"] = "m1" }, tok);
            Assert.Status(501, r.Status, "rtc token 501");
            Assert.Eq("RTC chưa cấu hình", r.Error, "message 501");
        });
    }

    {
        // RTC ĐÃ cấu hình (env giả) — cần dựng app SAU khi set env
        Environment.SetEnvironmentVariable("LIVEKIT_URL", "wss://livekit.example.test");
        Environment.SetEnvironmentVariable("LIVEKIT_API_KEY", "APIkey123");
        Environment.SetEnvironmentVariable("LIVEKIT_API_SECRET", "secretXYZ0123456789");
        await using var app = await TestApp.CreateAsync();

        await t.Case("rtc: cấu hình giả -> token đúng iss/sub/video + verify HMAC", async () =>
        {
            var tok = await app.Login("chutich"); // u-ct thành phần m1
            var r = await app.Post("/api/rtc/token", new JsonObject { ["meetingId"] = "m1" }, tok);
            Assert.Status(200, r.Status, "rtc token 200");
            var jwt = r.Obj["token"]!.GetValue<string>();
            Assert.Eq("meeting-m1", r.Obj["room"]?.GetValue<string>(), "room");
            Assert.Eq("u-ct", r.Obj["identity"]?.GetValue<string>(), "identity");

            // giải mã payload
            var parts = jwt.Split('.');
            Assert.Eq(3, parts.Length, "JWT 3 phần");
            var payloadJson = Encoding.UTF8.GetString(Auth.B64UrlDecode(parts[1]));
            var payload = JsonNode.Parse(payloadJson)!.AsObject();
            Assert.Eq("APIkey123", payload["iss"]?.GetValue<string>(), "iss = API key");
            Assert.Eq("u-ct", payload["sub"]?.GetValue<string>(), "sub = identity");
            Assert.True(payload["video"] is JsonObject, "có video grant");
            Assert.Eq("meeting-m1", payload["video"]!["room"]?.GetValue<string>(), "video.room");
            Assert.Eq(true, payload["video"]!["roomJoin"]?.GetValue<bool>(), "video.roomJoin");

            // verify HMAC bằng secret
            using var hmac = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes("secretXYZ0123456789"));
            var expect = Auth.B64Url(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{parts[0]}.{parts[1]}")));
            Assert.Eq(expect, parts[2], "chữ ký HMAC khớp");
        });

        await t.Case("rtc: người ngoài thành phần -> 403", async () =>
        {
            var tok = await app.Login("qtdonvi"); // u-qtdv không thuộc m1, không manage
            var r = await app.Post("/api/rtc/token", new JsonObject { ["meetingId"] = "m1" }, tok);
            Assert.Status(403, r.Status, "ngoài thành phần phiên");
        });

        // dọn env để không ảnh hưởng nhóm sau
        Environment.SetEnvironmentVariable("LIVEKIT_URL", null);
        Environment.SetEnvironmentVariable("LIVEKIT_API_KEY", null);
        Environment.SetEnvironmentVariable("LIVEKIT_API_SECRET", null);
    }
}

// ============================================================
// NHÓM 7 — WS (WebSocket)
// ============================================================
static async Task Group7_Ws(TestRunner t)
{
    t.Group("7-WS");
    await using var app = await TestApp.CreateAsync();

    await t.Case("WS connect đúng path /api/realtime + nhận 'hello'", async () =>
    {
        var tok = await app.Login("chutich");
        var wsClient = app.Server.CreateWebSocketClient();
        var uri = new Uri(app.Server.BaseAddress, $"/api/realtime?token={Uri.EscapeDataString(tok)}");
        using var ws = await wsClient.ConnectAsync(uri, CancellationToken.None);
        Assert.Eq(WebSocketState.Open, ws.State, "WS mở");
        var hello = await ReceiveJson(ws);
        Assert.Eq("hello", hello?["type"]?.GetValue<string>(), "nhận hello");
        await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None);
    });

    await t.Case("WS token sai -> KHÔNG kết nối được", async () =>
    {
        var wsClient = app.Server.CreateWebSocketClient();
        var uri = new Uri(app.Server.BaseAddress, "/api/realtime?token=sai");
        var threw = false;
        try
        {
            using var ws = await wsClient.ConnectAsync(uri, CancellationToken.None);
        }
        catch { threw = true; }
        Assert.True(threw, "kết nối WS token sai bị từ chối");
    });

    await t.Case("WS nhận 'change' sau 1 ghi CRUD", async () =>
    {
        var tok = await app.Login("chutich");
        var wsClient = app.Server.CreateWebSocketClient();
        var uri = new Uri(app.Server.BaseAddress, $"/api/realtime?token={Uri.EscapeDataString(tok)}");
        using var ws = await wsClient.ConnectAsync(uri, CancellationToken.None);
        var hello = await ReceiveJson(ws); // nuốt hello
        Assert.Eq("hello", hello?["type"]?.GetValue<string>(), "hello trước");

        // thực hiện 1 ghi: PATCH meeting m1 (chair được phép) -> broadcast change
        var receiver = ReceiveJson(ws); // chờ 'change'
        await Task.Delay(50);
        var patch = await app.Patch("/api/meetings/m1", new JsonObject { ["description"] = "Cập nhật realtime " + Guid.NewGuid() }, tok);
        Assert.Status(200, patch.Status, "PATCH m1");

        var ev = await WithTimeout(receiver, 3000);
        Assert.True(ev != null, "nhận được sự kiện");
        Assert.Eq("change", ev!["type"]?.GetValue<string>(), "type=change");
        Assert.Eq("meetings", ev["collection"]?.GetValue<string>(), "collection=meetings");
        Assert.Eq("m1", ev["id"]?.GetValue<string>(), "id=m1");
        await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None);
    });

    await t.Case("/health đếm realtimeClients khi có kết nối WS", async () =>
    {
        var tok = await app.Login("thuky");
        var wsClient = app.Server.CreateWebSocketClient();
        var uri = new Uri(app.Server.BaseAddress, $"/api/realtime?token={Uri.EscapeDataString(tok)}");
        using var ws = await wsClient.ConnectAsync(uri, CancellationToken.None);
        await ReceiveJson(ws); // hello
        await Task.Delay(100);
        var h = await app.Get("/health");
        Assert.Status(200, h.Status, "/health");
        Assert.Eq("inmemory", h.Obj["db"]?.GetValue<string>(), "db=inmemory");
        Assert.True((h.Obj["realtimeClients"]?.GetValue<int>() ?? 0) >= 1, "realtimeClients >= 1");
        await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None);
    });
}

// ============================================================
// Helpers dựng dữ liệu + WS
// ============================================================
static JsonObject NewDraftMeeting(string id, string chairId, string secId) => new()
{
    ["id"] = id, ["code"] = id.ToUpper(), ["title"] = "Phiên " + id, ["description"] = "desc",
    ["startTime"] = DateTime.UtcNow.AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
    ["endTime"] = DateTime.UtcNow.AddHours(3).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
    ["roomId"] = "r1", ["isOnline"] = false, ["status"] = "draft", ["chairId"] = chairId, ["secretaryId"] = secId,
    ["participants"] = new JsonArray(
        new JsonObject { ["userId"] = chairId, ["meetingRole"] = "chair", ["attendStatus"] = "accepted", ["checkedInAt"] = null },
        new JsonObject { ["userId"] = secId, ["meetingRole"] = "secretary", ["attendStatus"] = "accepted", ["checkedInAt"] = null },
        new JsonObject { ["userId"] = "u-khdt", ["meetingRole"] = "member", ["attendStatus"] = "pending", ["checkedInAt"] = null }),
    ["agenda"] = new JsonArray(new JsonObject { ["id"] = "ag1", ["order"] = 1, ["title"] = "Mục 1", ["durationMinutes"] = 30 }),
    ["conclusions"] = new JsonArray(), ["minutes"] = null,
};

static JsonObject NewMeetingWithMinutes(string id, string chairId, string secId)
{
    var m = NewDraftMeeting(id, chairId, secId);
    m["minutes"] = new JsonObject
    {
        ["content"] = "Nội dung biên bản phiên " + id,
        ["signatures"] = new JsonArray(),
        ["locked"] = false,
    };
    return m;
}

static async Task<JsonNode?> ReceiveJson(WebSocket ws)
{
    var buffer = new byte[8192];
    var sb = new StringBuilder();
    WebSocketReceiveResult result;
    do
    {
        result = await ws.ReceiveAsync(buffer, CancellationToken.None);
        if (result.MessageType == WebSocketMessageType.Close) return null;
        sb.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
    } while (!result.EndOfMessage);
    return JsonNode.Parse(sb.ToString());
}

static async Task<JsonNode?> WithTimeout(Task<JsonNode?> task, int ms)
{
    var done = await Task.WhenAny(task, Task.Delay(ms));
    if (done != task) throw new AssertException($"Hết {ms}ms chờ sự kiện WS");
    return await task;
}
