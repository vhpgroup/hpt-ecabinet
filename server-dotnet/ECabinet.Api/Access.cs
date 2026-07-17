using System.Text.Json.Nodes;
using ECabinet.Api.Store;

namespace ECabinet.Api;

/// <summary>
/// ACCESS — LỌC QUYỀN ĐỌC THEO BẢN GHI (port access.js).
/// GET /api/:collection và /api/:collection/:id KHÔNG trả nguyên dữ liệu cho mọi người đăng nhập;
/// mirror quy tắc hiển thị của frontend nhưng thực thi PHÍA SERVER.
/// </summary>
public sealed class Access
{
    private readonly IDocStore _store;
    public Access(IDocStore store) => _store = store;

    private static bool IsManage(JwtPayload u) => Acl.Manage.Contains(u.Role);

    /// <summary>Bộ dữ liệu cần lọc quyền đọc (còn lại: reference/không nhạy cảm).</summary>
    private static readonly HashSet<string> Sensitive = new()
    {
        "documents", "votes", "messages", "notifications", "annotations",
        "meetings", "tasks", "speakRequests", "questions", "guides", "apiKeys",
    };

    public static bool NeedsAccessFilter(string collection) => Sensitive.Contains(collection);

    /// <summary>Ngữ cảnh phân quyền 1 request (thành phần cuộc họp của user + tra cứu tài liệu).</summary>
    public sealed class AccessCtx
    {
        public HashSet<string> MyMeetingIds = new();
        public Dictionary<string, JsonObject> DocById = new();
    }

    /// <summary>Nạp ngữ cảnh 1 lần cho mỗi request (port buildAccessCtx).</summary>
    public async Task<AccessCtx> BuildCtx(JwtPayload user)
    {
        var meetings = await _store.GetAllAsync("c_meetings");
        var documents = await _store.GetAllAsync("c_documents");
        var myMeetingIds = new HashSet<string>();
        foreach (var m in meetings)
        {
            var parts = J.Arr(m, "participants");
            var isMember = parts is not null && parts.OfType<JsonObject>().Any(p => J.Str(p, "userId") == user.Sub);
            if (isMember) { var id = J.Str(m, "id"); if (id != null) myMeetingIds.Add(id); }
        }
        var docById = new Dictionary<string, JsonObject>();
        foreach (var d in documents) { var id = J.Str(d, "id"); if (id != null) docById[id] = d; }
        return new AccessCtx { MyMeetingIds = myMeetingIds, DocById = docById };
    }

    // ---------------- Quy tắc từng bộ dữ liệu ----------------

    public static bool CanReadDoc(JsonObject doc, JwtPayload user, AccessCtx ctx)
    {
        if (IsManage(user)) return true;
        if (J.Str(doc, "ownerId") == user.Sub) return true;
        var shared = J.Arr(doc, "sharedWith");
        if (shared is not null && shared.Any(x => J.Str(x) == user.Sub)) return true;
        if (J.Str(doc, "kind") == "personal") return false;
        var meetingId = J.Str(doc, "meetingId");
        var inMeeting = meetingId is null || ctx.MyMeetingIds.Contains(meetingId);
        if (!inMeeting) return false;
        if (J.BoolOr(doc, "secret", false)) return false;
        // đại biểu thường CHỈ đọc tài liệu ĐÃ DUYỆT (undefined coi như đã duyệt)
        if (J.Has(doc, "reviewStatus"))
        {
            var rs = J.Str(doc, "reviewStatus");
            if (rs != "approved") return false;
        }
        return true;
    }

    /// <summary>Biểu quyết kín: giữ phiếu của CHÍNH MÌNH, ẩn danh phiếu người khác. null nếu không được đọc.</summary>
    public static JsonObject? ProjectVote(JsonObject vote, JwtPayload user, AccessCtx ctx)
    {
        var elig = J.Arr(vote, "eligibleIds");
        var eligible = elig is not null && elig.Any(x => J.Str(x) == user.Sub);
        var meetingId = J.Str(vote, "meetingId");
        var inMeeting = meetingId != null ? ctx.MyMeetingIds.Contains(meetingId) : true;
        if (!(IsManage(user) || J.Str(vote, "createdBy") == user.Sub || eligible || inMeeting)) return null;

        if (J.BoolOr(vote, "secret", false) && !(IsManage(user) || J.Str(vote, "createdBy") == user.Sub))
        {
            var outp = J.CloneObj(vote);
            var ballots = J.Arr(vote, "ballots") ?? new JsonArray();
            var newBallots = new JsonArray();
            foreach (var bn in ballots)
            {
                if (bn is not JsonObject b) continue;
                if (J.Str(b, "userId") == user.Sub)
                {
                    newBallots.Add(J.CloneObj(b)); // phiếu của mình: giữ nguyên
                }
                else
                {
                    // ẩn danh: chỉ optionId + castAt
                    var anon = new JsonObject { ["optionId"] = J.Str(b, "optionId") };
                    if (J.Has(b, "castAt")) anon["castAt"] = J.DeepClone(b["castAt"]);
                    newBallots.Add(anon);
                }
            }
            outp["ballots"] = newBallots;
            return outp;
        }
        return vote;
    }

    public static bool CanReadMessage(JsonObject msg, JwtPayload user, AccessCtx ctx)
    {
        if (J.Str(msg, "fromId") == user.Sub || J.Str(msg, "toId") == user.Sub) return true;
        // toId == null (JS): tin chung phòng. Ở đây "null" = khóa tồn tại giá trị null HOẶC không có toId khác sub.
        var toIsNull = !J.Has(msg, "toId") || msg["toId"] is null;
        if (toIsNull)
        {
            var meetingId = J.Str(msg, "meetingId");
            return IsManage(user) || (meetingId != null && ctx.MyMeetingIds.Contains(meetingId));
        }
        return false;
    }

