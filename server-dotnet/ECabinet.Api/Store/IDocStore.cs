using System.Text.Json.Nodes;

namespace ECabinet.Api.Store;

/// <summary>Kết quả CAS của MutateDoc (port trả về của mutateDoc trong db.js).</summary>
public sealed class MutateResult
{
    public bool Ok { get; init; }
    public JsonObject? Data { get; init; }
    public string? Error { get; init; }
    public int? Status { get; init; }
    public string Reason { get; init; } = "";
    public bool Noop { get; init; }

    public static MutateResult NotFound() => new() { Ok = false, Reason = "not_found" };
    public static MutateResult Err(string error, int status) => new() { Ok = false, Reason = "error", Error = error, Status = status };
    public static MutateResult Conflict() => new() { Ok = false, Reason = "conflict", Status = 409, Error = "Hệ thống bận do nhiều thao tác đồng thời, vui lòng thử lại" };
    public static MutateResult NoopOk(JsonObject data) => new() { Ok = true, Data = data, Noop = true };
    public static MutateResult OkData(JsonObject data) => new() { Ok = true, Data = data };
}

/// <summary>
/// Kết quả của hàm mutate người dùng truyền vào MutateDoc:
///  - Next != null            -> object mới, ghi đè
///  - IsError                 -> lỗi nghiệp vụ, DỪNG ngay (không retry)
///  - Next == null && !IsError-> no-op (không đổi), coi như thành công
/// (tương đương { __error, __status } / object / null của Node)
/// </summary>
public readonly struct MutateOutcome
{
    public JsonObject? Next { get; }
    public bool IsError { get; }
    public string? ErrorMessage { get; }
    public int ErrorStatus { get; }

    private MutateOutcome(JsonObject? next, bool isError, string? msg, int status)
    { Next = next; IsError = isError; ErrorMessage = msg; ErrorStatus = status; }

    public static MutateOutcome Replace(JsonObject next) => new(next, false, null, 0);
    public static MutateOutcome NoChange() => new(null, false, null, 0);
    public static MutateOutcome Fail(string message, int status = 400) => new(null, true, message, status);
}

/// <summary>
/// Hợp đồng tầng lưu trữ (port db.js). Mỗi "table" là 1 bộ dữ liệu JSON
/// (id, data, updated_at). Users thêm cột username + password_hash.
/// SqlServerDocStore = MS SQL; InMemoryDocStore = dev/test (parity PGlite).
/// </summary>
public interface IDocStore
{
    Task InitAsync();

    // ---- CRUD JSON chung ----
    /// <summary>Tất cả bản ghi 1 bảng, sắp theo updated_at ASC rồi id ASC (như Node ORDER BY).</summary>
    Task<List<JsonObject>> GetAllAsync(string table);
    Task<JsonObject?> GetByIdAsync(string table, string id);
    Task InsertAsync(string table, string id, JsonObject data);
    Task UpdateAsync(string table, string id, JsonObject data);
    Task DeleteAsync(string table, string id);
    Task DeleteAllAsync(string table);

    /// <summary>CAS nguyên tử — port mutateDoc(table, id, mutate, retries=8).</summary>
    Task<MutateResult> MutateDocAsync(string table, string id, Func<JsonObject, MutateOutcome> mutate, int retries = 8);

    // ---- Users (cột riêng username + password_hash) ----
    /// <summary>Tìm user theo username (đã lowercase). Trả (data, passwordHash) hoặc null.</summary>
    Task<(JsonObject data, string? passwordHash)?> FindUserByUsernameAsync(string username);
    Task InsertUserAsync(string id, JsonObject data, string username, string passwordHash);
    /// <summary>Cập nhật user; nếu passwordHash != null thì đổi luôn mật khẩu.</summary>
    Task UpdateUserAsync(string id, JsonObject data, string username, string? passwordHash);
    Task<int> CountUsersAsync();

    // ---- Sessions (refresh token) ----
    Task InsertSessionAsync(string idHash, string userId, DateTime expiresAtUtc);
    /// <summary>Lấy phiên theo băm token (trả userId + expiresAt) hoặc null.</summary>
    Task<(string userId, DateTime expiresAtUtc)?> GetSessionAsync(string idHash);
    Task DeleteSessionAsync(string idHash);
    Task DeleteExpiredSessionsAsync();
    Task DeleteSessionsOfUserAsync(string userId);
}
