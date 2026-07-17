namespace ECabinet.Api.Store;

/// <summary>
/// Ánh xạ bộ dữ liệu -> tên bảng (port COLLECTIONS của db.js). Giữ NGUYÊN thứ tự
/// để seed nạp đúng trình tự như Node (users trước để CountUsers hoạt động).
/// </summary>
public static class Db
{
    public const string C_Users = "c_users";

    /// <summary>collection (FE gọi) -> table. Thứ tự khớp db.js.</summary>
    public static readonly IReadOnlyList<(string Col, string Table)> Ordered = new[]
    {
        ("users", "c_users"),
        ("units", "c_units"),
        ("rooms", "c_rooms"),
        ("meetings", "c_meetings"),
        ("documents", "c_documents"),
        ("annotations", "c_annotations"),
        ("votes", "c_votes"),
        ("speakRequests", "c_speak_requests"),
        ("questions", "c_questions"),
        ("messages", "c_messages"),
        ("tasks", "c_tasks"),
        ("notifications", "c_notifications"),
        ("audit", "c_audit"),
        ("catalogs", "c_catalogs"),
        ("guides", "c_guides"),
        ("apiKeys", "c_apikeys"),
    };

    /// <summary>Tra bảng theo tên collection; null nếu không tồn tại.</summary>
    public static readonly IReadOnlyDictionary<string, string> Collections =
        Ordered.ToDictionary(x => x.Col, x => x.Table);

    public static string? TableOf(string collection)
        => Collections.TryGetValue(collection, out var t) ? t : null;
}