    public static bool CanReadNotification(JsonObject n, JwtPayload user)
        => J.Str(n, "userId") == user.Sub;

    public static bool CanReadAnnotation(JsonObject a, JwtPayload user, AccessCtx ctx)
    {
        if (J.Str(a, "userId") == user.Sub) return true;
        if (!J.BoolOr(a, "isPublic", false)) return false;
        if (IsManage(user)) return true;
        var docId = J.Str(a, "docId");
        if (docId is null || !ctx.DocById.TryGetValue(docId, out var doc)) return false;
        if (J.Str(doc, "ownerId") == user.Sub) return true;
        var shared = J.Arr(doc, "sharedWith");
        if (shared is not null && shared.Any(x => J.Str(x) == user.Sub)) return true;
        var meetingId = J.Str(doc, "meetingId");
        return meetingId != null ? ctx.MyMeetingIds.Contains(meetingId) : true;
    }

    private static bool IsMeetingMember(JsonObject m, JwtPayload user)
    {
        if (IsManage(user)) return true;
        var parts = J.Arr(m, "participants");
        return parts is not null && parts.OfType<JsonObject>().Any(p => J.Str(p, "userId") == user.Sub);
    }

    /// <summary>Phiên họp: người NGOÀI phiên thấy lịch nhưng minutes=null + conclusions=[]. Port projectMeeting.</summary>
    public static JsonObject ProjectMeeting(JsonObject m, JwtPayload user)
    {
        if (IsMeetingMember(m, user)) return m;
        var outp = J.CloneObj(m);
        outp["minutes"] = null;
        outp["conclusions"] = new JsonArray();
        return outp;
    }

    public static bool CanReadTask(JsonObject t, JwtPayload user, AccessCtx ctx)
    {
        if (IsManage(user)) return true;
        if (J.Str(t, "assigneeId") == user.Sub) return true;
        var meetingId = J.Str(t, "meetingId");
        return meetingId != null && ctx.MyMeetingIds.Contains(meetingId);
    }

    public static bool CanReadSpeak(JsonObject s, JwtPayload user, AccessCtx ctx)
    {
        if (IsManage(user) || J.Str(s, "userId") == user.Sub) return true;
        var meetingId = J.Str(s, "meetingId");
        return meetingId != null && ctx.MyMeetingIds.Contains(meetingId);
    }

    public static bool CanReadQuestion(JsonObject q, JwtPayload user, AccessCtx ctx)
    {
        if (IsManage(user) || J.Str(q, "userId") == user.Sub) return true;
        var meetingId = J.Str(q, "meetingId");
        return meetingId != null && ctx.MyMeetingIds.Contains(meetingId);
    }

    public static bool CanReadGuide(JsonObject g, JwtPayload user)
    {
        if (user.Role == "admin") return true;
        var scope = J.Arr(g, "roleScope");
        if (scope is null || scope.Count == 0) return true;
        return scope.Any(x => J.Str(x) == user.Role);
    }

    public static bool CanReadApiKey(JwtPayload user) => user.Role == "admin";

    // ---------------- Bộ lọc chung ----------------

    /// <summary>Lọc danh sách theo quyền đọc. Trả mảng đã lọc/chiếu (JsonObject).</summary>
    public async Task<List<JsonObject>> FilterList(string collection, List<JsonObject> rows, JwtPayload user)
    {
        if (!NeedsAccessFilter(collection)) return rows;
        var ctx = await BuildCtx(user);
        return ApplyFilter(collection, rows, user, ctx);
    }

    /// <summary>Kiểm 1 bản ghi có đọc được không; trả bản (đã chiếu) hoặc null.</summary>
    public async Task<JsonObject?> ReadOne(string collection, JsonObject row, JwtPayload user)
    {
        if (!NeedsAccessFilter(collection)) return row;
        var ctx = await BuildCtx(user);
        var outp = ApplyFilter(collection, new List<JsonObject> { row }, user, ctx);
        return outp.Count > 0 ? outp[0] : null;
    }

    private static List<JsonObject> ApplyFilter(string collection, List<JsonObject> rows, JwtPayload user, AccessCtx ctx)
    {
        switch (collection)
        {
            case "documents": return rows.Where(d => CanReadDoc(d, user, ctx)).ToList();
            case "votes": return rows.Select(v => ProjectVote(v, user, ctx)).Where(v => v is not null).Select(v => v!).ToList();
            case "messages": return rows.Where(m => CanReadMessage(m, user, ctx)).ToList();
            case "notifications": return rows.Where(n => CanReadNotification(n, user)).ToList();
            case "annotations": return rows.Where(a => CanReadAnnotation(a, user, ctx)).ToList();
            case "meetings": return rows.Select(m => ProjectMeeting(m, user)).ToList();
            case "tasks": return rows.Where(t => CanReadTask(t, user, ctx)).ToList();
            case "speakRequests": return rows.Where(s => CanReadSpeak(s, user, ctx)).ToList();
            case "questions": return rows.Where(q => CanReadQuestion(q, user, ctx)).ToList();
            case "guides": return rows.Where(g => CanReadGuide(g, user)).ToList();
            case "apiKeys": return CanReadApiKey(user) ? rows : new List<JsonObject>();
            default: return rows;
        }
    }
}
