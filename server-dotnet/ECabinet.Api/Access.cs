using System.Text.Json.Nodes;
using ECabinet.Api.Store;

namespace ECabinet.Api;

/// <summary>
/// ACCESS — LỌC QUYỀN ĐỌC THEO BẢN GHI (port access.js).
/// GET /api/:collection và /api/:collection/:id KHÔNG trả nguyên dữ liệu cho mọi người đăng nhập;
/// mirror quy tắc hiển thị của frontend nhưng thực thi PHÍA SERVER.
///
/// P0-1 (rủi ro R1 — CAO NHẤT): trước đây user thường thấy TIÊU ĐỀ/lịch/chương trình của
/// MỌI phiên họp ở MỌI đơn vị (chỉ lọc theo "có phải thành phần phiên"). Vá: mở rộng ngữ
/// cảnh (AccessCtx) với tra cứu đơn vị người dùng + MyUnitMeetingIds (đúng logic
/// MeetingInvolvesUnit dùng ở Open API — viết lại tại đây vì OpenRoutes.MeetingInvolvesUnit
/// là private/gắn với Lookup riêng của OpenRoutes; xem OpenRoutes.cs để đối chiếu 1:1), rồi
/// ẨN HẲN khỏi danh sách + GET theo id trả 404 nếu không thỏa — không chỉ ẩn minutes.
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
        "feedbacks", // P1-6: phản hồi người dùng — của mình + admin/unit_admin phạm vi phù hợp
    };

    public static bool NeedsAccessFilter(string collection) => Sensitive.Contains(collection);

    /// <summary>Ngữ cảnh phân quyền 1 request (thành phần cuộc họp của user + tra cứu tài liệu).</summary>
    public sealed class AccessCtx
    {
        /// <summary>Phiên mình LÀ thành phần/khách mời/chủ trì/thư ký (participant trực tiếp).</summary>
        public HashSet<string> MyMeetingIds = new();
        /// <summary>P0-1: phiên "thuộc đơn vị mình" — chủ trì/thư ký/thành phần khác cùng đơn vị.</summary>
        public HashSet<string> MyUnitMeetingIds = new();
        /// <summary>Đơn vị của CHÍNH user đang gọi (đọc từ DB — JWT không mang unitId).</summary>
        public string? MyUnitId;
        /// <summary>Tra đơn vị của 1 user khác theo id (dùng cho votes/feedbacks).</summary>
        public Func<string?, string?> UnitOfUser = _ => null;
        public Dictionary<string, JsonObject> DocById = new();
    }

    /// <summary>
    /// Đơn vị có liên quan cuộc họp: chủ trì/thư ký thuộc đơn vị HOẶC có thành phần thuộc
    /// đơn vị. Port meetingInvolvesUnit (open.js) — cùng logic với OpenRoutes.MeetingInvolvesUnit
    /// nhưng viết riêng ở đây (Func đơn giản thay vì Lookup riêng của OpenRoutes) để Access
    /// không phụ thuộc ngược vào OpenRoutes.
    /// </summary>
    private static bool MeetingInvolvesUnit(JsonObject m, string? unitId, Func<string?, string?> unitOfUser)
    {
        if (string.IsNullOrEmpty(unitId)) return false;
        if (unitOfUser(J.Str(m, "chairId")) == unitId) return true;
        if (unitOfUser(J.Str(m, "secretaryId")) == unitId) return true;
        var parts = J.Arr(m, "participants") ?? new JsonArray();
        return parts.OfType<JsonObject>().Any(p => unitOfUser(J.Str(p, "userId")) == unitId);
    }

    /// <summary>Nạp ngữ cảnh 1 lần cho mỗi request (port buildAccessCtx).</summary>
    public async Task<AccessCtx> BuildCtx(JwtPayload user)
    {
        var meetings = await _store.GetAllAsync("c_meetings");
        var documents = await _store.GetAllAsync("c_documents");
        var users = await _store.GetAllAsync("c_users");

        var userById = new Dictionary<string, JsonObject>();
        foreach (var u in users) { var id = J.Str(u, "id"); if (id != null) userById[id] = u; }
        string? UnitOfUser(string? uid) => uid != null && userById.TryGetValue(uid, out var u) ? J.Str(u, "unitId") : null;
        var myUnitId = UnitOfUser(user.Sub);

        var myMeetingIds = new HashSet<string>();
        var myUnitMeetingIds = new HashSet<string>();
        foreach (var m in meetings)
        {
            var parts = J.Arr(m, "participants");
            var isMember = parts is not null && parts.OfType<JsonObject>().Any(p => J.Str(p, "userId") == user.Sub);
            var id = J.Str(m, "id");
            if (id is null) continue;
            if (isMember) myMeetingIds.Add(id);
            if (MeetingInvolvesUnit(m, myUnitId, UnitOfUser)) myUnitMeetingIds.Add(id);
        }
        var docById = new Dictionary<string, JsonObject>();
        foreach (var d in documents) { var id = J.Str(d, "id"); if (id != null) docById[id] = d; }
        return new AccessCtx
        {
            MyMeetingIds = myMeetingIds,
            MyUnitMeetingIds = myUnitMeetingIds,
            MyUnitId = myUnitId,
            UnitOfUser = UnitOfUser,
            DocById = docById,
        };
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

    /// <summary>
    /// Biểu quyết/phiếu lấy ý kiến — quyền ĐỌC (P0-1, rà thêm votes):
    ///  - quản lý / người tạo / trong danh sách xin ý kiến: luôn thấy.
    ///  - biểu quyết TRONG PHIÊN HỌP (meetingId != null): thấy nếu phiên đó thuộc đơn vị
    ///    mình (MyUnitMeetingIds).
    ///  - phiếu lấy ý kiến NGOÀI HỌP (meetingId == null, "poll"): TRƯỚC ĐÂY luôn hiển thị
    ///    cho MỌI người đăng nhập bất kể đơn vị (bug tương đương R1) — NAY chỉ hiển thị
    ///    thêm nếu CÙNG ĐƠN VỊ với người tạo (createdBy).
    /// null = không đọc được (ẩn khỏi danh sách, 404 khi GET theo id).
    /// Biểu quyết kín: ẩn danh chỉ dựng lại optionId/castAt nên chữ ký mô phỏng (P0-4) của
    /// người khác KHÔNG rò theo, cùng chỗ ẩn userId.
    /// </summary>
    public static JsonObject? ProjectVote(JsonObject vote, JwtPayload user, AccessCtx ctx)
    {
        var elig = J.Arr(vote, "eligibleIds");
        var eligible = elig is not null && elig.Any(x => J.Str(x) == user.Sub);
        var meetingId = J.Str(vote, "meetingId");
        var inUnitViaMeeting = meetingId != null && ctx.MyUnitMeetingIds.Contains(meetingId);
        var sameUnitAsCreator = meetingId is null && ctx.MyUnitId != null && ctx.UnitOfUser(J.Str(vote, "createdBy")) == ctx.MyUnitId;
        if (!(IsManage(user) || J.Str(vote, "createdBy") == user.Sub || eligible || inUnitViaMeeting || sameUnitAsCreator)) return null;

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

    /// <summary>
    /// P0-1 (R1): phiên họp có "thấy được" HAY KHÔNG (khác CanReadMeetingList — mức chiếu ở
    /// ProjectMeeting bên dưới). Thấy được nếu: quản lý HOẶC LÀ thành phần/khách mời/chủ
    /// trì/thư ký (IsMeetingMember) HOẶC phiên thuộc đơn vị mình (MyUnitMeetingIds). Không
    /// thỏa -> ẨN KHỎI DANH SÁCH hoàn toàn; GET theo id -> 404.
    /// </summary>
    public static bool CanSeeMeetingList(JsonObject m, JwtPayload user, AccessCtx ctx)
    {
        var id = J.Str(m, "id");
        return IsMeetingMember(m, user) || (id != null && ctx.MyUnitMeetingIds.Contains(id));
    }

    /// <summary>
    /// Phiên họp: người NGOÀI THÀNH PHẦN TRỰC TIẾP — dù thấy được lịch nhờ "cùng đơn vị"
    /// (CanSeeMeetingList) hay không — vẫn thấy tiêu đề/thời gian/phòng/chương trình, NHƯNG
    /// KHÔNG đọc được minutes/conclusions. Không đổi so với trước P0-1 (P0-1 chỉ siết THÊM
    /// một lớp lọc TRƯỚC bước này). Port projectMeeting.
    /// </summary>
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

    /// <summary>
    /// P1-6 — Phản hồi/góp ý người dùng (feedbacks): của MÌNH luôn thấy; admin thấy TẤT
    /// CẢ; unit_admin thấy phản hồi CÙNG ĐƠN VỊ mình (f.unitId do server ép lúc tạo —
    /// đáng tin). Vai trò khác chỉ thấy phản hồi của chính mình.
    /// </summary>
    public static bool CanReadFeedback(JsonObject f, JwtPayload user, AccessCtx ctx)
    {
        if (user.Role == "admin") return true;
        if (J.Str(f, "userId") == user.Sub) return true;
        var unitId = J.Str(f, "unitId");
        if (user.Role == "unit_admin" && unitId != null && unitId == ctx.MyUnitId) return true;
        return false;
    }

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
            // P0-1: ẨN HẲN phiên không thuộc phạm vi (không chỉ redact minutes) trước khi chiếu.
            case "meetings": return rows.Where(m => CanSeeMeetingList(m, user, ctx)).Select(m => ProjectMeeting(m, user)).ToList();
            case "tasks": return rows.Where(t => CanReadTask(t, user, ctx)).ToList();
            case "speakRequests": return rows.Where(s => CanReadSpeak(s, user, ctx)).ToList();
            case "questions": return rows.Where(q => CanReadQuestion(q, user, ctx)).ToList();
            case "guides": return rows.Where(g => CanReadGuide(g, user)).ToList();
            case "apiKeys": return CanReadApiKey(user) ? rows : new List<JsonObject>();
            case "feedbacks": return rows.Where(f => CanReadFeedback(f, user, ctx)).ToList();
            default: return rows;
        }
    }
}
