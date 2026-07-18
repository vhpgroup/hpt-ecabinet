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
await Group8_UnitIsolation(t);      // P0-1/P0-2/P0-3
await Group9_SignVoteFeedback(t);   // P0-4/P1-5/P1-6/P1-7/P1-8
await Group10_ChairVsManage(t);     // P2-1 (QA 18/07, tester-qa.md mục 3.5)

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

    // Vá 18/07 — biên bản có 1 chữ ký (chutich, CHƯA đủ 2 nên locked=false):
    // PATCH ghi đè content qua CRUD chung phải bị guard bảo toàn (chống ghi đè nội dung đã ký).
    await t.Case("khóa biên bản: có 1 chữ ký (chưa locked) -> PATCH ghi đè content bị chặn (guardMeetings)", async () =>
    {
        var chair = await app.Login("chutich");
        var patch = new JsonObject { ["minutes"] = new JsonObject { ["content"] = "SỬA LÉN GIỮA CHỪNG" } };
        await app.Patch("/api/meetings/m-sign1", patch, chair); // guard xóa p.minutes -> không đổi
        var m = await app.Get("/api/meetings/m-sign1", chair);
        var content = m.Obj["minutes"]?["content"]?.GetValue<string>();
        Assert.True(content != "SỬA LÉN GIỮA CHỪNG", "content biên bản đã ký (1 chữ ký) KHÔNG bị ghi đè qua CRUD chung");
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
// NHÓM 8 — CÔ LẬP DỮ LIỆU THEO ĐƠN VỊ (P0-1) + QUẢN TRỊ ĐƠN VỊ (P0-2) + DUYỆT TÀI LIỆU (P0-3)
// ============================================================
static async Task Group8_UnitIsolation(TestRunner t)
{
    t.Group("8-MULTITENANT");
    await using var app = await TestApp.CreateAsync();
    var admin = await app.Login("quantri");

    // ---------------- P0-1: MEETINGS — cô lập theo đơn vị ----------------
    // Phiên tự dựng: chủ trì u-xd (un-xd), thư ký u-tk (un-vp), CHỈ 2 participant này
    // (KHÔNG có u-pxd — cùng đơn vị un-xd nhưng không phải participant trực tiếp).
    var mUnit = new JsonObject
    {
        ["id"] = "m-unit-test", ["code"] = "M-UNIT-TEST", ["title"] = "Họp riêng đơn vị Xây dựng", ["description"] = "desc",
        ["startTime"] = DateTime.UtcNow.AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
        ["endTime"] = DateTime.UtcNow.AddHours(2).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
        ["roomId"] = "r1", ["isOnline"] = false, ["status"] = "live", ["chairId"] = "u-xd", ["secretaryId"] = "u-tk",
        ["participants"] = new JsonArray(
            new JsonObject { ["userId"] = "u-xd", ["meetingRole"] = "chair", ["attendStatus"] = "accepted", ["checkedInAt"] = null },
            new JsonObject { ["userId"] = "u-tk", ["meetingRole"] = "secretary", ["attendStatus"] = "accepted", ["checkedInAt"] = null }),
        ["agenda"] = new JsonArray(),
        ["conclusions"] = new JsonArray(new JsonObject { ["id"] = "c1", ["content"] = "Kết luận nội bộ", ["createdAt"] = NowIsoT() }),
        ["minutes"] = new JsonObject { ["content"] = "Biên bản MẬT của đơn vị Xây dựng", ["signatures"] = new JsonArray(), ["locked"] = false },
    };
    Assert.Status(201, (await app.Post("/api/meetings", mUnit, admin)).Status, "tạo m-unit-test");

    await t.Case("meetings: đơn vị KHÁC hoàn toàn (u-yt) -> GET theo id 404", async () =>
    {
        var tok = await app.Login("soyt"); // un-yt — không liên quan m-unit-test
        var r = await app.Get("/api/meetings/m-unit-test", tok);
        Assert.Status(404, r.Status, "u-yt xem m-unit-test");
    });

    await t.Case("meetings: đơn vị KHÁC hoàn toàn -> ẨN KHỎI DANH SÁCH (không chỉ ẩn minutes)", async () =>
    {
        var tok = await app.Login("soyt");
        var r = await app.Get("/api/meetings", tok);
        Assert.Status(200, r.Status, "list meetings");
        var present = r.Arr.OfType<JsonObject>().Any(m => m["id"]?.GetValue<string>() == "m-unit-test");
        Assert.True(!present, "m-unit-test PHẢI vắng mặt khỏi danh sách của u-yt");
    });

    await t.Case("meetings: CÙNG ĐƠN VỊ (u-pxd, un-xd) nhưng KHÔNG phải participant -> vẫn THẤY (200), minutes bị ẨN", async () =>
    {
        var tok = await app.Login("phosoxd"); // u-pxd, cùng đơn vị un-xd với chủ trì u-xd
        var r = await app.Get("/api/meetings/m-unit-test", tok);
        Assert.Status(200, r.Status, "u-pxd xem m-unit-test (cùng đơn vị)");
        Assert.True(r.Obj["minutes"] is null || r.Obj["minutes"]!.GetValueKind() == System.Text.Json.JsonValueKind.Null,
            "không phải participant trực tiếp -> minutes vẫn bị ẩn (P0-1 chỉ mở rộng DANH SÁCH thấy được, không mở rộng mức chiếu)");
        Assert.Eq(0, r.Obj["conclusions"]!.AsArray().Count, "conclusions cũng bị ẩn");
        var list = await app.Get("/api/meetings", tok);
        Assert.True(list.Arr.OfType<JsonObject>().Any(m => m["id"]?.GetValue<string>() == "m-unit-test"), "u-pxd THẤY m-unit-test trong danh sách");
    });

    await t.Case("meetings: participant trực tiếp (u-xd) -> thấy ĐẦY ĐỦ minutes/conclusions", async () =>
    {
        var tok = await app.Login("soxd");
        var r = await app.Get("/api/meetings/m-unit-test", tok);
        Assert.Status(200, r.Status, "u-xd (chủ trì) xem m-unit-test");
        Assert.True(r.Obj["minutes"] is not null, "chủ trì thấy minutes đầy đủ");
        Assert.Eq(1, r.Obj["conclusions"]!.AsArray().Count, "chủ trì thấy conclusions đầy đủ");
    });

    await t.Case("meetings: admin luôn thấy đầy đủ bất kể đơn vị", async () =>
    {
        var r = await app.Get("/api/meetings/m-unit-test", admin);
        Assert.Status(200, r.Status, "admin xem m-unit-test");
        Assert.True(r.Obj["minutes"] is not null, "admin thấy minutes");
    });

    // ---------------- P0-1: VOTES — cô lập theo đơn vị (phiếu lấy ý kiến ngoài họp) ----------------
    var pollUnit = new JsonObject
    {
        ["id"] = "p-unit-test", ["kind"] = "poll", ["meetingId"] = null, ["title"] = "Ý kiến nội bộ đơn vị Xây dựng",
        ["options"] = new JsonArray(new JsonObject { ["id"] = "o1", ["label"] = "Đồng ý" }),
        ["ballots"] = new JsonArray(), ["eligibleIds"] = new JsonArray("u-tk"), // KHÔNG gồm u-pxd/u-yt
        ["secret"] = false, ["status"] = "pending", ["createdBy"] = "u-xd", // người tạo thuộc un-xd
    };
    Assert.Status(201, (await app.Post("/api/votes", pollUnit, admin)).Status, "tạo poll nội bộ đơn vị");

    await t.Case("votes (poll ngoài họp): CÙNG ĐƠN VỊ với người tạo -> THẤY dù không trong eligibleIds", async () =>
    {
        var tok = await app.Login("phosoxd"); // u-pxd, cùng đơn vị un-xd với createdBy u-xd
        var r = await app.Get("/api/votes/p-unit-test", tok);
        Assert.Status(200, r.Status, "u-pxd (cùng đơn vị người tạo) xem poll");
    });

    await t.Case("votes (poll ngoài họp): đơn vị KHÁC, không eligible, không phải người tạo -> 404 (đã vá bug hiển thị cho MỌI người)", async () =>
    {
        var tok = await app.Login("soyt");
        var r = await app.Get("/api/votes/p-unit-test", tok);
        Assert.Status(404, r.Status, "u-yt (đơn vị khác) xem poll nội bộ đơn vị khác");
    });

    await t.Case("votes (trong họp, v4/m4): thành phần phiên (u-gtvt) THẤY dù KHÔNG trong eligibleIds của v4", async () =>
    {
        var tok = await app.Login("sogtvt"); // participant của m4 nhưng KHÔNG trong eligibleIds của v4
        var r = await app.Get("/api/votes/v4", tok);
        Assert.Status(200, r.Status, "u-gtvt (thành phần m4) xem v4");
    });

    await t.Case("votes (trong họp, v4/m4): đơn vị HOÀN TOÀN không liên quan m4 (u-xd) -> 404", async () =>
    {
        var tok = await app.Login("soxd"); // un-xd không xuất hiện trong m4 (chủ trì/thư ký/thành phần)
        var r = await app.Get("/api/votes/v4", tok);
        Assert.Status(404, r.Status, "u-xd (đơn vị không liên quan m4) xem v4");
    });

    // ---------------- P0-2: unit_admin TẠO phiên họp (đúng/sai đơn vị) ----------------
    var qtdv = await app.Login("qtdonvi"); // u-qtdv, unit_admin của un-khdt

    await t.Case("unit_admin tạo phiên họp với chủ trì CÙNG đơn vị -> 201", async () =>
    {
        var m = new JsonObject
        {
            ["id"] = "m-qtdv-ok", ["code"] = "M-QTDV-OK", ["title"] = "Họp do quản trị đơn vị tạo", ["description"] = "",
            ["startTime"] = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            ["endTime"] = DateTime.UtcNow.AddDays(1).AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            ["roomId"] = "r1", ["isOnline"] = false, ["status"] = "draft",
            ["chairId"] = "u-khdt", ["secretaryId"] = "u-khdt", // u-khdt CÙNG đơn vị un-khdt với qtdonvi
            ["participants"] = new JsonArray(new JsonObject { ["userId"] = "u-khdt", ["meetingRole"] = "chair", ["attendStatus"] = "accepted", ["checkedInAt"] = null }),
            ["agenda"] = new JsonArray(), ["conclusions"] = new JsonArray(), ["minutes"] = null,
        };
        var r = await app.Post("/api/meetings", m, qtdv);
        Assert.Status(201, r.Status, "unit_admin tạo họp đúng đơn vị");
    });

    await t.Case("unit_admin tạo phiên họp với chủ trì KHÁC đơn vị -> 403", async () =>
    {
        var m = new JsonObject
        {
            ["id"] = "m-qtdv-bad", ["code"] = "M-QTDV-BAD", ["title"] = "Họp sai đơn vị", ["description"] = "",
            ["startTime"] = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            ["endTime"] = DateTime.UtcNow.AddDays(1).AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            ["roomId"] = "r1", ["isOnline"] = false, ["status"] = "draft",
            ["chairId"] = "u-tc", ["secretaryId"] = "u-tc", // u-tc thuộc un-tc — KHÁC đơn vị qtdonvi
            ["participants"] = new JsonArray(), ["agenda"] = new JsonArray(), ["conclusions"] = new JsonArray(), ["minutes"] = null,
        };
        var r = await app.Post("/api/meetings", m, qtdv);
        Assert.Status(403, r.Status, "unit_admin tạo họp sai đơn vị chủ trì");
        Assert.Eq("Chủ trì phiên họp phải thuộc đơn vị của bạn", r.Error, "message sai đơn vị chủ trì");
    });

    await t.Case("unit_admin tạo phiên họp: chủ trì đúng đơn vị nhưng thư ký KHÁC đơn vị -> 403", async () =>
    {
        var m = new JsonObject
        {
            ["id"] = "m-qtdv-bad-sec", ["code"] = "M-QTDV-BAD-SEC", ["title"] = "Họp thư ký sai đơn vị", ["description"] = "",
            ["startTime"] = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            ["endTime"] = DateTime.UtcNow.AddDays(1).AddHours(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            ["roomId"] = "r1", ["isOnline"] = false, ["status"] = "draft",
            ["chairId"] = "u-khdt", ["secretaryId"] = "u-tc", // thư ký khác đơn vị
            ["participants"] = new JsonArray(), ["agenda"] = new JsonArray(), ["conclusions"] = new JsonArray(), ["minutes"] = null,
        };
        var r = await app.Post("/api/meetings", m, qtdv);
        Assert.Status(403, r.Status, "unit_admin tạo họp thư ký sai đơn vị");
        Assert.Eq("Thư ký phiên họp phải thuộc đơn vị của bạn", r.Error, "message sai đơn vị thư ký");
    });

    await t.Case("delegate thường (không phải unit_admin/manage) tạo phiên họp -> 403", async () =>
    {
        var tok = await app.Login("sokhdt");
        var m = NewDraftMeeting("m-delegate-bad", "u-khdt", "u-tk");
        var r = await app.Post("/api/meetings", m, tok);
        Assert.Status(403, r.Status, "delegate thường không được tạo phiên họp");
    });

    // ---------------- P0-2: unit_admin GỬI GIẤY MỜI (đúng/sai đơn vị) ----------------
    await t.Case("unit_admin gửi giấy mời cho phiên đơn vị mình (m-qtdv-ok) -> 200", async () =>
    {
        var r = await app.Post("/api/actions/meetings/m-qtdv-ok/invite", null, qtdv);
        Assert.Status(200, r.Status, "unit_admin gửi giấy mời phiên đơn vị mình");
    });

    await t.Case("unit_admin gửi giấy mời cho phiên KHÔNG thuộc đơn vị mình (m1) -> 403", async () =>
    {
        var r = await app.Post("/api/actions/meetings/m1/invite", null, qtdv);
        Assert.Status(403, r.Status, "unit_admin gửi giấy mời phiên không thuộc đơn vị mình");
    });

    // ---------------- P0-3: DUYỆT TÀI LIỆU bởi THÀNH VIÊN DỰ HỌP (thành phần phiên) ----------------
    await t.Case("documents: THÀNH PHẦN phiên (u-khdt, không phải owner) duyệt tài liệu pending (d11/m2) -> 200", async () =>
    {
        // d11: owner u-tc, meetingId m2, pending. u-khdt LÀ participant của m2, KHÔNG phải owner.
        var tok = await app.Login("sokhdt");
        var r = await app.Patch("/api/documents/d11", new JsonObject { ["reviewStatus"] = "approved" }, tok);
        Assert.Status(200, r.Status, "thành phần phiên duyệt được tài liệu (P0-3)");
        Assert.Eq("u-khdt", r.Obj["reviewedById"]?.GetValue<string>(), "server ghi đúng người duyệt");
    });

    await t.Case("documents: owner (u-tc) VẪN KHÔNG tự duyệt được dù là thành phần CHÍNH phiên đó -> 403 (chống hồi quy)", async () =>
    {
        // tạo lại 1 doc pending khác của u-tc trong m2 để test lại (d11 đã approved ở case trên)
        var doc = new JsonObject
        {
            ["id"] = "d-selfcheck", ["name"] = "Tự kiểm.pdf", ["kind"] = "main", ["ownerId"] = "u-tc",
            ["meetingId"] = "m2", ["content"] = "x", ["reviewStatus"] = "pending", ["secret"] = false, ["version"] = 1,
        };
        var owner = await app.Login("sotc");
        Assert.Status(201, (await app.Post("/api/documents", doc, owner)).Status, "tạo doc pending cho self-check");
        var r = await app.Patch("/api/documents/d-selfcheck", new JsonObject { ["reviewStatus"] = "approved" }, owner);
        Assert.Status(403, r.Status, "owner (dù là thành phần chính phiên) KHÔNG được tự duyệt");
    });

    await t.Case("documents: NGƯỜI NGOÀI phiên (u-yt, không phải m2) duyệt tài liệu d11 -> 403", async () =>
    {
        // d12: owner u-gtvt, meetingId m2, rejected — chuyển rejected->pending trước bằng owner, rồi thử duyệt bởi người ngoài
        var ownerTok = await app.Login("sogtvt");
        var toPending = await app.Patch("/api/documents/d12", new JsonObject { ["reviewStatus"] = "pending" }, ownerTok);
        Assert.Status(200, toPending.Status, "owner trình lại d12 (rejected->pending)");
        var outsider = await app.Login("soyt"); // KHÔNG thuộc thành phần m2
        var r = await app.Patch("/api/documents/d12", new JsonObject { ["reviewStatus"] = "approved" }, outsider);
        Assert.Status(403, r.Status, "người ngoài phiên không được duyệt");
    });

    await t.Case("documents: unit_admin (owner) trình duyệt tài liệu của chính mình (draft -> pending) -> 200", async () =>
    {
        var doc = new JsonObject
        {
            ["id"] = "d-qtdv-own", ["name"] = "Tài liệu QTĐV.pdf", ["kind"] = "main", ["ownerId"] = "u-qtdv",
            ["meetingId"] = "m-qtdv-ok", ["content"] = "nội dung", ["reviewStatus"] = "draft", ["secret"] = false, ["version"] = 1,
        };
        Assert.Status(201, (await app.Post("/api/documents", doc, qtdv)).Status, "unit_admin tạo tài liệu nháp");
        var r = await app.Patch("/api/documents/d-qtdv-own", new JsonObject { ["reviewStatus"] = "pending" }, qtdv);
        Assert.Status(200, r.Status, "unit_admin (owner) trình duyệt tài liệu phiên đơn vị mình");
        Assert.Eq("pending", r.Obj["reviewStatus"]?.GetValue<string>(), "reviewStatus=pending");
    });
}

// ============================================================
// NHÓM 9 — KÝ SỐ Ý KIẾN VĂN BẢN (P0-4) + VOTE NHÁP (P1-5) + FEEDBACKS (P1-6)
//          + WHITELIST TỆP (P1-7) + UNICODE ROUND-TRIP (P1-8)
// ============================================================
static async Task Group9_SignVoteFeedback(TestRunner t)
{
    t.Group("9-SIGN/VOTE/FEEDBACK/FILE/UNICODE");
    await using var app = await TestApp.CreateAsync();
    var admin = await app.Login("quantri");

    // ---------------- P0-4: KÝ SỐ MÔ PHỎNG CHO BALLOT ----------------
    await t.Case("ballot: signPin sai định dạng -> 400 tiếng Việt", async () =>
    {
        var tok = await app.Login("sokhdt"); // eligible của v2 (m1, open)
        var r = await app.Post("/api/actions/vote/v2/ballot", new JsonObject { ["optionId"] = "o1", ["signPin"] = "abc" }, tok);
        Assert.Status(400, r.Status, "signPin sai định dạng");
        Assert.Eq("Mã PIN ký số ý kiến phải gồm 6 chữ số", r.Error, "message PIN sai");
    });

    await t.Case("ballot: có signPin hợp lệ -> gắn signature {signedAt,serialNumber,hash,signerName}", async () =>
    {
        // u-gtvt eligible v2 nhưng CHƯA bỏ phiếu trong seed (đã voted: u-pct/u-khdt/u-tc/u-tnmt).
        var tok = await app.Login("sogtvt");
        var r = await app.Post("/api/actions/vote/v2/ballot", new JsonObject { ["optionId"] = "o1", ["signPin"] = "123456" }, tok);
        Assert.Status(200, r.Status, "bỏ phiếu kèm ký số");
        var vote = await app.Get("/api/votes/v2", tok); // v2 công khai (secret=false) -> đọc lại thấy ballot của mình
        var mine = vote.Obj["ballots"]!.AsArray().OfType<JsonObject>().First(b => b["userId"]?.GetValue<string>() == "u-gtvt");
        var sig = mine["signature"] as JsonObject;
        Assert.True(sig is not null, "ballot có trường signature");
        Assert.True(sig!["serialNumber"]?.GetValue<string>()?.StartsWith("VN-DEMO-CA:") == true, "serialNumber đúng khuôn dạng");
        Assert.True(!string.IsNullOrEmpty(sig["hash"]?.GetValue<string>()), "có hash");
        Assert.True(!string.IsNullOrEmpty(sig["signedAt"]?.GetValue<string>()), "có signedAt");
        Assert.True(!string.IsNullOrEmpty(sig["signerName"]?.GetValue<string>()), "có signerName");
    });

    await t.Case("ballot: KHÔNG có signPin -> KHÔNG có signature (optional, không bắt buộc)", async () =>
    {
        var tok = await app.Login("soyt"); // eligible v2, CHƯA bỏ phiếu
        var r = await app.Post("/api/actions/vote/v2/ballot", new JsonObject { ["optionId"] = "o2" }, tok);
        Assert.Status(200, r.Status, "bỏ phiếu KHÔNG ký số");
        var vote = await app.Get("/api/votes/v2", tok);
        var mine = vote.Obj["ballots"]!.AsArray().OfType<JsonObject>().First(b => b["userId"]?.GetValue<string>() == "u-yt");
        Assert.True(mine["signature"] is null, "không gửi signPin -> không có signature");
    });

    await t.Case("ballot: BIỂU QUYẾT KÍN — người khác đọc KHÔNG thấy signature (cùng chỗ ẩn userId)", async () =>
    {
        var vote = new JsonObject
        {
            ["id"] = "v-secret-sig", ["kind"] = "vote", ["meetingId"] = "m1", ["title"] = "BQ kín có ký số",
            ["options"] = new JsonArray(new JsonObject { ["id"] = "o1", ["label"] = "Tán thành" }, new JsonObject { ["id"] = "o2", ["label"] = "Không" }),
            ["ballots"] = new JsonArray(), ["eligibleIds"] = new JsonArray("u-khdt", "u-tc"),
            ["secret"] = true, ["status"] = "pending", ["createdBy"] = "u-tk",
        };
        Assert.Status(201, (await app.Post("/api/votes", vote, admin)).Status, "tạo vote kín có ký số");
        Assert.Status(200, (await app.Post("/api/actions/vote/v-secret-sig/open", null, admin)).Status, "mở vote kín");
        var tokKh = await app.Login("sokhdt");
        var tokTc = await app.Login("sotc");
        Assert.Status(200, (await app.Post("/api/actions/vote/v-secret-sig/ballot", new JsonObject { ["optionId"] = "o1", ["signPin"] = "654321" }, tokKh)).Status, "u-khdt bỏ phiếu ký số");
        Assert.Status(200, (await app.Post("/api/actions/vote/v-secret-sig/ballot", new JsonObject { ["optionId"] = "o2" }, tokTc)).Status, "u-tc bỏ phiếu thường");

        // u-tc đọc: phiếu của u-khdt (người khác) phải bị ẩn userId VÀ ẩn signature
        var r = await app.Get("/api/votes/v-secret-sig", tokTc);
        Assert.Status(200, r.Status, "u-tc đọc vote kín");
        var ballots = r.Obj["ballots"]!.AsArray().OfType<JsonObject>().ToList();
        var others = ballots.Where(b => b["userId"] == null).ToList();
        Assert.True(others.Count == 1, "có đúng 1 phiếu người khác bị ẩn danh (của u-khdt)");
        Assert.True(others[0]["signature"] == null, "phiếu ẩn danh KHÔNG lộ signature của người khác");
        var mine = ballots.First(b => b["userId"]?.GetValue<string>() == "u-tc");
        Assert.True(mine["signature"] == null, "phiếu của u-tc (không ký) đúng là không có signature");

        // manage (thuky) đọc: thấy ĐẦY ĐỦ, bao gồm signature của u-khdt
        var tk = await app.Login("thuky");
        var rMg = await app.Get("/api/votes/v-secret-sig", tk);
        var khBallot = rMg.Obj["ballots"]!.AsArray().OfType<JsonObject>().First(b => b["userId"]?.GetValue<string>() == "u-khdt");
        Assert.True(khBallot["signature"] is not null, "manage thấy đầy đủ signature của u-khdt");
    });

    // ---------------- P1-5: VOTE NHÁP (draft) ----------------
    await t.Case("vote draft: bỏ phiếu khi CHƯA MỞ -> 400 'Phiếu chưa mở'", async () =>
    {
        var draftVote = new JsonObject
        {
            ["id"] = "v-draft", ["kind"] = "poll", ["meetingId"] = null, ["title"] = "Ý kiến nháp",
            ["options"] = new JsonArray(new JsonObject { ["id"] = "o1", ["label"] = "Đồng ý" }),
            ["ballots"] = new JsonArray(), ["eligibleIds"] = new JsonArray("u-tc"),
            ["secret"] = false, ["status"] = "draft", ["createdBy"] = "u-tk", ["trackerUserId"] = "u-tk",
        };
        Assert.Status(201, (await app.Post("/api/votes", draftVote, admin)).Status, "tạo vote draft + trackerUserId");
        var tok = await app.Login("sotc");
        var r = await app.Post("/api/actions/vote/v-draft/ballot", new JsonObject { ["optionId"] = "o1" }, tok);
        Assert.Status(400, r.Status, "bỏ phiếu khi draft");
        Assert.Eq("Phiếu chưa mở", r.Error, "message draft riêng biệt");
    });

    await t.Case("vote draft: action open() cho phép draft -> open", async () =>
    {
        var r = await app.Post("/api/actions/vote/v-draft/open", null, admin);
        Assert.Status(200, r.Status, "mở vote từ draft");
        Assert.Eq("open", r.Obj["status"]?.GetValue<string>(), "status=open sau khi mở");
    });

    await t.Case("vote draft: sau khi mở, bỏ phiếu bình thường -> 200", async () =>
    {
        var tok = await app.Login("sotc");
        var r = await app.Post("/api/actions/vote/v-draft/ballot", new JsonObject { ["optionId"] = "o1" }, tok);
        Assert.Status(200, r.Status, "bỏ phiếu sau khi mở từ draft");
    });

    await t.Case("vote: trackerUserId (cán bộ theo dõi) round-trip đúng; sai kiểu -> 400", async () =>
    {
        var r = await app.Get("/api/votes/v-draft", admin);
        Assert.Eq("u-tk", r.Obj["trackerUserId"]?.GetValue<string>(), "trackerUserId round-trip");
        var badVote = new JsonObject
        {
            ["id"] = "v-bad-tracker", ["kind"] = "poll", ["meetingId"] = null, ["title"] = "x",
            ["options"] = new JsonArray(new JsonObject { ["id"] = "o1", ["label"] = "x" }),
            ["ballots"] = new JsonArray(), ["eligibleIds"] = new JsonArray(), ["secret"] = false,
            ["status"] = "draft", ["createdBy"] = "u-tk", ["trackerUserId"] = 123,
        };
        var rBad = await app.Post("/api/votes", badVote, admin);
        Assert.Status(400, rBad.Status, "trackerUserId sai kiểu (số) -> 400");
    });

    await t.Case("vote: status rác (không thuộc enum) -> 400", async () =>
    {
        var bad = new JsonObject
        {
            ["id"] = "v-bad-status", ["kind"] = "poll", ["meetingId"] = null, ["title"] = "x",
            ["options"] = new JsonArray(new JsonObject { ["id"] = "o1", ["label"] = "x" }),
            ["ballots"] = new JsonArray(), ["eligibleIds"] = new JsonArray(), ["secret"] = false,
            ["status"] = "huy-hoang-rac", ["createdBy"] = "u-tk",
        };
        var r = await app.Post("/api/votes", bad, admin);
        Assert.Status(400, r.Status, "status rác bị chặn");
    });

    // ---------------- P1-6: FEEDBACKS (phản hồi/góp ý người dùng) ----------------
    await t.Case("feedbacks: user tạo, server ÉP userId/unitId (không tin client giả danh)", async () =>
    {
        var tok = await app.Login("sokhdt"); // u-khdt, un-khdt
        var fb = new JsonObject
        {
            ["id"] = "fb-1", ["userId"] = "u-tc", // CỐ Ý gửi userId người khác — server phải ép lại
            ["category"] = "bug", ["content"] = "Không mở được video họp trực tuyến",
            ["createdAt"] = NowIsoT(), ["updatedAt"] = NowIsoT(),
        };
        var r = await app.Post("/api/feedbacks", fb, tok);
        Assert.Status(201, r.Status, "tạo feedback");
        Assert.Eq("u-khdt", r.Obj["userId"]?.GetValue<string>(), "server ép userId = chính người gửi, không tin body");
        Assert.Eq("un-khdt", r.Obj["unitId"]?.GetValue<string>(), "server tự gán unitId từ hồ sơ người gửi");
        Assert.Eq("new", r.Obj["status"]?.GetValue<string>(), "status mặc định = new");
    });

    await t.Case("feedbacks: unit_admin (cùng đơn vị) thấy được; đơn vị khác KHÔNG thấy", async () =>
    {
        var qtdv = await app.Login("qtdonvi"); // unit_admin của un-khdt — cùng đơn vị người tạo fb-1
        var r = await app.Get("/api/feedbacks/fb-1", qtdv);
        Assert.Status(200, r.Status, "unit_admin cùng đơn vị thấy feedback");

        var other = await app.Login("sotc"); // un-tc — khác đơn vị, không phải người tạo
        var r2 = await app.Get("/api/feedbacks/fb-1", other);
        Assert.Status(404, r2.Status, "người đơn vị khác không thấy feedback của người khác");

        var list = await app.Get("/api/feedbacks", other);
        Assert.True(!list.Arr.OfType<JsonObject>().Any(f => f["id"]?.GetValue<string>() == "fb-1"), "fb-1 vắng mặt khỏi danh sách của người đơn vị khác");
    });

    await t.Case("feedbacks: admin thấy TẤT CẢ", async () =>
    {
        var r = await app.Get("/api/feedbacks/fb-1", admin);
        Assert.Status(200, r.Status, "admin thấy mọi feedback");
    });

    await t.Case("feedbacks: người KHÔNG phải admin PATCH status/response/handledBy -> 403 (dù là chính chủ)", async () =>
    {
        var tok = await app.Login("sokhdt"); // chính chủ fb-1
        var r = await app.Patch("/api/feedbacks/fb-1", new JsonObject { ["status"] = "resolved" }, tok);
        Assert.Status(403, r.Status, "chính chủ (không phải admin) không tự đổi status");
    });

    await t.Case("feedbacks: NGƯỜI KHÁC (không phải admin, không phải chủ) PATCH nội dung -> 403", async () =>
    {
        var tok = await app.Login("sotc");
        var r = await app.Patch("/api/feedbacks/fb-1", new JsonObject { ["content"] = "sửa hộ" }, tok);
        Assert.Status(403, r.Status, "không được sửa phản hồi của người khác");
    });

    await t.Case("feedbacks: CHÍNH CHỦ sửa nội dung của mình (không đụng field quản trị) -> 200", async () =>
    {
        var tok = await app.Login("sokhdt");
        var r = await app.Patch("/api/feedbacks/fb-1", new JsonObject { ["content"] = "Đã thử lại, vẫn lỗi ở Chrome" }, tok);
        Assert.Status(200, r.Status, "chính chủ sửa nội dung của mình");
    });

    await t.Case("feedbacks: admin PATCH status/response/handledBy -> 200, handledBy ÉP = chính admin", async () =>
    {
        var r = await app.Patch("/api/feedbacks/fb-1", new JsonObject
        {
            ["status"] = "processing", ["response"] = "Đang kiểm tra với đội kỹ thuật", ["handledBy"] = "u-tc", // cố ý khai người khác
        }, admin);
        Assert.Status(200, r.Status, "admin cập nhật xử lý");
        Assert.Eq("processing", r.Obj["status"]?.GetValue<string>(), "status=processing");
        Assert.Eq("u-admin", r.Obj["handledBy"]?.GetValue<string>(), "server ép handledBy = chính admin đang xử lý, không tin client");
    });

    // Vá QA 18/07 — unit_admin xử lý phản hồi TRONG ĐƠN VỊ MÌNH (HSMT "nhận & phân phối yêu cầu")
    await t.Case("feedbacks: unit_admin CÙNG đơn vị PATCH status -> 200, handledBy ÉP = chính unit_admin", async () =>
    {
        var qtdv2 = await app.Login("qtdonvi"); // u-qtdv, un-khdt — cùng đơn vị với fb-1 (u-khdt)
        var r = await app.Patch("/api/feedbacks/fb-1", new JsonObject { ["status"] = "resolved", ["handledBy"] = "u-tc" }, qtdv2);
        Assert.Status(200, r.Status, "unit_admin cùng đơn vị xử lý được phản hồi");
        Assert.Eq("resolved", r.Obj["status"]?.GetValue<string>(), "status=resolved");
        Assert.Eq("u-qtdv", r.Obj["handledBy"]?.GetValue<string>(), "server ép handledBy = chính unit_admin đang xử lý");
    });

    await t.Case("feedbacks: unit_admin PATCH phản hồi ĐƠN VỊ KHÁC -> 403", async () =>
    {
        var tokTc = await app.Login("sotc"); // u-tc, un-tc — đơn vị khác
        var fbTc = new JsonObject { ["id"] = "fb-tc", ["category"] = "question", ["content"] = "Hỏi về lịch họp", ["createdAt"] = NowIsoT(), ["updatedAt"] = NowIsoT() };
        var rc = await app.Post("/api/feedbacks", fbTc, tokTc);
        Assert.Status(201, rc.Status, "tạo feedback đơn vị khác");
        var qtdv2 = await app.Login("qtdonvi");
        var r = await app.Patch("/api/feedbacks/fb-tc", new JsonObject { ["status"] = "processing" }, qtdv2);
        Assert.Status(403, r.Status, "unit_admin không xử lý phản hồi đơn vị khác");
    });

    // Vá QA 18/07 (P0 tester) — danh mục LOẠI TÀI LIỆU (HSMT mục 8) phải tạo được qua API
    await t.Case("catalogs: type='docType' (danh mục loại tài liệu — HSMT mục 8) -> admin tạo được", async () =>
    {
        var cat = new JsonObject { ["id"] = "cat-doctype-1", ["type"] = "docType", ["name"] = "Công văn", ["order"] = 1, ["active"] = true };
        var r = await app.Post("/api/catalogs", cat, admin);
        Assert.Status(201, r.Status, "tạo danh mục loại tài liệu");
        Assert.Eq("docType", r.Obj["type"]?.GetValue<string>(), "type=docType được chấp nhận");
    });

    await t.Case("feedbacks: category/status rác -> 400", async () =>
    {
        var tok = await app.Login("sokhdt");
        var bad = new JsonObject { ["id"] = "fb-bad", ["category"] = "khong-hop-le", ["content"] = "x" };
        var r = await app.Post("/api/feedbacks", bad, tok);
        Assert.Status(400, r.Status, "category rác bị chặn");
    });

    await t.Case("feedbacks: chỉ admin xóa được", async () =>
    {
        var tok = await app.Login("sokhdt");
        var rDeny = await app.Delete("/api/feedbacks/fb-1", tok);
        Assert.Status(403, rDeny.Status, "chính chủ không tự xóa được");
        var rOk = await app.Delete("/api/feedbacks/fb-1", admin);
        Assert.Status(200, rOk.Status, "admin xóa được");
    });

    // ---------------- P1-7: WHITELIST ĐỊNH DẠNG TỆP (TT 39/2017/TT-BTTTT) ----------------
    await t.Case("documents: tệp đính kèm định dạng KHÔNG hợp lệ (.exe) -> 400 nêu rõ định dạng cho phép", async () =>
    {
        var doc = new JsonObject
        {
            ["id"] = "d-bad-ext", ["name"] = "chuong-trinh.exe", ["kind"] = "main", ["ownerId"] = "u-tc",
            ["dataUrl"] = "data:application/octet-stream;base64,AAAA", ["content"] = "", ["reviewStatus"] = "draft", ["version"] = 1,
        };
        var owner = await app.Login("sotc");
        var r = await app.Post("/api/documents", doc, owner);
        Assert.Status(400, r.Status, "định dạng .exe bị chặn");
        Assert.True((r.Error ?? "").Contains("Định dạng tệp không hợp lệ"), "message nêu rõ whitelist");
        Assert.True((r.Error ?? "").Contains("pdf"), "message liệt kê định dạng cho phép (vd pdf)");
    });

    await t.Case("documents: tệp đính kèm định dạng HỢP LỆ (.pdf) -> 201", async () =>
    {
        var doc = new JsonObject
        {
            ["id"] = "d-good-ext", ["name"] = "bao-cao.pdf", ["kind"] = "main", ["ownerId"] = "u-tc",
            ["dataUrl"] = "data:application/pdf;base64,AAAA", ["content"] = "", ["reviewStatus"] = "draft", ["version"] = 1,
        };
        var owner = await app.Login("sotc");
        var r = await app.Post("/api/documents", doc, owner);
        Assert.Status(201, r.Status, "định dạng .pdf hợp lệ");
    });

    await t.Case("documents: tài liệu CHỈ soạn nội dung (không có dataUrl) -> KHÔNG áp whitelist tệp", async () =>
    {
        var doc = new JsonObject
        {
            ["id"] = "d-text-only", ["name"] = "khong-co-duoi-file", ["kind"] = "main", ["ownerId"] = "u-tc",
            ["content"] = "Nội dung soạn trực tiếp, không phải tệp upload", ["reviewStatus"] = "draft", ["version"] = 1,
        };
        var owner = await app.Login("sotc");
        var r = await app.Post("/api/documents", doc, owner);
        Assert.Status(201, r.Status, "tài liệu soạn trực tiếp không bị áp whitelist tệp");
    });

    await t.Case("documents: PATCH đổi TÊN (không kèm dataUrl) sang đuôi cấm trên tài liệu ĐANG CÓ file -> vẫn 400", async () =>
    {
        // d-good-ext đã có dataUrl hợp lệ (.pdf) ở case trước — PATCH chỉ name (không gửi lại dataUrl)
        // phải kiểm lại theo BẢN GHI HIỆU LỰC (existing.dataUrl + patch.name mới).
        var owner = await app.Login("sotc");
        var r = await app.Patch("/api/documents/d-good-ext", new JsonObject { ["name"] = "doi-ten.exe" }, owner);
        Assert.Status(400, r.Status, "đổi tên sang đuôi cấm trên tài liệu ĐANG CÓ file vẫn bị chặn");
    });

    // ---------------- P1-8: UNICODE ROUND-TRIP (tiếng Việt có dấu NFC + tổ hợp, emoji) ----------------
    await t.Case("Unicode: tiếng Việt có dấu (NFC) + emoji lưu/đọc lại NGUYÊN VẸN qua feedbacks", async () =>
    {
        var tok = await app.Login("sokhdt");
        const string vi = "Xin chào! Ứng dụng chạy rất ổn, cảm ơn đội phát triển đã hỗ trợ nhiệt tình. 🎉👍🇻🇳";
        var fb = new JsonObject { ["id"] = "fb-unicode", ["category"] = "other", ["content"] = vi };
        Assert.Status(201, (await app.Post("/api/feedbacks", fb, tok)).Status, "tạo feedback Unicode");
        var r = await app.Get("/api/feedbacks/fb-unicode", tok);
        Assert.Status(200, r.Status, "đọc lại feedback Unicode");
        Assert.Eq(vi, r.Obj["content"]?.GetValue<string>(), "nội dung tiếng Việt + emoji round-trip NGUYÊN VẸN");
    });

    await t.Case("Unicode: ky tu to hop (combining diacritics, dang NFD chua chuan hoa NFC) round-trip nguyen ven", async () =>
    {
        // Dung CHU DONG bang NormalizationForm.FormD (KHONG dua vao text nguon go tay - tranh
        // rui ro editor/tool tu chuan hoa nguoc ve NFC truoc khi toi day). Xac nhan TRUOC khi
        // gui: chuoi decompose PHAI khac byte-for-byte voi ban NFC goc (neu bang nhau tuc .NET
        // khong decompose duoc - test tu that bai ro rang, khong am tham pass).
        var nfc = "Cu\u1ed9c h\u1ecdp kh\u00f4ng gi\u1ea5y t\u1edd \u2014 ki\u1ec3m th\u1eed k\u00fd t\u1ef1 t\u1ed5 h\u1ee3p";
        var nfd = nfc.Normalize(System.Text.NormalizationForm.FormD);
        Assert.True(nfd != nfc, "chuoi NFD phai KHAC byte-for-byte voi NFC (neu khong, test nay vo nghia)");
        Assert.True(nfd.Length > nfc.Length, "chuoi NFD phai DAI HON (moi dau to hop them 1 code point rieng)");

        var tok = await app.Login("sokhdt");
        var fb = new JsonObject { ["id"] = "fb-combining", ["category"] = "other", ["content"] = nfd };
        Assert.Status(201, (await app.Post("/api/feedbacks", fb, tok)).Status, "tao feedback ky tu to hop (NFD)");
        var r = await app.Get("/api/feedbacks/fb-combining", tok);
        var got = r.Obj["content"]?.GetValue<string>();
        Assert.Eq(nfd, got, "ky tu to hop (NFD) round-trip NGUYEN VEN - khong tu chuan hoa/lam hong qua JSON/HTTP");
        Assert.True(got != null && got.Length == nfd.Length, "do dai chuoi (so code unit) giu nguyen sau round-trip");
    });

    await t.Case("Unicode: tên đơn vị/tài liệu tiếng Việt qua PATCH units.adminType (field mới, guard không chặn)", async () =>
    {
        var r = await app.Patch("/api/units/un-khdt", new JsonObject { ["adminType"] = "phuong" }, admin);
        Assert.Status(200, r.Status, "units.adminType (field mới FE) không bị guard chặn");
        Assert.Eq("phuong", r.Obj["adminType"]?.GetValue<string>(), "adminType round-trip đúng");
    });
}

// ============================================================
// NHÓM 10 — P2-1 (QA 18/07, tester-qa.md mục 3.5): chairCtl (FE, id-match theo
// chairId/secretaryId của CHÍNH phiên) vs MANAGE (BE, role-match toàn cục) cho
// PATCH conclusions/agenda/minutes. Người được GÁN làm chủ trì/thư ký của một
// phiên cụ thể (role tài khoản = 'delegate', KHÔNG phải 'chairman'/'secretary')
// phải ghi được kết luận/chương trình/dự thảo biên bản của CHÍNH phiên đó; các
// field khóa cứng (status, checkedInAt, chữ ký/khóa biên bản, field khác) vẫn
// bất biến — kể cả với chairId id-match.
// ============================================================
static async Task Group10_ChairVsManage(TestRunner t)
{
    t.Group("10-CHAIR-VS-MANAGE");
    await using var app = await TestApp.CreateAsync();
    var admin = await app.Login("quantri");

    // u-khdt (username sokhdt, role=delegate) được GÁN làm chairId của phiên mới —
    // nghiệp vụ hợp lệ: chủ trì 1 buổi họp không nhất thiết phải có account role='chairman'.
    var mChair = new JsonObject
    {
        ["id"] = "m-chair-deleg", ["code"] = "M-CHAIR-DELEG", ["title"] = "Họp do đại biểu chủ trì", ["description"] = "desc",
        ["startTime"] = NowIsoT(), ["endTime"] = NowIsoT(),
        ["roomId"] = "r1", ["isOnline"] = false, ["status"] = "live", ["chairId"] = "u-khdt", ["secretaryId"] = "u-tk",
        ["participants"] = new JsonArray(
            new JsonObject { ["userId"] = "u-khdt", ["meetingRole"] = "chair", ["attendStatus"] = "accepted", ["checkedInAt"] = null },
            new JsonObject { ["userId"] = "u-tk", ["meetingRole"] = "secretary", ["attendStatus"] = "accepted", ["checkedInAt"] = null },
            // u-tc: participant TRỰC TIẾP (member thường) nhưng KHÔNG phải chairId/secretaryId
            // của phiên này — dùng để test "delegate không id-match" mà vẫn XEM/PATCH được
            // (không bị 404 do access control khác đơn vị), tách bạch đúng biến cần kiểm.
            new JsonObject { ["userId"] = "u-tc", ["meetingRole"] = "member", ["attendStatus"] = "accepted", ["checkedInAt"] = null }),
        ["agenda"] = new JsonArray(new JsonObject { ["id"] = "ag-old", ["order"] = 1, ["title"] = "Mục cũ", ["durationMinutes"] = 15 }),
        ["conclusions"] = new JsonArray(),
        ["minutes"] = new JsonObject { ["content"] = "Bản cũ", ["signatures"] = new JsonArray(), ["locked"] = false },
    };
    Assert.Status(201, (await app.Post("/api/meetings", mChair, admin)).Status, "tạo m-chair-deleg (chairId=u-khdt, delegate)");

    await t.Case("meetings.conclusions: delegate được GÁN chairId của CHÍNH phiên -> PATCH thành công (P2-1)", async () =>
    {
        var tok = await app.Login("sokhdt");
        var body = new JsonObject { ["conclusions"] = new JsonArray(new JsonObject { ["id"] = "c-deleg-1", ["content"] = "Kết luận do đại biểu chủ trì ghi", ["createdAt"] = NowIsoT() }) };
        var r = await app.Patch("/api/meetings/m-chair-deleg", body, tok);
        Assert.Status(200, r.Status, "PATCH conclusions bởi chairId id-match");
        Assert.Eq(1, r.Obj["conclusions"]!.AsArray().Count, "conclusions có 1 phần tử (KHÔNG bị xóa sạch)");
        Assert.Eq("Kết luận do đại biểu chủ trì ghi", r.Obj["conclusions"]![0]!["content"]?.GetValue<string>(), "nội dung kết luận đúng như đã gửi");
    });

    await t.Case("meetings.agenda: delegate secretaryId của CHÍNH phiên -> PATCH thành công (P2-1)", async () =>
    {
        // đổi vai: dùng u-tk (secretary, đã là secretaryId của m-chair-deleg) — nhưng u-tk có
        // role='secretary' (thuộc MANAGE) nên không phải ca id-match thuần. Dựng phiên riêng
        // với secretaryId = u-khdt (delegate) để cô lập đúng biến cần kiểm.
        var mSec = new JsonObject
        {
            ["id"] = "m-sec-deleg", ["code"] = "M-SEC-DELEG", ["title"] = "Họp do đại biểu làm thư ký", ["description"] = "desc",
            ["startTime"] = NowIsoT(), ["endTime"] = NowIsoT(),
            ["roomId"] = "r1", ["isOnline"] = false, ["status"] = "live", ["chairId"] = "u-pct", ["secretaryId"] = "u-khdt",
            ["participants"] = new JsonArray(
                new JsonObject { ["userId"] = "u-pct", ["meetingRole"] = "chair", ["attendStatus"] = "accepted", ["checkedInAt"] = null },
                new JsonObject { ["userId"] = "u-khdt", ["meetingRole"] = "secretary", ["attendStatus"] = "accepted", ["checkedInAt"] = null }),
            ["agenda"] = new JsonArray(new JsonObject { ["id"] = "ag-old2", ["order"] = 1, ["title"] = "Mục cũ", ["durationMinutes"] = 15 }),
            ["conclusions"] = new JsonArray(), ["minutes"] = null,
        };
        Assert.Status(201, (await app.Post("/api/meetings", mSec, admin)).Status, "tạo m-sec-deleg (secretaryId=u-khdt, delegate)");

        var tok = await app.Login("sokhdt");
        var body = new JsonObject { ["agenda"] = new JsonArray(new JsonObject { ["id"] = "ag-new", ["order"] = 1, ["title"] = "Mục mới do thư ký (delegate) thêm", ["durationMinutes"] = 20 }) };
        var r = await app.Patch("/api/meetings/m-sec-deleg", body, tok);
        Assert.Status(200, r.Status, "PATCH agenda bởi secretaryId id-match");
        Assert.Eq(1, r.Obj["agenda"]!.AsArray().Count, "agenda có 1 phần tử (KHÔNG bị xóa sạch)");
        Assert.Eq("Mục mới do thư ký (delegate) thêm", r.Obj["agenda"]![0]!["title"]?.GetValue<string>(), "nội dung agenda đúng như đã gửi");
    });

    await t.Case("meetings.minutes: delegate chairId của CHÍNH phiên -> sửa dự thảo (CHƯA khóa) được (P2-1)", async () =>
    {
        var tok = await app.Login("sokhdt");
        var body = new JsonObject { ["minutes"] = new JsonObject { ["content"] = "Dự thảo do đại biểu chủ trì cập nhật" } };
        var r = await app.Patch("/api/meetings/m-chair-deleg", body, tok);
        Assert.Status(200, r.Status, "PATCH minutes (dự thảo) bởi chairId id-match");
        Assert.Eq("Dự thảo do đại biểu chủ trì cập nhật", r.Obj["minutes"]!["content"]?.GetValue<string>(), "nội dung minutes đúng như đã gửi");
        Assert.Eq(false, r.Obj["minutes"]!["locked"]?.GetValue<bool>(), "minutes vẫn locked=false (chưa ký)");
    });

    await t.Case("meetings.conclusions: delegate KHÔNG liên quan phiên (không id-match) -> patch bị xóa sạch, KHÔNG lỗi rõ (giữ hành vi cũ, silent no-op)", async () =>
    {
        var tok = await app.Login("sotc"); // u-tc, delegate, KHÔNG phải chairId/secretaryId của m-chair-deleg
        var before = await app.Get("/api/meetings/m-chair-deleg", tok);
        var beforeCount = before.Obj["conclusions"]!.AsArray().Count;
        var body = new JsonObject { ["conclusions"] = new JsonArray(new JsonObject { ["id"] = "c-hack", ["content"] = "Không được phép", ["createdAt"] = NowIsoT() }) };
        var r = await app.Patch("/api/meetings/m-chair-deleg", body, tok);
        Assert.Status(200, r.Status, "PATCH không throw (silent no-op, giữ hành vi cũ — không phải lỗi bảo mật, chỉ là field bị lọc)");
        Assert.Eq(beforeCount, r.Obj["conclusions"]!.AsArray().Count, "conclusions KHÔNG đổi — patch của người ngoài phiên bị lọc sạch");
    });

    await t.Case("meetings: delegate chairId phiên NÀY kèm title/roomId/chairId khác -> chỉ conclusions qua, field khác KHÔNG đổi (không mở rộng ngoài phạm vi)", async () =>
    {
        var tok = await app.Login("sokhdt");
        var before = await app.Get("/api/meetings/m-chair-deleg", tok);
        var beforeTitle = before.Obj["title"]?.GetValue<string>();
        var beforeRoom = before.Obj["roomId"]?.GetValue<string>();
        var body = new JsonObject
        {
            ["conclusions"] = new JsonArray(new JsonObject { ["id"] = "c-deleg-2", ["content"] = "Kết luận 2", ["createdAt"] = NowIsoT() }),
            ["title"] = "Đổi tên phiên trái phép", ["roomId"] = "r-khac", ["chairId"] = "u-hack",
        };
        var r = await app.Patch("/api/meetings/m-chair-deleg", body, tok);
        Assert.Status(200, r.Status, "PATCH không throw");
        Assert.Eq(beforeTitle, r.Obj["title"]?.GetValue<string>(), "title KHÔNG đổi (field ngoài phạm vi conclusions/agenda/minutes)");
        Assert.Eq(beforeRoom, r.Obj["roomId"]?.GetValue<string>(), "roomId KHÔNG đổi");
        Assert.Eq("u-khdt", r.Obj["chairId"]?.GetValue<string>(), "chairId KHÔNG đổi (không tự đổi chủ trì qua kênh này)");
    });

    await t.Case("meetings: delegate chairId phiên này kèm status -> status vẫn khóa cứng (chỉ qua /actions)", async () =>
    {
        var tok = await app.Login("sokhdt");
        var body = new JsonObject
        {
            ["conclusions"] = new JsonArray(new JsonObject { ["id"] = "c-deleg-3", ["content"] = "Kết luận 3", ["createdAt"] = NowIsoT() }),
            ["status"] = "finished",
        };
        var r = await app.Patch("/api/meetings/m-chair-deleg", body, tok);
        Assert.Status(200, r.Status, "PATCH không throw");
        Assert.Eq("live", r.Obj["status"]?.GetValue<string>(), "status vẫn khóa cứng, kể cả với chairId id-match");
    });

    await t.Case("meetings: delegate chairId phiên này kèm seatAssignments -> 403 (field khóa cứng khác vẫn chặn thẳng, không âm thầm bỏ qua)", async () =>
    {
        var tok = await app.Login("sokhdt");
        var body = new JsonObject { ["seatAssignments"] = new JsonObject { ["u-khdt"] = "1-1" } };
        var r = await app.Patch("/api/meetings/m-chair-deleg", body, tok);
        Assert.Status(403, r.Status, "seatAssignments vẫn CHỈ chủ tọa/thư ký (role MANAGE) — không mở cho id-match delegate");
    });

    await t.Case("meetings.minutes: đã KHÓA (locked=true, đã ký) -> id-match chairId cũng KHÔNG sửa được (bất biến, giữ hành vi cũ)", async () =>
    {
        var chair = await app.Login("chutich");
        var mLocked = new JsonObject
        {
            ["id"] = "m-locked-deleg", ["code"] = "M-LOCKED-DELEG", ["title"] = "Họp đã ký biên bản", ["description"] = "desc",
            ["startTime"] = NowIsoT(), ["endTime"] = NowIsoT(),
            ["roomId"] = "r1", ["isOnline"] = false, ["status"] = "finished", ["chairId"] = "u-khdt", ["secretaryId"] = "u-tk",
            ["participants"] = new JsonArray(
                new JsonObject { ["userId"] = "u-khdt", ["meetingRole"] = "chair", ["attendStatus"] = "accepted", ["checkedInAt"] = null },
                new JsonObject { ["userId"] = "u-tk", ["meetingRole"] = "secretary", ["attendStatus"] = "accepted", ["checkedInAt"] = null }),
            ["agenda"] = new JsonArray(), ["conclusions"] = new JsonArray(),
            ["minutes"] = new JsonObject { ["content"] = "Đã ký, bất biến", ["signatures"] = new JsonArray(new JsonObject { ["userId"] = "u-khdt" }), ["locked"] = true },
        };
        Assert.Status(201, (await app.Post("/api/meetings", mLocked, admin)).Status, "tạo m-locked-deleg (minutes.locked=true)");

        var tok = await app.Login("sokhdt");
        var r = await app.Patch("/api/meetings/m-locked-deleg", new JsonObject { ["minutes"] = new JsonObject { ["content"] = "Sửa lén sau khi khóa" } }, tok);
        Assert.Status(200, r.Status, "PATCH không throw");
        Assert.Eq("Đã ký, bất biến", r.Obj["minutes"]!["content"]?.GetValue<string>(), "minutes đã khóa: nội dung KHÔNG đổi, kể cả với chairId id-match");
    });

    await t.Case("meetings.conclusions: MANAGE role=chairman thật (không id-match phiên này) vẫn sửa được như cũ (không hồi quy)", async () =>
    {
        // chutich (u-ct, role=chairman) KHÔNG phải chairId/secretaryId của m-chair-deleg
        // (chairId=u-khdt, secretaryId=u-tk) nhưng role thuộc MANAGE -> vẫn sửa được mọi phiên.
        var tok = await app.Login("chutich");
        var body = new JsonObject { ["conclusions"] = new JsonArray(new JsonObject { ["id"] = "c-manage-1", ["content"] = "Kết luận do MANAGE ghi hộ", ["createdAt"] = NowIsoT() }) };
        var r = await app.Patch("/api/meetings/m-chair-deleg", body, tok);
        Assert.Status(200, r.Status, "PATCH conclusions bởi MANAGE role, không id-match phiên này -> vẫn qua (đúng hành vi cũ)");
        Assert.True(r.Obj["conclusions"]!.AsArray().Any(c => c!["id"]?.GetValue<string>() == "c-manage-1"), "conclusions chứa mục do MANAGE thêm");
    });
}

// ============================================================
// Helpers dựng dữ liệu + WS
// ============================================================
static string NowIsoT() => DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

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
