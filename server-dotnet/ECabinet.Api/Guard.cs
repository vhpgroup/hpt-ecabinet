using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using ECabinet.Api.Http;

namespace ECabinet.Api;

/// <summary>
/// GUARD — khóa cứng đường CRUD chung (port guard.js).
///  validatePatch: kiểm KIỂU dữ liệu trước khi ghi (sai kiểu -> 400, KHÔNG lưu).
///  guardPatch   : làm sạch patch nhạy cảm (votes/meetings/questions/documents/apiKeys/users).
/// Trường nhạy cảm CHỈ đổi được qua /api/actions.
/// </summary>
public static class Guard
{
    private static readonly string[] Manage = { "admin", "secretary", "chairman" };
    private static HttpError Err(int status, string message) => new(status, message);

    // ---------------- SCHEMA (kiểu từng field) ----------------
    private static readonly Dictionary<string, Dictionary<string, string>> Schema = new()
    {
        ["meetings"] = new()
        {
            ["code"] = "string", ["title"] = "string", ["description"] = "string", ["startTime"] = "string",
            ["endTime"] = "string", ["roomId"] = "string", ["isOnline"] = "boolean", ["status"] = "string",
            ["chairId"] = "string", ["secretaryId"] = "string", ["participants"] = "array", ["agenda"] = "array",
            ["currentAgendaItemId"] = "string|null", ["conclusions"] = "array", ["minutes"] = "object|null",
            ["invitedAt"] = "string", ["questionSession"] = "string", ["seatAssignments"] = "object",
            ["meetingType"] = "string", ["currentItemStartedAt"] = "string",
        },
        // + trackerUserId (P1-5, HSMT dòng 372 "Cán bộ theo dõi") — string, OPTIONAL
        ["votes"] = new()
        {
            ["kind"] = "string", ["meetingId"] = "string|null", ["agendaItemId"] = "string|null", ["title"] = "string",
            ["description"] = "string", ["options"] = "array", ["ballots"] = "array", ["eligibleIds"] = "array",
            ["documentIds"] = "array", ["secret"] = "boolean", ["status"] = "string", ["deadline"] = "string|null",
            ["trackerUserId"] = "string",
        },
        ["documents"] = new()
        {
            ["name"] = "string", ["kind"] = "string", ["meetingId"] = "string|null", ["agendaItemId"] = "string|null",
            ["sharedWith"] = "array", ["secret"] = "boolean", ["content"] = "string", ["dataUrl"] = "string",
            ["version"] = "number", ["mime"] = "string", ["reviewStatus"] = "string", ["reviewNote"] = "string",
            ["reviewedById"] = "string", ["reviewedAt"] = "string", ["issuingBody"] = "string",
            // folder (mục 14): "string|null" — vá 2026-07-20 (mục 14 "Xóa thư mục"), port guard.js —
            // PATCH { folder: null } round-trip đúng qua JSON để "gỡ nhãn" (undefined bị
            // JSON.stringify loại khỏi body phía client trước khi gửi).
            ["folder"] = "string|null",
            ["size"] = "number", ["storageKey"] = "string", // Tách file (GĐ3): OPTIONAL, không phá tương thích
        },
        ["annotations"] = new() { ["docId"] = "string", ["content"] = "string", ["isPublic"] = "boolean" },
        ["tasks"] = new()
        {
            ["title"] = "string", ["description"] = "string", ["assigneeId"] = "string", ["deadline"] = "string",
            ["status"] = "string", ["progress"] = "number", ["meetingId"] = "string|null",
        },
        ["notifications"] = new() { ["read"] = "boolean", ["title"] = "string", ["body"] = "string", ["type"] = "string" },
        ["users"] = new()
        {
            ["fullName"] = "string", ["title"] = "string", ["unitId"] = "string", ["role"] = "string",
            ["email"] = "string", ["phone"] = "string", ["status"] = "string", ["avatarColor"] = "string",
            ["username"] = "string", ["position"] = "string",
        },
        ["units"] = new() { ["name"] = "string", ["short"] = "string", ["order"] = "number" },
        ["rooms"] = new()
        {
            ["name"] = "string", ["location"] = "string", ["capacity"] = "number", ["equipment"] = "array",
            ["supportsOnline"] = "boolean", ["status"] = "string", ["layout"] = "object|null",
        },
        ["speakRequests"] = new() { ["meetingId"] = "string", ["topic"] = "string", ["status"] = "string" },
        ["questions"] = new()
        {
            ["meetingId"] = "string", ["userId"] = "string", ["targetName"] = "string", ["topic"] = "string",
            ["content"] = "string", ["status"] = "string", ["order"] = "number", ["calledAt"] = "string", ["endedAt"] = "string",
        },
        ["messages"] = new() { ["meetingId"] = "string", ["content"] = "string", ["toId"] = "string|null" },
        ["catalogs"] = new() { ["type"] = "string", ["name"] = "string", ["description"] = "string", ["order"] = "number", ["active"] = "boolean" },
        ["guides"] = new()
        {
            ["title"] = "string", ["content"] = "string", ["fileName"] = "string", ["fileData"] = "string",
            ["roleScope"] = "array", ["updatedAt"] = "string", ["storageKey"] = "string", // Tách file (GĐ3): OPTIONAL
        },
        ["apiKeys"] = new()
        {
            ["name"] = "string", ["prefix"] = "string", ["keyHash"] = "string", ["scopes"] = "array", ["active"] = "boolean",
            ["createdAt"] = "string", ["createdById"] = "string", ["lastUsedAt"] = "string", ["callCount"] = "number", ["note"] = "string",
        },
        // P1-6 — Phản hồi/góp ý người dùng (E-HSMT mục 5.1–5.4). userId/unitId do SERVER
        // ép lúc tạo (App.cs) — vẫn kiểm kiểu ở đây để chặn giá trị rác.
        ["feedbacks"] = new()
        {
            ["userId"] = "string", ["unitId"] = "string|null", ["category"] = "string", ["content"] = "string",
            ["status"] = "string", ["response"] = "string", ["handledBy"] = "string|null",
            ["createdAt"] = "string", ["updatedAt"] = "string",
        },
    };

