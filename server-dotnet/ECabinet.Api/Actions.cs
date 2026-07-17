using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using ECabinet.Api.Http;
using ECabinet.Api.Store;

namespace ECabinet.Api;

/// <summary>
/// ENDPOINT NGHIỆP VỤ /api/actions (port actions.js).
/// Kiểm tra sâu phía server cho mutation nhạy cảm; danh tính LUÔN lấy từ JWT.
/// Ghi audit + tạo thông báo + phát realtime ngay tại server. Dùng MutateDoc (CAS) cho ghi nguyên tử.
/// </summary>
public sealed class Actions
{
    private readonly IDocStore _store;
    public Actions(IDocStore store) => _store = store;

    private static readonly string[] Manage = { "admin", "secretary", "chairman" };
    private static string NowIso() => DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");

    private static string Sha256Hex(string t)
    {
        using var sha = SHA256.Create();
        return Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(t))).ToLowerInvariant();
    }

    private Task<JsonObject?> GetDoc(string table, string id) => _store.GetByIdAsync(table, id);
    private Task SaveDoc(string table, string id, JsonObject data) => _store.UpdateAsync(table, id, data);

    private async Task Audit(JwtPayload user, string action, string detail)
    {
        var id = Guid.NewGuid().ToString();
        await _store.InsertAsync("c_audit", id, new JsonObject
        {
            ["id"] = id, ["userId"] = user.Sub, ["userName"] = user.Name,
            ["action"] = action, ["detail"] = detail, ["at"] = NowIso(),
        });
        Realtime.Broadcast(new JsonObject { ["type"] = "change", ["collection"] = "audit", ["action"] = "create", ["id"] = id, ["at"] = NowIso() });
    }

    private async Task NotifyUsers(IEnumerable<string> userIds, string title, string body, string type, string? link)
    {
        var any = false;
        foreach (var userId in userIds)
        {
            any = true;
            var id = Guid.NewGuid().ToString();
            await _store.InsertAsync("c_notifications", id, new JsonObject
            {
                ["id"] = id, ["userId"] = userId, ["title"] = title, ["body"] = body,
                ["type"] = type, ["read"] = false, ["createdAt"] = NowIso(), ["link"] = link,
            });
        }
        if (any) Realtime.Broadcast(new JsonObject { ["type"] = "change", ["collection"] = "notifications", ["action"] = "create", ["id"] = "*", ["at"] = NowIso() });
    }

    private static void Changed(string collection, string id) => Realtime.NotifyChange(collection, "update", id);

    /// <summary>Quyền điều hành phiên họp: chủ trì / thư ký của phiên, hoặc admin. Port chairCtl.</summary>
    private static bool ChairCtl(JsonObject m, JwtPayload user)
        => user.Sub == J.Str(m, "chairId") || user.Sub == J.Str(m, "secretaryId") || user.Role == "admin";

    private static async Task SendMutateError(Ctx c, MutateResult result, string notFoundMsg)
    {
        if (result.Reason == "not_found") { await HttpUtil.SendError(c.Res, 404, notFoundMsg); return; }
        await HttpUtil.SendError(c.Res, result.Status ?? 400, result.Error ?? "Lỗi xử lý");
    }

    public void Register(Router app)
    {
        // ---------------- BỎ PHIẾU / CHO Ý KIẾN (CAS) ----------------
        app.Add("POST", "/api/actions/vote/:id/ballot", Auth.RequireAuth, async c =>
        {
            var body = await HttpUtil.ReadBodyObj(c.Req);
            var userId = c.User!.Sub;
            var optionId = J.Str(body, "optionId");
            var result = await _store.MutateDocAsync("c_votes", c.Params["id"], v =>
            {
                if (J.Str(v, "status") != "open") return MutateOutcome.Fail("Nội dung này chưa mở hoặc đã đóng biểu quyết", 400);
                var elig = J.Arr(v, "eligibleIds");
                if (elig is null || !elig.Any(x => J.Str(x) == userId)) return MutateOutcome.Fail("Bạn không thuộc thành phần biểu quyết", 403);
                var ballots = J.Arr(v, "ballots") ?? new JsonArray();
                if (ballots.OfType<JsonObject>().Any(b => J.Str(b, "userId") == userId)) return MutateOutcome.Fail("Bạn đã biểu quyết nội dung này", 400);
                var options = J.Arr(v, "options");
                if (options is null || !options.OfType<JsonObject>().Any(o => J.Str(o, "id") == optionId)) return MutateOutcome.Fail("Phương án biểu quyết không hợp lệ", 400);
                var commentRaw = J.Str(body, "comment")?.Trim();
                var newBallot = new JsonObject { ["userId"] = userId, ["optionId"] = optionId };
                if (!string.IsNullOrEmpty(commentRaw)) newBallot["comment"] = commentRaw.Length > 2000 ? commentRaw.Substring(0, 2000) : commentRaw;
                newBallot["castAt"] = NowIso();
                if (J.Arr(v, "ballots") is null) v["ballots"] = new JsonArray();
                ((JsonArray)v["ballots"]!).Add(newBallot);
                return MutateOutcome.Replace(v);
            });
            if (!result.Ok) { await SendMutateError(c, result, "Không tìm thấy nội dung biểu quyết"); return; }
            Changed("votes", c.Params["id"]);
            await HttpUtil.Send(c.Res, 200, new JsonObject { ["ok"] = true });
        });

        // ---------------- MỞ BIỂU QUYẾT ----------------
        app.Add("POST", "/api/actions/vote/:id/open", Auth.RequireAuth, async c =>
        {
            var vote = await GetDoc("c_votes", c.Params["id"]);
            if (vote is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy nội dung biểu quyết"); return; }
            if (!Manage.Contains(c.User!.Role) && J.Str(vote, "createdBy") != c.User.Sub)
            { await HttpUtil.SendError(c.Res, 403, "Bạn không có quyền mở biểu quyết này"); return; }
            if (J.Str(vote, "status") != "pending") { await HttpUtil.SendError(c.Res, 400, "Chỉ mở được nội dung chưa biểu quyết"); return; }
            vote["status"] = "open";
            vote["openedAt"] = NowIso();
            await SaveDoc("c_votes", J.Str(vote, "id")!, vote);
            var elig = (J.Arr(vote, "eligibleIds") ?? new JsonArray()).Select(J.Str).Where(x => x != null && x != c.User!.Sub).Select(x => x!);
            await NotifyUsers(elig, "Biểu quyết đang mở", $"Biểu quyết \"{J.Str(vote, "title")}\" đang chờ ý kiến của bạn.", "vote",
                J.Str(vote, "meetingId") is string mid ? $"#/meetings/{mid}/live" : "#/polls");
            await Audit(c.User!, "Mở biểu quyết", $"Mở \"{J.Str(vote, "title")}\"");
            Changed("votes", J.Str(vote, "id")!);
            await HttpUtil.Send(c.Res, 200, vote);
        });

        // ---------------- ĐÓNG BIỂU QUYẾT ----------------
        app.Add("POST", "/api/actions/vote/:id/close", Auth.RequireAuth, async c =>
        {
            var vote = await GetDoc("c_votes", c.Params["id"]);
            if (vote is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy nội dung biểu quyết"); return; }
            if (!Manage.Contains(c.User!.Role) && J.Str(vote, "createdBy") != c.User.Sub)
            { await HttpUtil.SendError(c.Res, 403, "Bạn không có quyền đóng biểu quyết này"); return; }
            if (J.Str(vote, "status") != "open") { await HttpUtil.SendError(c.Res, 400, "Nội dung này không ở trạng thái đang mở"); return; }
            vote["status"] = "closed";
            vote["closedAt"] = NowIso();
            await SaveDoc("c_votes", J.Str(vote, "id")!, vote);
            var ballotN = (J.Arr(vote, "ballots") ?? new JsonArray()).Count;
            var eligN = (J.Arr(vote, "eligibleIds") ?? new JsonArray()).Count;
            await Audit(c.User!, "Đóng biểu quyết", $"Đóng \"{J.Str(vote, "title")}\" — {ballotN}/{eligN} phiếu");
            Changed("votes", J.Str(vote, "id")!);
            await HttpUtil.Send(c.Res, 200, vote);
        });

        // ---------------- ĐIỂM DANH (CAS) ----------------
        app.Add("POST", "/api/actions/meetings/:id/checkin", Auth.RequireAuth, async c =>
        {
            var body = await HttpUtil.ReadBodyObj(c.Req);
            var targetId = J.Str(body, "userId") ?? c.User!.Sub;
            var user = c.User!;
            var result = await _store.MutateDocAsync("c_meetings", c.Params["id"], m =>
            {
                if (J.Str(m, "status") != "live") return MutateOutcome.Fail("Phiên họp chưa diễn ra hoặc đã kết thúc", 400);
                if (targetId != user.Sub && !ChairCtl(m, user)) return MutateOutcome.Fail("Chỉ chủ trì/thư ký được điểm danh hộ đại biểu", 403);
                var parts = J.Arr(m, "participants") ?? new JsonArray();
                var row = parts.OfType<JsonObject>().FirstOrDefault(p => J.Str(p, "userId") == targetId);
                if (row is null) return MutateOutcome.Fail("Người này không thuộc thành phần phiên họp", 400);
                if (J.Has(row, "checkedInAt") && row["checkedInAt"] is not null) return MutateOutcome.NoChange(); // đã điểm danh
                row["checkedInAt"] = NowIso();
                row["attendStatus"] = "accepted";
                return MutateOutcome.Replace(m);
            });
            if (!result.Ok) { await SendMutateError(c, result, "Không tìm thấy phiên họp"); return; }
            if (!result.Noop)
            {
                await Audit(user, "Điểm danh", $"Điểm danh {(targetId == user.Sub ? "cá nhân" : "hộ đại biểu")} tại \"{J.Str(result.Data!, "title")}\"");
                Changed("meetings", c.Params["id"]);
            }
            await HttpUtil.Send(c.Res, 200, new JsonObject { ["ok"] = true });
        });

        // ---------------- GỬI GIẤY MỜI ----------------
        app.Add("POST", "/api/actions/meetings/:id/invite", Auth.RequireAuth, async c =>
        {
            var m = await GetDoc("c_meetings", c.Params["id"]);
            if (m is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy phiên họp"); return; }
            if (!Manage.Contains(c.User!.Role)) { await HttpUtil.SendError(c.Res, 403, "Bạn không có quyền gửi giấy mời"); return; }
            var st = J.Str(m, "status");
            if (st is not ("draft" or "invited")) { await HttpUtil.SendError(c.Res, 400, "Phiên họp không ở trạng thái gửi được giấy mời"); return; }
            m["status"] = "invited";
            m["invitedAt"] = NowIso();
            await SaveDoc("c_meetings", J.Str(m, "id")!, m);
            var parts = J.Arr(m, "participants") ?? new JsonArray();
            var recips = parts.OfType<JsonObject>().Select(p => J.Str(p, "userId")).Where(x => x != null && x != c.User!.Sub).Select(x => x!);
            var startLocal = FormatViDateTime(J.Str(m, "startTime"));
            await NotifyUsers(recips, "Giấy mời họp", $"Bạn được mời dự \"{J.Str(m, "title")}\" — {startLocal}. Vui lòng xác nhận tham dự.", "meeting", $"#/meetings/{J.Str(m, "id")}");
            await Audit(c.User!, "Gửi giấy mời", $"Gửi giấy mời \"{J.Str(m, "title")}\" đến {parts.Count} đại biểu (email + SMS)");
            Changed("meetings", J.Str(m, "id")!);
            await HttpUtil.Send(c.Res, 200, m);
        });

        // ---------------- KHAI MẠC ----------------
        app.Add("POST", "/api/actions/meetings/:id/start", Auth.RequireAuth, async c =>
        {
            var m = await GetDoc("c_meetings", c.Params["id"]);
            if (m is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy phiên họp"); return; }
            if (!ChairCtl(m, c.User!)) { await HttpUtil.SendError(c.Res, 403, "Chỉ chủ trì/thư ký của phiên họp được khai mạc"); return; }
            var st = J.Str(m, "status");
            if (st is not ("draft" or "invited")) { await HttpUtil.SendError(c.Res, 400, "Phiên họp không ở trạng thái bắt đầu được"); return; }
            m["status"] = "live";
            var agenda = J.Arr(m, "agenda") ?? new JsonArray();
            var first = agenda.OfType<JsonObject>().FirstOrDefault();
            m["currentAgendaItemId"] = first is not null ? J.Str(first, "id") : null;
            await SaveDoc("c_meetings", J.Str(m, "id")!, m);
            var parts = J.Arr(m, "participants") ?? new JsonArray();
            var recips = parts.OfType<JsonObject>().Select(p => J.Str(p, "userId")).Where(x => x != null && x != c.User!.Sub).Select(x => x!);
            await NotifyUsers(recips, "Phiên họp bắt đầu", $"\"{J.Str(m, "title")}\" đã khai mạc. Mời đại biểu điểm danh và vào phòng họp.", "meeting", $"#/meetings/{J.Str(m, "id")}/live");
            await Audit(c.User!, "Bắt đầu phiên họp", $"Khai mạc \"{J.Str(m, "title")}\"");
            Changed("meetings", J.Str(m, "id")!);
            await HttpUtil.Send(c.Res, 200, m);
        });

        // ---------------- BẾ MẠC ----------------
        app.Add("POST", "/api/actions/meetings/:id/end", Auth.RequireAuth, async c =>
        {
            var m = await GetDoc("c_meetings", c.Params["id"]);
            if (m is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy phiên họp"); return; }
            if (!ChairCtl(m, c.User!)) { await HttpUtil.SendError(c.Res, 403, "Chỉ chủ trì/thư ký của phiên họp được kết thúc"); return; }
            if (J.Str(m, "status") != "live") { await HttpUtil.SendError(c.Res, 400, "Phiên họp không ở trạng thái đang diễn ra"); return; }
            m["status"] = "finished";
            await SaveDoc("c_meetings", J.Str(m, "id")!, m);
            await Audit(c.User!, "Kết thúc phiên họp", $"Bế mạc \"{J.Str(m, "title")}\"");
            Changed("meetings", J.Str(m, "id")!);
            await HttpUtil.Send(c.Res, 200, m);
        });

        // ---------------- KÝ SỐ BIÊN BẢN (CAS) ----------------
        app.Add("POST", "/api/actions/meetings/:id/sign", Auth.RequireAuth, async c =>
        {
            var m = await GetDoc("c_meetings", c.Params["id"]);
            if (m is null) { await HttpUtil.SendError(c.Res, 404, "Không tìm thấy phiên họp"); return; }
            if (J.Obj(m, "minutes") is null) { await HttpUtil.SendError(c.Res, 400, "Chưa có biên bản để ký"); return; }
            if (c.User!.Sub != J.Str(m, "chairId") && c.User.Sub != J.Str(m, "secretaryId"))
            { await HttpUtil.SendError(c.Res, 403, "Chỉ chủ trì hoặc thư ký của phiên họp được ký biên bản"); return; }
            var minutes0 = J.Obj(m, "minutes")!;
            var sigs0 = J.Arr(minutes0, "signatures") ?? new JsonArray();
            if (sigs0.OfType<JsonObject>().Any(s => J.Str(s, "signerId") == c.User.Sub))
            { await HttpUtil.SendError(c.Res, 400, "Bạn đã ký biên bản này"); return; }
            var body = await HttpUtil.ReadBodyObj(c.Req);
            var pin = J.Str(body, "pin") ?? "";
            if (!System.Text.RegularExpressions.Regex.IsMatch(pin, @"^\d{6}$"))
            { await HttpUtil.SendError(c.Res, 400, "Mã PIN chứng thư số phải gồm 6 chữ số"); return; }

            var signer = await GetDoc("c_users", c.User.Sub);
            var userId = c.User.Sub;
            var userName = c.User.Name;
            var result = await _store.MutateDocAsync("c_meetings", c.Params["id"], mm =>
            {
                var minutes = J.Obj(mm, "minutes");
                if (minutes is null) return MutateOutcome.Fail("Chưa có biên bản để ký", 400);
                if (userId != J.Str(mm, "chairId") && userId != J.Str(mm, "secretaryId"))
                    return MutateOutcome.Fail("Chỉ chủ trì hoặc thư ký của phiên họp được ký biên bản", 403);
                var sigs = J.Arr(minutes, "signatures");
                if (sigs is null) { sigs = new JsonArray(); minutes["signatures"] = sigs; }
                if (sigs.OfType<JsonObject>().Any(s => J.Str(s, "signerId") == userId))
                    return MutateOutcome.Fail("Bạn đã ký biên bản này", 400);
                var rndSerial = 1000 + RandomNumberGenerator.GetInt32(9000);
                var rndHex = Convert.ToHexString(RandomNumberGenerator.GetBytes(3)).ToLowerInvariant();
                sigs.Add(new JsonObject
                {
                    ["signerId"] = userId,
                    ["signerName"] = signer is not null ? (J.Str(signer, "fullName") ?? userName) : userName,
                    ["signerTitle"] = signer is not null ? (J.Str(signer, "title") ?? "") : "",
                    ["signedAt"] = NowIso(),
                    ["serial"] = $"VN-DEMO-CA:{rndSerial}:{rndHex}",
                    ["hash"] = Sha256Hex(J.Str(minutes, "content") ?? ""),
                });
                var chairId = J.Str(mm, "chairId");
                var secId = J.Str(mm, "secretaryId");
                minutes["locked"] = sigs.OfType<JsonObject>().Any(s => J.Str(s, "signerId") == chairId)
                    && sigs.OfType<JsonObject>().Any(s => J.Str(s, "signerId") == secId);
                return MutateOutcome.Replace(mm);
            });
            if (!result.Ok) { await SendMutateError(c, result, "Không tìm thấy phiên họp"); return; }
            var finalSigs = J.Arr(J.Obj(result.Data!, "minutes")!, "signatures")!;
            var sig = finalSigs.OfType<JsonObject>().First(s => J.Str(s, "signerId") == userId);
            await Audit(c.User!, "Ký số biên bản", $"Ký số biên bản \"{J.Str(result.Data!, "title")}\" (serial {J.Str(sig, "serial")})");
            Changed("meetings", c.Params["id"]);
            await HttpUtil.Send(c.Res, 200, sig);
        });
    }

    /// <summary>Định dạng ngày giờ kiểu vi-VN (toLocaleString('vi-VN')) cho nội dung thông báo.</summary>
    private static string FormatViDateTime(string? iso)
    {
        if (string.IsNullOrEmpty(iso)) return "";
        if (!DateTimeOffset.TryParse(iso, out var dt)) return iso;
        var vi = new System.Globalization.CultureInfo("vi-VN");
        return dt.LocalDateTime.ToString("g", vi);
    }
}
