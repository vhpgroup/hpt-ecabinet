using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using ECabinet.Api.Http;
using ECabinet.Api.Store;
using Microsoft.AspNetCore.Http;

namespace ECabinet.Api;

/// <summary>Kết quả 1 hàm nghiệp vụ open (port { status, body } của open.js).</summary>
public readonly record struct OpenResult(int Status, JsonObject Body);

/// <summary>Kết quả xác thực khóa API (port { ok, record?, status?, error? }).</summary>
public readonly record struct ApiKeyAuthResult(bool Ok, JsonObject? Record, int Status, string? Error);

/// <summary>
/// Ngữ cảnh tra cứu (accessors) — nạp từ store 1 lần cho mỗi request open (port loadAccessors).
/// Tách để hàm nghiệp vụ thuần, dễ test.
/// </summary>
public sealed class OpenAccessors
{
    public long Now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    public List<JsonObject> Meetings = new();
    public List<JsonObject> Users = new();
    public List<JsonObject> Units = new();
    public List<JsonObject> Rooms = new();
    public List<JsonObject> Documents = new();
    public List<JsonObject> Votes = new();
    private Dictionary<string, JsonObject> _meetingById = new();
    private Dictionary<string, JsonObject> _docById = new();

    public void Index()
    {
        _meetingById = Meetings.Where(m => J.Str(m, "id") != null).ToDictionary(m => J.Str(m, "id")!, m => m);
        _docById = Documents.Where(d => J.Str(d, "id") != null).ToDictionary(d => J.Str(d, "id")!, d => d);
    }

    public JsonObject? Meeting(string id) => _meetingById.GetValueOrDefault(id);
    public JsonObject? Document(string id) => _docById.GetValueOrDefault(id);
    public List<JsonObject> MeetingDocs(string id) => Documents.Where(d => J.Str(d, "meetingId") == id).ToList();
    public List<JsonObject> MeetingVotes(string id) => Votes.Where(v => J.Str(v, "meetingId") == id).ToList();
}

/// <summary>
/// BỘ API CÔNG BỐ CHO BÊN THỨ 3 (port open.js). Mount /api/open/v1/... TRƯỚC CRUD chung.
/// Xác thực X-API-Key (sha256 so keyHash, active) + scope; rate-limit theo prefix (OPEN_RATE_MAX);
/// usage tracking fire-and-forget; CORS * cho GET; /spec công khai; /health cần khóa.
/// Nghiệp vụ = hàm thuần Handle* (test không cần HTTP).
/// </summary>
public sealed class OpenRoutes
{
    private readonly IDocStore _store;
    private readonly IBlobStore _blob;
    public OpenRoutes(IDocStore store, IBlobStore blob) { _store = store; _blob = blob; }

    private const string BASE = "/api/open/v1";
    private static int OpenRateMax => Env.GetInt("OPEN_RATE_MAX", 120);
    private static long OpenRateWindow => Env.GetInt("OPEN_RATE_WINDOW_MS", 60000);

