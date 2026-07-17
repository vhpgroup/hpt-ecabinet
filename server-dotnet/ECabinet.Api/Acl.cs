using System.Text.Json.Nodes;

namespace ECabinet.Api;

/// <summary>Bộ ba rule create/update/remove cho 1 bộ dữ liệu.</summary>
public sealed record AclRule(string Create, string Update, string Remove);

/// <summary>
/// MA TRẬN PHÂN QUYỀN (ACL) + hàm Allowed() — port acl.js 1:1.
///
/// Quy ước rule (chuỗi; danh sách vai trò mã hóa "roles:a,b,c"):
///   "any"             : mọi người dùng đã đăng nhập
///   "roles:a,b"       : vai trò trong danh sách
///   "none"            : cấm qua API chung (phải qua endpoint nghiệp vụ)
///   "adminOrSelf"     : admin hoặc chính chủ (users)
///   "adminOrSelfOrUnitAdmin" : admin | chính chủ | unit_admin
///   "ownerOrManage"   : chủ sở hữu (ownerId) hoặc admin/thư ký/chủ trì
///   "assigneeOrManage": người được giao (assigneeId) hoặc quản lý
///   "owner:&lt;field&gt;"  : bản ghi có &lt;field&gt; === user hiện tại
///   "ownerOrManage:&lt;field&gt;" : bản ghi có &lt;field&gt; === user hiện tại HOẶC quản lý
///   "self:&lt;field&gt;"   : dữ liệu gửi lên có &lt;field&gt; === user hiện tại
/// </summary>
public static class Acl
{
    public static readonly string[] Manage = { "admin", "secretary", "chairman" };
    private const string M = "roles:admin,secretary,chairman";

    public static readonly IReadOnlyDictionary<string, AclRule> Rules = new Dictionary<string, AclRule>
    {
        ["users"]         = new("roles:admin,unit_admin", "adminOrSelfOrUnitAdmin", "roles:admin"),
        ["units"]         = new("roles:admin", "roles:admin", "roles:admin"),
        ["rooms"]         = new("roles:admin", "roles:admin", "roles:admin"),
        // P0-2 (HSMT dòng 354-355): "Quản trị đơn vị" là actor CHÍNH tạo phiên họp — thêm
        // unit_admin vào quyền tạo. Kiểm tra sâu (chairId/secretaryId PHẢI thuộc đơn vị
        // unit_admin) nằm ở App.EnforceMeetingWrite(). update/remove GIỮ NGUYÊN.
        ["meetings"]      = new("roles:admin,secretary,chairman,unit_admin", "any", M),
        ["documents"]     = new("any", "ownerOrManage", "ownerOrManage"),
        ["annotations"]   = new("self:userId", "owner:userId", "owner:userId"),
        ["votes"]         = new(M, "any", M),
        ["speakRequests"] = new("self:userId", "any", "any"),
        ["questions"]     = new("self:userId", "any", "ownerOrManage:userId"),
        ["messages"]      = new("self:fromId", "none", "none"),
        ["tasks"]         = new(M, "assigneeOrManage", M),
        ["notifications"] = new("any", "owner:userId", "owner:userId"),
        ["audit"]         = new("any", "none", "roles:admin"),
        ["catalogs"]      = new("roles:admin", "roles:admin", "roles:admin"),
        ["guides"]        = new("roles:admin", "roles:admin", "roles:admin"),
        ["apiKeys"]       = new("none", "roles:admin", "roles:admin"),
        // P1-6 — Phản hồi/góp ý người dùng: bất kỳ ai đăng nhập tạo được (server ép
        // userId/unitId — xem App.cs). update = 'any' vì Guard.GuardFeedbacks siết field
        // theo vai trò (cùng triết lý votes/meetings/questions: ACL lỏng, GUARD siết field).
        ["feedbacks"]     = new("any", "any", "roles:admin"),
    };

    /// <summary>Kiểm quyền theo rule + ngữ cảnh. existing/body là JsonObject (có thể null). Port allowed().</summary>
    public static bool Allowed(string rule, JwtPayload user, JsonObject? existing, JsonObject? body)
    {
        var sub = user.Sub;
        var role = user.Role;

        if (rule == "any") return true;
        if (rule == "none") return false;
        if (rule.StartsWith("roles:"))
        {
            var roles = rule.Substring(6).Split(',');
            return roles.Contains(role);
        }
        if (rule == "adminOrSelf") return role == "admin" || J.Str(existing, "id") == sub;
        if (rule == "adminOrSelfOrUnitAdmin") return role == "admin" || J.Str(existing, "id") == sub || role == "unit_admin";
        if (rule == "ownerOrManage") return Manage.Contains(role) || J.Str(existing, "ownerId") == sub;
        if (rule == "assigneeOrManage") return Manage.Contains(role) || J.Str(existing, "assigneeId") == sub;
        if (rule.StartsWith("ownerOrManage:")) return Manage.Contains(role) || J.Str(existing, rule.Substring(14)) == sub;
        if (rule.StartsWith("owner:")) return J.Str(existing, rule.Substring(6)) == sub;
        if (rule.StartsWith("self:")) return J.Str(body, rule.Substring(5)) == sub;
        return false;
    }
}