    private static readonly string[] ValidRoles = { "admin", "chairman", "secretary", "delegate", "unit_admin" };
    private static readonly string[] ValidReview = { "draft", "pending", "approved", "rejected" };
    // P1-5 — trạng thái phiếu lấy ý kiến/biểu quyết hợp lệ. 'draft' MỚI (chưa mở, cấm bỏ phiếu).
    private static readonly string[] ValidVoteStatus = { "draft", "pending", "open", "closed" };
    private static readonly string[] ValidCatalogTypes = { "position", "meetingType", "issuingBody", "docType" };
    // P1-6 — loại/trạng thái phản hồi người dùng hợp lệ
    private static readonly string[] ValidFeedbackCategory = { "bug", "feature", "question", "other" };
    private static readonly string[] ValidFeedbackStatus = { "new", "processing", "resolved" };
    private static readonly Regex SeatKey = new(@"^\d+-\d+$", RegexOptions.Compiled);
    private static bool IsSeatKey(JsonNode? v) => v is JsonValue && J.Str(v) is string s && SeatKey.IsMatch(s);

    // P1-7 — Whitelist định dạng tệp đính kèm tài liệu theo Phụ lục TT 39/2017/TT-BTTTT.
    private static readonly string[] AllowedFileExt =
    {
        "pdf", "doc", "docx", "odt", "xls", "xlsx", "ods", "csv", "ppt", "pptx", "odp",
        "txt", "rtf", "jpg", "jpeg", "png", "gif", "tif", "tiff", "bmp", "zip", "rar",
    };

    /// <summary>Phần mở rộng chữ thường của tên tệp; null nếu không có/không phải chuỗi. Port extOf.</summary>
    private static string? ExtOf(string? name)
    {
        if (string.IsNullOrEmpty(name)) return null;
        var m = System.Text.RegularExpressions.Regex.Match(name.Trim(), @"\.([a-zA-Z0-9]+)$");
        return m.Success ? m.Groups[1].Value.ToLowerInvariant() : null;
    }

    /// <summary>Kiểm 1 giá trị có khớp spec kiểu ("string|null", "object|null"...). Port typeOk.</summary>
    private static bool TypeOk(JsonNode? val, string spec)
    {
        foreach (var t in spec.Split('|'))
        {
            switch (t)
            {
                case "null" when val is null: return true;
                case "array" when val is JsonArray: return true;
                case "object" when val is JsonObject: return true;
                case "string" when val is JsonValue sv && sv.TryGetValue<string>(out _): return true;
                case "number" when val is JsonValue nv && nv.TryGetValue<double>(out var d) && double.IsFinite(d): return true;
                case "boolean" when val is JsonValue bv && bv.TryGetValue<bool>(out _): return true;
            }
        }
        return false;
    }