    private static string Sha256Hex(string t)
    {
        using var sha = SHA256.Create();
        return Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(t))).ToLowerInvariant();
    }

    // ---------------- Phản hồi JSON UTF-8 + CORS mở ----------------
    private static async Task SendOpen(HttpResponse res, int status, JsonObject body)
    {
        if (res.HasStarted) return;
        res.StatusCode = status;
        var h = res.Headers;
        h["Access-Control-Allow-Origin"] = "*";
        h["Access-Control-Allow-Methods"] = "GET,OPTIONS";
        h["Access-Control-Allow-Headers"] = "X-API-Key, Authorization, Content-Type";
        h["Access-Control-Max-Age"] = "86400";
        h["Cache-Control"] = "no-store";
        var bytes = Encoding.UTF8.GetBytes(J.Stringify(body));
        res.ContentType = "application/json; charset=utf-8";
        res.ContentLength = bytes.Length;
        await res.Body.WriteAsync(bytes);
    }

    // ---------------- Phân trang ----------------
    /// <summary>Chuẩn hóa page/size (size tối đa 100). Port parsePaging.</summary>
    public static (int page, int size) ParsePaging(IQueryCollection query)
    {
        var rawPage = ParseNum(query["page"].FirstOrDefault());
        var rawSize = ParseNum(query["size"].FirstOrDefault());
        var page = rawPage.HasValue && rawPage >= 1 ? (int)Math.Floor(rawPage.Value) : 1;
        var size = rawSize.HasValue && rawSize >= 1 ? (int)Math.Floor(rawSize.Value) : 20;
        if (size > 100) size = 100;
        return (page, size);
    }

    private static double? ParseNum(string? s)
        => double.TryParse(s, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var d) && double.IsFinite(d) ? d : null;

    private static JsonObject Paginate(List<JsonObject> all, int page, int size)
    {
        var total = all.Count;
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)size));
        var start = (page - 1) * size;
        var items = new JsonArray();
        foreach (var it in all.Skip(start).Take(size)) items.Add(J.CloneObj(it));
        return new JsonObject { ["page"] = page, ["size"] = size, ["total"] = total, ["totalPages"] = totalPages, ["items"] = items };
    }

    // ---------------- Suy diễn thời gian ----------------
    private static bool IsFinished(JsonObject m) { var s = J.Str(m, "status"); return s == "finished" || s == "cancelled"; }

    private static bool IsUpcoming(JsonObject m, long now)
    {
        if (IsFinished(m)) return false;
        if (J.Str(m, "status") == "live") return true;
        var end = ParseDate(J.Str(m, "endTime"));
        var start = ParseDate(J.Str(m, "startTime"));
        if (end.HasValue) return end.Value >= now;
        if (start.HasValue) return start.Value >= now;
        return true;
    }

    private static bool IsPast(JsonObject m, long now)
    {
        if (IsFinished(m)) return true;
        var end = ParseDate(J.Str(m, "endTime"));
        if (end.HasValue) return end.Value < now && J.Str(m, "status") != "live";
        return false;
    }

    private static long? ParseDate(string? iso)
        => DateTimeOffset.TryParse(iso, null, System.Globalization.DateTimeStyles.AdjustToUniversal, out var dt) ? dt.ToUnixTimeMilliseconds() : null;

    private static int ByStartAsc(JsonObject a, JsonObject b) => string.CompareOrdinal(J.Str(a, "startTime") ?? "", J.Str(b, "startTime") ?? "");
    private static int ByStartDesc(JsonObject a, JsonObject b) => string.CompareOrdinal(J.Str(b, "startTime") ?? "", J.Str(a, "startTime") ?? "");

    // ---------------- Lookup ----------------
    private sealed class Lookup
    {
        public Dictionary<string, JsonObject> UserById = new();
        public Dictionary<string, JsonObject> UnitById = new();
        public Dictionary<string, JsonObject> RoomById = new();
        public string? UnitOfUser(string? uid) => uid != null && UserById.TryGetValue(uid, out var u) ? J.Str(u, "unitId") : null;
        public string? UserName(string? uid) => uid != null && UserById.TryGetValue(uid, out var u) ? J.Str(u, "fullName") : null;
        public string? UnitName(string? unitId) => unitId != null && UnitById.TryGetValue(unitId, out var u) ? J.Str(u, "name") : null;
        public string? UnitShort(string? unitId) => unitId != null && UnitById.TryGetValue(unitId, out var u) ? J.Str(u, "short") : null;
        public string? RoomName(string? roomId) => roomId != null && RoomById.TryGetValue(roomId, out var r) ? J.Str(r, "name") : null;
    }

    private static Lookup BuildLookup(OpenAccessors a) => new()
    {
        UserById = a.Users.Where(u => J.Str(u, "id") != null).ToDictionary(u => J.Str(u, "id")!, u => u),
        UnitById = a.Units.Where(u => J.Str(u, "id") != null).ToDictionary(u => J.Str(u, "id")!, u => u),
        RoomById = a.Rooms.Where(r => J.Str(r, "id") != null).ToDictionary(r => J.Str(r, "id")!, r => r),
    };

    private static bool MeetingInvolvesUnit(JsonObject m, string unitId, Lookup lk)
    {
        if (lk.UnitOfUser(J.Str(m, "chairId")) == unitId) return true;
        if (lk.UnitOfUser(J.Str(m, "secretaryId")) == unitId) return true;
        var parts = J.Arr(m, "participants") ?? new JsonArray();
        return parts.OfType<JsonObject>().Any(p => lk.UnitOfUser(J.Str(p, "userId")) == unitId);
    }

    private static bool MeetingInvolvesUser(JsonObject m, string userId)
    {
        if (J.Str(m, "chairId") == userId || J.Str(m, "secretaryId") == userId) return true;
        var parts = J.Arr(m, "participants") ?? new JsonArray();
        return parts.OfType<JsonObject>().Any(p => J.Str(p, "userId") == userId);
    }

    private static JsonObject MeetingItem(JsonObject m, Lookup lk)
    {
        var parts = J.Arr(m, "participants") ?? new JsonArray();
        return new JsonObject
        {
            ["id"] = J.Str(m, "id"),
            ["title"] = J.Str(m, "title"),
            ["meetingType"] = J.Str(m, "meetingType"),
            ["status"] = J.Str(m, "status"),
            ["startTime"] = J.Str(m, "startTime"),
            ["endTime"] = J.Str(m, "endTime"),
            ["room"] = lk.RoomName(J.Str(m, "roomId")),
            ["chairName"] = lk.UserName(J.Str(m, "chairId")),
            ["hostUnit"] = lk.UnitName(lk.UnitOfUser(J.Str(m, "chairId"))),
            ["participantCount"] = parts.Count,
        };
    }

    // ============================================================
    // HÀM THUẦN — NGHIỆP VỤ
    // ============================================================
    public static OpenResult HandleUnitMeetings(string kind, string unitId, IQueryCollection query, OpenAccessors a)
    {
        var now = a.Now;
        var lk = BuildLookup(a);
        if (!lk.UnitById.ContainsKey(unitId)) return new(404, new JsonObject { ["error"] = "Không tìm thấy đơn vị" });
        var (page, size) = ParsePaging(query);
        Func<JsonObject, long, bool> pred = kind == "past" ? IsPast : IsUpcoming;
        Comparison<JsonObject> sorter = kind == "past" ? ByStartDesc : ByStartAsc;
        var all = a.Meetings.Where(m => pred(m, now) && MeetingInvolvesUnit(m, unitId, lk)).ToList();
        all.Sort(sorter);
        var items = all.Select(m => MeetingItem(m, lk)).ToList();
        return new(200, Paginate(items, page, size));
    }

    public static OpenResult HandleUserMeetings(string kind, string userId, IQueryCollection query, OpenAccessors a)
    {
        var now = a.Now;
        var lk = BuildLookup(a);
        if (!lk.UserById.ContainsKey(userId)) return new(404, new JsonObject { ["error"] = "Không tìm thấy người dùng" });
        var (page, size) = ParsePaging(query);
        Func<JsonObject, long, bool> pred = kind == "past" ? IsPast : IsUpcoming;
        Comparison<JsonObject> sorter = kind == "past" ? ByStartDesc : ByStartAsc;
        var all = a.Meetings.Where(m => pred(m, now) && MeetingInvolvesUser(m, userId)).ToList();
        all.Sort(sorter);
        var items = all.Select(m => MeetingItem(m, lk)).ToList();
        return new(200, Paginate(items, page, size));
    }

    public static OpenResult HandleMeetingDetail(string id, OpenAccessors a)
    {
        var m = a.Meeting(id);
        if (m is null) return new(404, new JsonObject { ["error"] = "Không tìm thấy cuộc họp" });
        var lk = BuildLookup(a);

        var curId = J.Str(m, "currentAgendaItemId");
        var agendaArr = J.Arr(m, "agenda") ?? new JsonArray();
        double? orderOfCur = agendaArr.OfType<JsonObject>().FirstOrDefault(x => J.Str(x, "id") == curId) is JsonObject curItem ? J.Num(curItem, "order") : null;

        var sortedAgenda = agendaArr.OfType<JsonObject>().OrderBy(x => J.Num(x, "order") ?? 0).ToList();
        var agenda = new JsonArray();
        foreach (var it in sortedAgenda)
        {
            var status = "pending";
            if (J.Str(m, "status") == "finished") status = "done";
            else if (curId != null && J.Str(it, "id") == curId) status = "current";
            else if (orderOfCur.HasValue && (J.Num(it, "order") ?? 0) < orderOfCur.Value) status = "done";
            agenda.Add(new JsonObject
            {
                ["id"] = J.Str(it, "id"),
                ["order"] = J.Num(it, "order") ?? 0,
                ["title"] = J.Str(it, "title"),
                ["durationMinutes"] = J.Num(it, "durationMinutes") ?? 0,
                ["status"] = status,
            });
        }

        var partArr = J.Arr(m, "participants") ?? new JsonArray();
        var participants = new JsonArray();
        foreach (var p in partArr.OfType<JsonObject>())
        {
            var uid = J.Str(p, "userId");
            participants.Add(new JsonObject
            {
                ["userId"] = uid,
                ["name"] = lk.UserName(uid) ?? uid,
                ["unit"] = lk.UnitShort(lk.UnitOfUser(uid)),
                ["role"] = J.Str(p, "meetingRole"),
                ["attendStatus"] = J.Str(p, "attendStatus"),
                ["checkedIn"] = J.Has(p, "checkedInAt") && p["checkedInAt"] is not null,
            });
        }

        var votes = a.MeetingVotes(J.Str(m, "id")!);
        var voteItems = new JsonArray();
        foreach (var v in votes)
        {
            voteItems.Add(new JsonObject
            {
                ["id"] = J.Str(v, "id"),
                ["title"] = J.Str(v, "title"),
                ["status"] = J.Str(v, "status"),
                ["eligibleCount"] = (J.Arr(v, "eligibleIds") ?? new JsonArray()).Count,
                ["ballotCount"] = (J.Arr(v, "ballots") ?? new JsonArray()).Count,
                ["outcome"] = SummarizeOutcome(v),
            });
        }
        var voteSummary = new JsonObject
        {
            ["total"] = votes.Count,
            ["open"] = votes.Count(v => J.Str(v, "status") == "open"),
            ["closed"] = votes.Count(v => J.Str(v, "status") == "closed"),
            ["pending"] = votes.Count(v => J.Str(v, "status") == "pending"),
            ["items"] = voteItems,
        };

        var body = new JsonObject
        {
            ["id"] = J.Str(m, "id"),
            ["code"] = J.Str(m, "code"),
            ["title"] = J.Str(m, "title"),
            ["description"] = J.Str(m, "description") ?? "",
            ["meetingType"] = J.Str(m, "meetingType"),
            ["status"] = J.Str(m, "status"),
            ["startTime"] = J.Str(m, "startTime"),
            ["endTime"] = J.Str(m, "endTime"),
            ["room"] = lk.RoomName(J.Str(m, "roomId")),
            ["isOnline"] = J.BoolOr(m, "isOnline", false),
            ["chairName"] = lk.UserName(J.Str(m, "chairId")),
            ["secretaryName"] = lk.UserName(J.Str(m, "secretaryId")),
            ["hostUnit"] = lk.UnitName(lk.UnitOfUser(J.Str(m, "chairId"))),
            ["agenda"] = agenda,
            ["participants"] = participants,
            ["voteSummary"] = voteSummary,
        };
        return new(200, body);
    }

    /// <summary>Kết quả tổng hợp 1 biểu quyết ĐÃ ĐÓNG; chưa đóng -> null. Port summarizeOutcome.</summary>
    private static JsonNode? SummarizeOutcome(JsonObject v)
    {
        if (J.Str(v, "status") != "closed") return null;
        var total = (J.Arr(v, "eligibleIds") ?? new JsonArray()).Count;
        var options = J.Arr(v, "options");
        var approveId = J.Str(v, "approveOptionId")
            ?? (options is not null && options.OfType<JsonObject>().FirstOrDefault() is JsonObject o0 ? J.Str(o0, "id") : null);
        var approve = (J.Arr(v, "ballots") ?? new JsonArray()).OfType<JsonObject>().Count(b => J.Str(b, "optionId") == approveId);
        var threshold = J.Str(v, "passThreshold") ?? "majority";
        int need;
        if (threshold == "all") need = total;
        else if (threshold == "two_thirds") need = (int)Math.Ceiling(total * 2 / 3.0);
        else need = total / 2 + 1;
        var passed = total > 0 && approve >= need;
        return JsonValue.Create($"{(passed ? "Thông qua" : "Không thông qua")} ({approve}/{total} tán thành)");
    }

    /// <summary>Lọc tài liệu công bố được: ĐÃ DUYỆT (approved|undefined) và KHÔNG MẬT. Port isPublishableDoc.</summary>
    public static bool IsPublishableDoc(JsonObject d)
    {
        if (J.BoolOr(d, "secret", false)) return false;
        if (J.Has(d, "reviewStatus") && J.Str(d, "reviewStatus") != "approved") return false;
        return true;
    }

    public static OpenResult HandleMeetingDocuments(string id, OpenAccessors a)
    {
        var m = a.Meeting(id);
        if (m is null) return new(404, new JsonObject { ["error"] = "Không tìm thấy cuộc họp" });
        var docs = a.MeetingDocs(J.Str(m, "id")!).Where(IsPublishableDoc).ToList();
        var items = new JsonArray();
        foreach (var d in docs)
        {
            var did = J.Str(d, "id")!;
            items.Add(new JsonObject
            {
                ["id"] = did,
                ["name"] = J.Str(d, "name"),
                ["kind"] = J.Str(d, "kind"),
                ["agendaItemId"] = J.Str(d, "agendaItemId"),
                ["issuingBody"] = J.Str(d, "issuingBody"),
                ["version"] = J.Num(d, "version") ?? 1,
                ["size"] = J.Num(d, "size") is double sz ? (JsonNode)sz : null,
                ["mime"] = J.Str(d, "mime"),
                ["contentUrl"] = $"{BASE}/documents/{Uri.EscapeDataString(did)}/content",
            });
        }
        return new(200, new JsonObject { ["meetingId"] = J.Str(m, "id"), ["total"] = items.Count, ["items"] = items });
    }

    public static OpenResult HandleDocumentContent(string id, OpenAccessors a)
    {
        var d = a.Document(id);
        if (d is null || !IsPublishableDoc(d)) return new(404, new JsonObject { ["error"] = "Không tìm thấy tài liệu" });
        return new(200, new JsonObject
        {
            ["id"] = J.Str(d, "id"),
            ["name"] = J.Str(d, "name"),
            ["mime"] = J.Str(d, "mime"),
            ["content"] = J.Str(d, "content"),
            ["dataUrl"] = J.Str(d, "dataUrl"),
            // Tách file (GĐ3): storageKey NỘI BỘ — router dựng lại dataUrl từ S3 rồi XÓA
            // field này trước khi trả cho bên thứ 3 (KHÔNG lộ khóa S3 ra ngoài).
            ["storageKey"] = J.Str(d, "storageKey"),
        });
    }

    // ============================================================
    // XÁC THỰC KHÓA API (hàm thuần)
    // ============================================================
    public static string? ExtractApiKey(HttpRequest req)
    {
        var x = req.Headers["X-API-Key"].FirstOrDefault();
        if (!string.IsNullOrEmpty(x)) return x.Trim();
        var auth = req.Headers.Authorization.FirstOrDefault() ?? "";
        var m = System.Text.RegularExpressions.Regex.Match(auth.Trim(), @"^ApiKey\s+(.+)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return m.Success ? m.Groups[1].Value.Trim() : null;
    }

    public static ApiKeyAuthResult AuthenticateApiKey(string? rawKey, List<JsonObject> apiKeys, string? requiredScope)
    {
        if (string.IsNullOrEmpty(rawKey)) return new(false, null, 401, "Thiếu khóa API (header X-API-Key)");
        var hash = Sha256Hex(rawKey);
        var record = apiKeys.FirstOrDefault(k => J.BoolOr(k, "active", false) && J.Str(k, "keyHash") == hash);
        if (record is null) return new(false, null, 401, "Khóa API không hợp lệ hoặc đã bị thu hồi");
        if (requiredScope != null)
        {
            var scopes = J.Arr(record, "scopes") ?? new JsonArray();
            if (!scopes.Any(s => J.Str(s) == requiredScope))
                return new(false, null, 403, $"Khóa API không có quyền \"{requiredScope}\"");
        }
        return new(true, record, 0, null);
    }

    // ============================================================
    // NẠP ACCESSORS TỪ STORE
    // ============================================================
    private async Task<OpenAccessors> LoadAccessors()
    {
        var a = new OpenAccessors
        {
            Meetings = await _store.GetAllAsync("c_meetings"),
            Users = await _store.GetAllAsync("c_users"),
            Units = await _store.GetAllAsync("c_units"),
            Rooms = await _store.GetAllAsync("c_rooms"),
            Documents = await _store.GetAllAsync("c_documents"),
            Votes = await _store.GetAllAsync("c_votes"),
        };
        a.Index();
        return a;
    }

    private Task<List<JsonObject>> LoadApiKeys() => _store.GetAllAsync("c_apikeys");

    /// <summary>Ghi nhận sử dụng khóa (fire-and-forget): lastUsedAt + callCount++. Port recordUsage.</summary>
    private void RecordUsage(JsonObject record)
    {
        var next = J.CloneObj(record);
        next["lastUsedAt"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
        next["callCount"] = (J.Num(record, "callCount") ?? 0) + 1;
        var id = J.Str(record, "id");
        if (id is null) return;
        _ = _store.UpdateAsync("c_apikeys", id, next); // không chặn response
    }

    // ============================================================
    // WIRE ROUTER
    // ============================================================
    private sealed record OpenRoute(string Path, string? Scope, Func<Ctx, OpenAccessors, OpenResult> Fn);

    public void Register(Router app)
    {
        // LƯU Ý thứ tự: '/meetings/:id/documents' TRƯỚC '/meetings/:id'.
        var routes = new[]
        {
            new OpenRoute($"{BASE}/units/:unitId/meetings/upcoming", "meetings", (c, a) => HandleUnitMeetings("upcoming", c.Params["unitId"], c.Query, a)),
            new OpenRoute($"{BASE}/units/:unitId/meetings/past", "meetings", (c, a) => HandleUnitMeetings("past", c.Params["unitId"], c.Query, a)),
            new OpenRoute($"{BASE}/users/:userId/meetings/upcoming", "meetings", (c, a) => HandleUserMeetings("upcoming", c.Params["userId"], c.Query, a)),
            new OpenRoute($"{BASE}/users/:userId/meetings/past", "meetings", (c, a) => HandleUserMeetings("past", c.Params["userId"], c.Query, a)),
            new OpenRoute($"{BASE}/meetings/:id/documents", "documents", (c, a) => HandleMeetingDocuments(c.Params["id"], a)),
            new OpenRoute($"{BASE}/meetings/:id", "meetings", (c, a) => HandleMeetingDetail(c.Params["id"], a)),
            new OpenRoute($"{BASE}/documents/:id/content", "documents", (c, a) => HandleDocumentContent(c.Params["id"], a)),
        };

        foreach (var route in routes)
        {
            var r = route; // capture
            app.Add("GET", r.Path, async c =>
            {
                var rawKey = ExtractApiKey(c.Req);
                var apiKeys = await LoadApiKeys();
                var auth = AuthenticateApiKey(rawKey, apiKeys, r.Scope);
                if (!auth.Ok) { await SendOpen(c.Res, auth.Status, new JsonObject { ["error"] = auth.Error }); return; }

                var prefix = J.Str(auth.Record!, "prefix") ?? J.Str(auth.Record!, "id");
                var rl = RateLimit.Hit($"open:{prefix}", OpenRateMax, OpenRateWindow);
                if (!rl.Ok)
                {
                    c.Res.Headers["Retry-After"] = rl.RetryAfterSec.ToString();
                    await SendOpen(c.Res, 429, new JsonObject { ["error"] = "Vượt giới hạn số lượt gọi — vui lòng thử lại sau" });
                    return;
                }
                RecordUsage(auth.Record!);

                var accessors = await LoadAccessors();
                var outp = r.Fn(c, accessors);
                // Tách file (GĐ3 + TỐI ƯU 1): endpoint nội dung tài liệu. storageKey NỘI BỘ — LUÔN
                // xóa khỏi phản hồi (không lộ khóa S3). Lọc quyền (IsPublishableDoc: đã duyệt + KHÔNG
                // mật) đã chạy trong hàm thuần TRƯỚC -> tài liệu mật vẫn 404, chưa cấp gì.
                if (outp.Status == 200 && outp.Body is JsonObject ob && ob.ContainsKey("storageKey"))
                {
                    var key = J.Str(ob, "storageKey");
                    ob.Remove("storageKey");
                    if (!string.IsNullOrEmpty(key) && J.Str(ob, "dataUrl") is null && _blob.Configured())
                    {
                        // redirect (mặc định): 302 tới presigned URL, LGSP tải THẲNG từ S3 (backend 0
                        // byte RAM). stream: dựng lại dataUrl JSON như cũ (giữ spec dataUrl / môi
                        // trường không cho client tới S3 trực tiếp).
                        if (Blob.DownloadMode() == "redirect")
                        {
                            try
                            {
                                var url = _blob.PresignGetUrl(key!, Blob.PresignTtlSec(), J.Str(ob, "name"), J.Str(ob, "mime") ?? Blob.MimeFromKey(key!));
                                // Ghi body RỖNG để đánh dấu response đã bắt đầu (tránh Router ghi đè 500).
                                c.Res.StatusCode = 302;
                                c.Res.Headers["Location"] = url; // KHÔNG log URL (chứa chữ ký)
                                c.Res.Headers["Cache-Control"] = "no-store";
                                c.Res.Headers["Access-Control-Allow-Origin"] = "*";
                                c.Res.ContentLength = 0;
                                await c.Res.Body.WriteAsync(Array.Empty<byte>());
                                return;
                            }
                            catch { await SendOpen(c.Res, 502, new JsonObject { ["error"] = "Không tạo được liên kết tải tệp từ kho lưu trữ" }); return; }
                        }
                        try
                        {
                            var bytes = await _blob.GetAsync(key!);
                            ob["dataUrl"] = Blob.EncodeDataUri(bytes, J.Str(ob, "mime"));
                        }
                        catch { await SendOpen(c.Res, 502, new JsonObject { ["error"] = "Không đọc được nội dung tệp từ kho lưu trữ" }); return; }
                    }
                }
                await SendOpen(c.Res, outp.Status, outp.Body);
            });
        }

        // /spec: OpenAPI 3.0 JSON, CÔNG KHAI
        app.Add("GET", $"{BASE}/spec", async c =>
        {
            var proto = (c.Req.Headers["x-forwarded-proto"].FirstOrDefault() ?? "http").Split(',')[0];
            var host = c.Req.Headers["x-forwarded-host"].FirstOrDefault() ?? c.Req.Headers.Host.FirstOrDefault() ?? "";
            var serverUrl = !string.IsNullOrEmpty(host) ? $"{proto}://{host}" : "/";
            await SendOpen(c.Res, 200, OpenApiCatalog.BuildOpenApiSpec(serverUrl));
        });

        // /health: cần khóa
        app.Add("GET", $"{BASE}/health", async c =>
        {
            var rawKey = ExtractApiKey(c.Req);
            var apiKeys = await LoadApiKeys();
            var auth = AuthenticateApiKey(rawKey, apiKeys, null);
            if (!auth.Ok) { await SendOpen(c.Res, auth.Status, new JsonObject { ["error"] = auth.Error }); return; }
            RecordUsage(auth.Record!);
            await SendOpen(c.Res, 200, new JsonObject { ["ok"] = true, ["service"] = OpenApiCatalog.ServiceName, ["version"] = OpenApiCatalog.OpenApiVersion });
        });
    }
}