    // helpers đọc kiểu JS
    private static bool IsFiniteNumber(JsonNode? n, out double d)
    {
        d = 0;
        return n is JsonValue v && v.TryGetValue<double>(out d) && double.IsFinite(d);
    }
    private static bool IsInteger(JsonNode? n, out int i)
    {
        i = 0;
        if (n is JsonValue v && v.TryGetValue<double>(out var d) && double.IsFinite(d) && Math.Floor(d) == d)
        { i = (int)d; return true; }
        return false;
    }
    private static bool IsNonEmptyString(JsonNode? n)
        => n is JsonValue v && v.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s);

    /// <summary>
    /// Kiểm kiểu cho PATCH/POST. Ném 400 khi sai. Áp cho mọi collection. Port validatePatch.
    /// `existing` (P1-7, OPTIONAL): bản ghi HIỆN CÓ khi đây là PATCH (null khi POST/tạo mới)
    /// — dùng để suy ra trạng thái HIỆU LỰC (existing + patch) của documents.name/dataUrl.
    /// </summary>
    public static void ValidatePatch(string col, JsonNode? bodyNode, JsonObject? existing = null)
    {
        if (bodyNode is not JsonObject body)
            throw Err(400, "Dữ liệu gửi lên không hợp lệ (phải là đối tượng JSON)");

        if (Schema.TryGetValue(col, out var schema))
        {
            foreach (var kv in body)
            {
                // v === undefined -> bỏ (không xảy ra với JsonObject: key tồn tại). null vẫn kiểm theo spec.
                if (!schema.TryGetValue(kv.Key, out var spec)) continue; // không quản: bỏ qua
                if (!TypeOk(kv.Value, spec)) throw Err(400, $"Trường \"{kv.Key}\" sai kiểu dữ liệu (cần {spec})");
            }
        }

        // Kiểm sâu phần tử mảng cấu trúc
        if (col == "meetings" && J.Arr(body, "participants") is JsonArray parts)
        {
            foreach (var p in parts)
                if (p is not JsonObject po || J.Str(po, "userId") is null)
                    throw Err(400, "Danh sách tham dự không hợp lệ (mỗi phần tử phải có userId)");
        }
        if (col == "meetings" && J.Arr(body, "agenda") is JsonArray agenda)
        {
            foreach (var a in agenda)
                if (a is not JsonObject ao || J.Str(ao, "id") is null)
                    throw Err(400, "Chương trình họp không hợp lệ");
        }
        if (col == "votes" && J.Arr(body, "ballots") is JsonArray ballots)
        {
            foreach (var b in ballots)
                if (b is not JsonObject bo || J.Str(bo, "userId") is null || J.Str(bo, "optionId") is null)
                    throw Err(400, "Danh sách phiếu không hợp lệ");
        }
        if (col == "tasks" && IsFiniteNumber(body.TryGetPropertyValue("progress", out var pr) ? pr : null, out var prog)
            && (prog < 0 || prog > 100))
            throw Err(400, "Tiến độ phải trong khoảng 0–100");

        if (col == "questions" && J.Has(body, "status"))
        {
            var st = J.Str(body, "status");
            if (st is null || !new[] { "pending", "called", "done", "rejected" }.Contains(st))
                throw Err(400, "Trạng thái chất vấn không hợp lệ");
        }
        if (col == "meetings" && J.Has(body, "questionSession"))
        {
            var qs = J.Str(body, "questionSession");
            if (qs is null || !new[] { "closed", "open", "paused" }.Contains(qs))
                throw Err(400, "Trạng thái phiên chất vấn không hợp lệ");
        }
        if (col == "meetings" && J.Has(body, "seatAssignments"))
        {
            var sa = body["seatAssignments"];
            if (sa is not JsonObject sao)
                throw Err(400, "Sơ đồ chỗ ngồi không hợp lệ (phải là đối tượng ánh xạ)");
            foreach (var kv in sao)
                if (!IsSeatKey(kv.Value))
                    throw Err(400, "Vị trí chỗ ngồi không hợp lệ (mỗi giá trị phải là \"hàng-cột\")");
        }
        if (col == "rooms" && J.Has(body, "layout") && body["layout"] is not null)
        {
            if (body["layout"] is not JsonObject lo
                || !IsInteger(lo.TryGetPropertyValue("rows", out var rr) ? rr : null, out var rows)
                || !IsInteger(lo.TryGetPropertyValue("cols", out var cc) ? cc : null, out var cols)
                || rows < 1 || rows > 12 || cols < 1 || cols > 12)
                throw Err(400, "Sơ đồ phòng họp không hợp lệ (số hàng/cột phải trong khoảng 1–12)");
            if (J.Has(lo, "disabled"))
            {
                var dis = J.Arr(lo, "disabled");
                if (dis is null || dis.Any(x => !IsSeatKey(x)))
                    throw Err(400, "Danh sách ô lối đi không hợp lệ");
            }
        }
        if (col == "documents" && J.Has(body, "reviewStatus"))
        {
            var rs = J.Str(body, "reviewStatus");
            if (rs is null || !ValidReview.Contains(rs)) throw Err(400, "Trạng thái duyệt tài liệu không hợp lệ");
        }
        // P1-5 — trạng thái phiếu lấy ý kiến/biểu quyết: chỉ nhận enum hợp lệ (gồm 'draft' mới)
        if (col == "votes" && J.Has(body, "status"))
        {
            var vs = J.Str(body, "status");
            if (vs is null || !ValidVoteStatus.Contains(vs)) throw Err(400, "Trạng thái phiếu lấy ý kiến/biểu quyết không hợp lệ");
        }
        // P1-7 — TT 39/2017/TT-BTTTT: whitelist định dạng tệp đính kèm tài liệu. Chỉ kiểm khi
        // BẢN GHI HIỆU LỰC (existing hợp nhất với patch) có file thật (dataUrl khác rỗng) —
        // tài liệu chỉ có `content` (soạn trực tiếp, không upload) KHÔNG bị áp whitelist này.
        if (col == "documents")
        {
            var effDataUrl = J.Has(body, "dataUrl") ? J.Str(body, "dataUrl") : (existing != null ? J.Str(existing, "dataUrl") : null);
            // Tách file (GĐ3): tệp có thể đã externalize sang S3 (storageKey) — dataUrl vắng
            // trong bản ghi nhưng VẪN là "có tệp" -> vẫn áp whitelist theo tên tệp.
            var effKey = J.Has(body, "storageKey") ? J.Str(body, "storageKey") : (existing != null ? J.Str(existing, "storageKey") : null);
            if (!string.IsNullOrEmpty(effDataUrl) || !string.IsNullOrEmpty(effKey))
            {
                var effName = J.Has(body, "name") ? J.Str(body, "name") : (existing != null ? J.Str(existing, "name") : null);
                var ext = ExtOf(effName);
                if (ext is null || !AllowedFileExt.Contains(ext))
                    throw Err(400, $"Định dạng tệp không hợp lệ. Định dạng cho phép: {string.Join(", ", AllowedFileExt)}");
            }
        }
        if (col == "users" && J.Has(body, "role"))
        {
            var role = J.Str(body, "role");
            if (role is null || !ValidRoles.Contains(role)) throw Err(400, "Vai trò người dùng không hợp lệ");
        }
        if (col == "meetings" && J.Arr(body, "agenda") is JsonArray agenda2)
        {
            foreach (var a in agenda2)
            {
                if (a is JsonObject ao && J.Has(ao, "durationMinutes"))
                {
                    if (!IsFiniteNumber(ao["durationMinutes"], out var dm) || dm < 0)
                        throw Err(400, "Thời lượng mục chương trình phải là số phút không âm");
                }
            }
        }
        if (col == "catalogs")
        {
            if (J.Has(body, "type"))
            {
                var t = J.Str(body, "type");
                if (t is null || !ValidCatalogTypes.Contains(t))
                    throw Err(400, "Loại danh mục không hợp lệ (chỉ chức vụ / loại phiên họp / cơ quan ban hành / loại tài liệu)");
            }
            if (J.Has(body, "name") && !IsNonEmptyString(body["name"]))
                throw Err(400, "Tên danh mục không được để trống");
        }
        if (col == "guides")
        {
            if (J.Has(body, "title") && !IsNonEmptyString(body["title"]))
                throw Err(400, "Tiêu đề tài liệu hướng dẫn không được để trống");
            if (J.Arr(body, "roleScope") is JsonArray rsArr && rsArr.Any(r => J.Str(r) is not string rv || !ValidRoles.Contains(rv)))
                throw Err(400, "Phạm vi vai trò của tài liệu hướng dẫn không hợp lệ");
        }
        if (col == "apiKeys" && J.Has(body, "scopes"))
        {
            var sc = J.Arr(body, "scopes");
            if (sc is null || sc.Any(s => J.Str(s) is not "meetings" and not "documents"))
                throw Err(400, "Phạm vi (scope) của khóa API không hợp lệ (chỉ meetings / documents)");
        }
        // P1-6 — Phản hồi/góp ý người dùng: category/status theo enum; nội dung không rỗng
        if (col == "feedbacks")
        {
            if (J.Has(body, "category"))
            {
                var cat = J.Str(body, "category");
                if (cat is null || !ValidFeedbackCategory.Contains(cat))
                    throw Err(400, "Loại phản hồi không hợp lệ (chỉ: lỗi / đề xuất tính năng / câu hỏi / khác)");
            }
            if (J.Has(body, "status"))
            {
                var fs = J.Str(body, "status");
                if (fs is null || !ValidFeedbackStatus.Contains(fs))
                    throw Err(400, "Trạng thái phản hồi không hợp lệ");
            }
            if (J.Has(body, "content") && !IsNonEmptyString(body["content"]))
                throw Err(400, "Nội dung phản hồi không được để trống");
        }
    }

    // ---------------- guardPatch ----------------
    /// <summary>
    /// Trả patch đã làm sạch; ném 403 khi bị cấm. Port guardPatch.
    /// `meeting` (OPTIONAL, P0-3): phiên họp chứa tài liệu (nếu col == "documents" và có
    /// meetingId) — nạp trước ở App.cs từ existing["meetingId"] để GuardDocuments biết ai
    /// là "thành phần phiên" được phép duyệt, không chỉ nhóm MANAGE toàn cục.
    /// `actorUnitId` (OPTIONAL): đơn vị của unit_admin đang PATCH — dùng cho feedbacks
    /// (P1-6) VÀ meetings (Khuyến nghị 1, 2026-07-18, ý nghĩa tương ứng theo `col`).
    /// `meetingUnitId` (OPTIONAL, Khuyến nghị 1): đơn vị của CHÍNH phiên đang PATCH (chỉ
    /// dùng khi col == "meetings" — suy từ chairId/secretaryId HIỆN CÓ, tính SẴN ở App.cs
    /// vì cần await tra store, GuardMeetings là hàm thuần đồng bộ).
    /// </summary>
    public static JsonObject GuardPatch(string col, JsonObject existing, JsonObject patch, JwtPayload user, JsonObject? meeting = null, string? actorUnitId = null, string? meetingUnitId = null)
    {
        return col switch
        {
            "votes" => GuardVotes(patch, user),
            "meetings" => GuardMeetings(existing, patch, user, actorUnitId, meetingUnitId),
            "questions" => GuardQuestions(existing, patch, user),
            "documents" => GuardDocuments(existing, patch, user, meeting),
            "apiKeys" => GuardApiKeys(patch),
            "feedbacks" => GuardFeedbacks(existing, patch, user, actorUnitId),
            _ => patch,
        };
    }

    private static JsonObject GuardApiKeys(JsonObject patch)
    {
        var p = J.CloneObj(patch);
        p.Remove("keyHash"); p.Remove("prefix"); p.Remove("createdAt");
        p.Remove("createdById"); p.Remove("lastUsedAt"); p.Remove("callCount");
        return p;
    }

    /// <summary>
    /// P1-6 — PHẢN HỒI/GÓP Ý NGƯỜI DÙNG (vá QA 18/07): status/response/handledBy do admin
    /// (toàn hệ thống) HOẶC unit_admin với phản hồi TRONG ĐƠN VỊ MÌNH (actorUnitId đọc từ
    /// DB tại App.cs — JWT không mang unitId; vai trò HSMT "Quản trị đơn vị: nhận & phân
    /// phối yêu cầu"). KHÔNG áp dụng cho secretary/chairman. Người không phải người xử lý:
    /// chỉ sửa phản hồi CỦA CHÍNH MÌNH, KHÔNG đụng userId/unitId (bất biến, server ép lúc
    /// tạo). handledBy luôn bị SERVER ép = chính người đang xử lý.
    /// </summary>
    private static JsonObject GuardFeedbacks(JsonObject existing, JsonObject patch, JwtPayload user, string? actorUnitId = null)
    {
        var p = J.CloneObj(patch);
        var isHandler = user.Role == "admin"
            || (user.Role == "unit_admin" && J.Str(existing, "unitId") is string fu && fu == actorUnitId);
        if (!isHandler)
        {
            if (J.Has(p, "status") || J.Has(p, "response") || J.Has(p, "handledBy"))
                throw Err(403, "Chỉ Quản trị hệ thống hoặc Quản trị đơn vị (trong đơn vị mình) được cập nhật trạng thái/phản hồi góp ý");
            if (J.Str(existing, "userId") != user.Sub)
                throw Err(403, "Bạn không được sửa phản hồi của người khác");
        }
        p.Remove("userId");
        p.Remove("unitId");
        if (J.Has(p, "handledBy")) p["handledBy"] = user.Sub;
        return p;
    }

    /// <summary>
    /// P0-3 — BYPASS HẸP cho ACL thô Acl.Rules["documents"].Update = "ownerOrManage". ACL cấp
    /// collection chạy TRƯỚC GuardDocuments; nếu giữ nguyên "ownerOrManage", một "Thành viên
    /// dự họp" (không phải owner, không phải MANAGE toàn cục) sẽ bị 403 ngay tại ACL,
    /// GuardDocuments không bao giờ được gọi tới. Thay vì MỞ RỘNG ACL chung (rủi ro: field
    /// khác của mọi tài liệu sẽ bị bất kỳ ai PATCH được), thêm 1 lối đi HẸP: cho qua ACL CHỈ
    /// KHI đúng là 1 yêu cầu DUYỆT hợp lệ (patch CHỈ chứa reviewStatus/reviewNote, chuyển
    /// pending -> approved|rejected, người gọi là thành phần phiên, KHÔNG phải owner).
    /// GuardDocuments vẫn ĐỘC LẬP kiểm tra lại (defense-in-depth) — hàm này chỉ quyết định
    /// có cho "đi qua cổng ACL" hay không. Port canReviewDocumentAsMeetingMember.
    /// </summary>
    public static bool CanReviewDocumentAsMeetingMember(JsonObject doc, JsonObject patch, JwtPayload user, JsonObject? meeting)
    {
        if (meeting is null) return false;
        if (J.Str(doc, "ownerId") == user.Sub) return false; // owner không được lách qua đường này
        var isMember = user.Sub == J.Str(meeting, "chairId")
            || user.Sub == J.Str(meeting, "secretaryId")
            || (J.Arr(meeting, "participants") ?? new JsonArray()).OfType<JsonObject>().Any(p => J.Str(p, "userId") == user.Sub);
        if (!isMember) return false;
        var allowedKeys = new HashSet<string> { "reviewStatus", "reviewNote" };
        if (!patch.Select(kv => kv.Key).All(k => allowedKeys.Contains(k))) return false; // không cho lách sửa field khác kèm theo
        var cur = J.Has(doc, "reviewStatus") ? (J.Str(doc, "reviewStatus") ?? "approved") : "approved";
        var next = J.Str(patch, "reviewStatus");
        return cur == "pending" && (next == "approved" || next == "rejected");
    }

    private static JsonObject GuardDocuments(JsonObject existing, JsonObject patch, JwtPayload user, JsonObject? meeting)
    {
        var isManage = Manage.Contains(user.Role);
        var isMeetingMember = meeting != null && (
            user.Sub == J.Str(meeting, "chairId")
            || user.Sub == J.Str(meeting, "secretaryId")
            || (J.Arr(meeting, "participants") ?? new JsonArray()).OfType<JsonObject>().Any(p => J.Str(p, "userId") == user.Sub)
        );
        var p = J.CloneObj(patch);
        var cur = J.Has(existing, "reviewStatus") ? (J.Str(existing, "reviewStatus") ?? "approved") : "approved";

        if (J.Has(p, "reviewStatus") && J.Str(p, "reviewStatus") != cur)
        {
            var next = J.Str(p, "reviewStatus");
            var isOwner = J.Str(existing, "ownerId") == user.Sub;
            var allowedOwner = isOwner && (cur == "draft" || cur == "rejected") && next == "pending";
            // QUAN TRỌNG: !isOwner — người trình KHÔNG được tự duyệt tài liệu CỦA CHÍNH
            // MÌNH dù họ CÓ là thành phần phiên họp đó — nếu không chặn riêng, "cùng phiên"
            // sẽ vô tình mở lại đúng lỗ hổng "tự duyệt" mà allowedOwner đang ngăn.
            var allowedApprover = (isManage || isMeetingMember) && !isOwner && cur == "pending" && (next == "approved" || next == "rejected");
            if (!allowedOwner && !allowedApprover)
                throw Err(403, "Không được chuyển trạng thái duyệt tài liệu như vậy");
            if (next == "rejected")
            {
                var note = J.Str(p, "reviewNote")?.Trim() ?? "";
                if (string.IsNullOrEmpty(note)) throw Err(400, "Phải nhập lý do khi từ chối tài liệu");
                p["reviewNote"] = note.Length > 2000 ? note.Substring(0, 2000) : note;
            }
            if (allowedApprover)
            {
                p["reviewedById"] = user.Sub;
                p["reviewedAt"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
                if (next == "approved") p.Remove("reviewNote"); // undefined = xóa khỏi patch
            }
            else
            {
                p.Remove("reviewNote"); // owner trình lại: xóa nhận xét cũ
            }
        }
        else if (!J.Has(p, "reviewStatus"))
        {
            p.Remove("reviewedById");
            p.Remove("reviewedAt");
        }
        return p;
    }

    private static JsonObject GuardQuestions(JsonObject existing, JsonObject patch, JwtPayload user)
    {
        var isManage = Manage.Contains(user.Role);
        var p = J.CloneObj(patch);
        p.Remove("meetingId");
        p.Remove("userId");

        if (isManage) return p;

        if (J.Str(existing, "userId") != user.Sub)
            throw Err(403, "Bạn chỉ được sửa lượt chất vấn của chính mình");

        if (J.Has(p, "status") || J.Has(p, "order") || J.Has(p, "calledAt") || J.Has(p, "endedAt"))
            throw Err(403, "Đại biểu không được tự đổi trạng thái lượt chất vấn — việc gọi/kết thúc do chủ tọa điều hành");

        if (J.Str(existing, "status") != "pending"
            && (J.Has(p, "topic") || J.Has(p, "content") || J.Has(p, "targetName")))
            throw Err(403, "Chỉ sửa được nội dung chất vấn khi đang chờ gọi");

        return p;
    }

    private static JsonObject GuardVotes(JsonObject patch, JwtPayload user)
    {
        if (!Manage.Contains(user.Role))
            throw Err(403, "Biểu quyết/lấy ý kiến thực hiện qua /api/actions/vote/… — không sửa trực tiếp");
        var p = J.CloneObj(patch);
        p.Remove("ballots"); p.Remove("status"); p.Remove("openedAt"); p.Remove("closedAt");
        return p;
    }

    // Field điều hành NỘI DUNG phiên (không phải trạng thái/chữ ký/điểm danh — những field
    // đó đã bị khóa cứng ở các nhánh riêng bên dưới, áp dụng bất kể isChairOfThisMeeting):
    // chairId/secretaryId của CHÍNH phiên đang sửa (id-match trên bản ghi EXISTING, không
    // phải patch — tránh id-match giả bằng cách tự gửi chairId mới trong patch rồi tự nhận là
    // chủ trì) được ghi dù role tài khoản không thuộc MANAGE (vá P2-1, tester-qa.md mục 3.5 —
    // FE `can.chairControls` cho phép id-match sửa kết luận, BE trước đây chỉ role-match nên
    // âm thầm xóa sạch patch — mở đúng thiết kế nghiệp vụ, KHÔNG mở rộng ACL toàn cục).
    private static readonly string[] ChairContentFields = { "conclusions", "agenda", "minutes" };

    /// <summary>
    /// Khuyến nghị 1 (2026-07-18, chốt code chéo) — QUẢN TRỊ ĐƠN VỊ (unit_admin) SỬA phiên
    /// họp THUỘC ĐƠN VỊ MÌNH: `meetingUnitId` (đơn vị của phiên ĐANG SỬA, suy từ chairId/
    /// secretaryId hiện có — tính SẴN ở App.cs vì cần await tra store) phải khớp
    /// `actorUnitId` (đơn vị của unit_admin, đọc từ store, không tin JWT/body).
    /// App.EnforceMeetingWrite() đã CHẶN 403 trước khi vào đây nếu KHÔNG khớp đơn vị hoặc
    /// cố đổi chair/secretary sang đơn vị khác — GuardMeetings chỉ cần biết "unit_admin CÓ
    /// được coi như MANAGE cho các field nội dung phiên NÀY hay không" (defense-in-depth).
    /// Port isUnitAdminOfThisMeeting (guard.js).
    /// </summary>
    private static bool IsUnitAdminOfThisMeeting(JwtPayload user, string? actorUnitId, string? meetingUnitId)
    {
        if (user.Role != "unit_admin") return false;
        if (string.IsNullOrEmpty(actorUnitId) || string.IsNullOrEmpty(meetingUnitId)) return false;
        return meetingUnitId == actorUnitId;
    }

    private static JsonObject GuardMeetings(JsonObject existing, JsonObject patch, JwtPayload user, string? actorUnitId = null, string? meetingUnitId = null)
    {
        var isManage = Manage.Contains(user.Role);
        var isChairOfThisMeeting = J.Str(existing, "chairId") == user.Sub || J.Str(existing, "secretaryId") == user.Sub;
        // Khuyến nghị 1: unit_admin của ĐÚNG đơn vị phiên này được coi như MANAGE cho MỌI
        // field nội dung phiên — NHƯNG KHÔNG mở các field điều hành TRỰC TIẾP tại phòng họp
        // (questionSession/seatAssignments/currentItemStartedAt — 3 nhánh dưới đây CHỦ Ý
        // giữ `!isManage` riêng, không gộp isUnitAdminHere).
        var isUnitAdminHere = IsUnitAdminOfThisMeeting(user, actorUnitId, meetingUnitId);
        var p = J.CloneObj(patch);

        p.Remove("status");
        p.Remove("invitedAt");

        if (J.Has(p, "questionSession") && !isManage)
            throw Err(403, "Chỉ chủ tọa/thư ký được điều hành phiên chất vấn");
        if (J.Has(p, "seatAssignments") && !isManage)
            throw Err(403, "Chỉ chủ tọa/thư ký được gán vị trí chỗ ngồi cho đại biểu");
        if (J.Has(p, "currentItemStartedAt") && !isManage)
            throw Err(403, "Chỉ chủ tọa/thư ký được cập nhật tiến trình mục chương trình");

        // biên bản: chữ ký & khóa chỉ qua /actions/sign; đã khóa là bất biến
        if (J.Has(p, "minutes"))
        {
            var exMinutes = J.Obj(existing, "minutes");
            // Vá 18/07 (chốt code chéo): NGAY KHI có ≥1 chữ ký (dù chưa đủ 2 để locked),
            // nội dung biên bản bất biến qua CRUD chung — khớp hành vi client + bản Node.
            var exHasSig = exMinutes is not null
                && J.Arr(exMinutes, "signatures") is JsonArray exSigs && exSigs.Count > 0;
            if (exMinutes is not null && (J.BoolOr(exMinutes, "locked", false) || exHasSig))
            {
                p.Remove("minutes");
            }
            else if (p["minutes"] is JsonObject pm)
            {
                var merged = J.CloneObj(pm);
                merged["signatures"] = exMinutes is not null && J.Arr(exMinutes, "signatures") is JsonArray sigs
                    ? J.DeepClone(sigs) : new JsonArray();
                merged["locked"] = false;
                p["minutes"] = merged;
            }
        }

        // thành phần tham dự — unit_admin CÙNG đơn vị phiên coi như MANAGE (được đặt lại
        // toàn bộ danh sách như lúc tạo phiên), giữ nguyên checkedInAt do server ghi.
        if (J.Has(p, "participants") && p["participants"] is JsonArray incoming)
        {
            p["participants"] = (isManage || isUnitAdminHere)
                ? KeepServerCheckins(existing, incoming)
                : DelegateOwnRowOnly(existing, incoming, user.Sub);
        }

        // đại biểu thường: ngoài dòng tham dự của mình, không sửa gì khác — TRỪ chairId/
        // secretaryId của CHÍNH phiên này được thêm quyền ghi conclusions/agenda/minutes
        // (đã sanitize signatures/locked ở nhánh trên, KHÔNG mở status/checkedInAt/chữ ký).
        // unit_admin CÙNG đơn vị phiên: coi như MANAGE ở bước này (giữ TOÀN BỘ field còn lại
        // trong patch sau các bước lọc/khóa cứng trên).
        if (!isManage && !isUnitAdminHere)
        {
            var keepFields = isChairOfThisMeeting
                ? new[] { "participants" }.Concat(ChairContentFields).ToArray()
                : new[] { "participants" };
            foreach (var key in p.Select(kv => kv.Key).ToList())
                if (!keepFields.Contains(key)) p.Remove(key);
        }
        return p;
    }

    private static JsonArray KeepServerCheckins(JsonObject existing, JsonArray incoming)
    {
        var exParts = J.Arr(existing, "participants") ?? new JsonArray();
        var outArr = new JsonArray();
        foreach (var rowN in incoming)
        {
            if (rowN is not JsonObject row) { outArr.Add(J.DeepClone(rowN)); continue; }
            var uid = J.Str(row, "userId");
            var old = exParts.OfType<JsonObject>().FirstOrDefault(x => J.Str(x, "userId") == uid);
            var merged = J.CloneObj(row);
            merged["checkedInAt"] = old is not null && J.Has(old, "checkedInAt") ? J.DeepClone(old["checkedInAt"]) : null;
            outArr.Add(merged);
        }
        return outArr;
    }

    private static JsonArray DelegateOwnRowOnly(JsonObject existing, JsonArray incoming, string sub)
    {
        var exParts = J.Arr(existing, "participants") ?? new JsonArray();
        var outArr = new JsonArray();
        foreach (var oldN in exParts)
        {
            if (oldN is not JsonObject old) { outArr.Add(J.DeepClone(oldN)); continue; }
            if (J.Str(old, "userId") != sub) { outArr.Add(J.CloneObj(old)); continue; }
            var mine = incoming.OfType<JsonObject>().FirstOrDefault(r => J.Str(r, "userId") == sub);
            if (mine is null) { outArr.Add(J.CloneObj(old)); continue; }
            var merged = J.CloneObj(old);
            var attend = J.Str(mine, "attendStatus");
            if (attend is "pending" or "accepted" or "declined" or "delegated")
                merged["attendStatus"] = attend;
            // declineReason / delegateToId: chỉ nhận khi là string, ngược lại xóa (undefined)
            if (J.Str(mine, "declineReason") is string dr)
                merged["declineReason"] = dr.Length > 500 ? dr.Substring(0, 500) : dr;
            else merged.Remove("declineReason");
            if (J.Str(mine, "delegateToId") is string dti) merged["delegateToId"] = dti;
            else merged.Remove("delegateToId");
            outArr.Add(merged);
        }

        var myRow = outArr.OfType<JsonObject>().FirstOrDefault(r => J.Str(r, "userId") == sub);
        foreach (var rowN in incoming)
        {
            if (rowN is not JsonObject row) continue;
            var uid = J.Str(row, "userId");
            var isNew = !outArr.OfType<JsonObject>().Any(r => J.Str(r, "userId") == uid);
            if (isNew && myRow is not null && J.Str(myRow, "attendStatus") == "delegated" && J.Str(myRow, "delegateToId") == uid)
                outArr.Add(new JsonObject
                {
                    ["userId"] = uid,
                    ["meetingRole"] = "guest",
                    ["attendStatus"] = "accepted",
                    ["checkedInAt"] = null,
                });
        }
        return outArr;
    }
}
