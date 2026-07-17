using System.Text.Json.Nodes;
using Microsoft.Data.SqlClient;

namespace ECabinet.Api.Store;

/// <summary>
/// Kho JSON trên MS SQL Server 2022 (port db.js sang SqlClient).
/// Mô hình: mỗi bộ dữ liệu 1 bảng (id NVARCHAR(64) PK, data NVARCHAR(MAX) CHECK ISJSON=1,
/// updated_at DATETIME2). c_users thêm username NVARCHAR UNIQUE + password_hash NVARCHAR.
/// Bảng c_sessions cho refresh token.
///
/// TẤT CẢ truy vấn đều tham số hóa (parameterized). Tên bảng lấy TỪ danh sách cố định
/// Db.Ordered (whitelist) — không ghép chuỗi từ đầu vào người dùng -> không SQL injection.
///
/// HẠN CHẾ: chưa chạy trên SQL Server thật trong sandbox (không có mssql). Test nghiệm thu
/// chạy trên InMemoryDocStore; lớp này được viết cẩn thận theo cú pháp SqlClient chuẩn.
/// </summary>
public sealed class SqlServerDocStore : IDocStore
{
    private readonly string _connString;

    public SqlServerDocStore(string connString) => _connString = connString;

    private async Task<SqlConnection> OpenAsync()
    {
        var conn = new SqlConnection(_connString);
        await conn.OpenAsync();
        return conn;
    }

    public async Task InitAsync()
    {
        // Chờ SQL Server sẵn sàng (compose khởi động song song) — thử tối đa 30 lần.
        for (var i = 0; i < 30; i++)
        {
            try
            {
                await using var conn = await OpenAsync();
                await using var cmd = new SqlCommand("SELECT 1", conn);
                await cmd.ExecuteScalarAsync();
                break;
            }
            catch when (i < 29)
            {
                await Task.Delay(2000);
            }
        }
        await MigrateAsync();
    }

    private async Task MigrateAsync()
    {
        await using var conn = await OpenAsync();
        foreach (var (_, table) in Db.Ordered)
        {
            var sql = $@"IF OBJECT_ID(N'{table}', N'U') IS NULL
CREATE TABLE {table} (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  data NVARCHAR(MAX) NOT NULL CHECK (ISJSON(data) = 1),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);";
            await Exec(conn, sql);
        }

        // c_users: thêm cột username + password_hash + unique index
        await Exec(conn, @"IF COL_LENGTH('c_users','username') IS NULL ALTER TABLE c_users ADD username NVARCHAR(128) NULL;");
        await Exec(conn, @"IF COL_LENGTH('c_users','password_hash') IS NULL ALTER TABLE c_users ADD password_hash NVARCHAR(400) NULL;");
        await Exec(conn, @"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_users_username' AND object_id=OBJECT_ID('c_users'))
CREATE UNIQUE INDEX idx_users_username ON c_users(username) WHERE username IS NOT NULL;");

        // c_sessions (refresh token)
        await Exec(conn, @"IF OBJECT_ID(N'c_sessions', N'U') IS NULL
CREATE TABLE c_sessions (
  id NVARCHAR(128) NOT NULL PRIMARY KEY,
  user_id NVARCHAR(64) NOT NULL,
  expires_at DATETIME2 NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);");
        await Exec(conn, @"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_sessions_user' AND object_id=OBJECT_ID('c_sessions'))
CREATE INDEX idx_sessions_user ON c_sessions(user_id);");
    }

    private static async Task Exec(SqlConnection conn, string sql, params (string, object?)[] ps)
    {
        await using var cmd = new SqlCommand(sql, conn);
        foreach (var (n, v) in ps) cmd.Parameters.AddWithValue(n, v ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<List<JsonObject>> GetAllAsync(string table)
    {
        var list = new List<JsonObject>();
        await using var conn = await OpenAsync();
        await using var cmd = new SqlCommand($"SELECT data FROM {table} ORDER BY updated_at ASC, id ASC", conn);
        await using var rd = await cmd.ExecuteReaderAsync();
        while (await rd.ReadAsync())
        {
            var node = J.Parse(rd.GetString(0));
            if (node is JsonObject o) list.Add(o);
        }
        return list;
    }

    public async Task<JsonObject?> GetByIdAsync(string table, string id)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new SqlCommand($"SELECT data FROM {table} WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("@id", id);
        var r = await cmd.ExecuteScalarAsync();
        return r is string s ? J.Parse(s) as JsonObject : null;
    }

    public async Task InsertAsync(string table, string id, JsonObject data)
    {
        await using var conn = await OpenAsync();
        try
        {
            await Exec(conn, $"INSERT INTO {table} (id, data) VALUES (@id, @data)",
                ("@id", id), ("@data", J.Stringify(data)));
        }
        catch (SqlException e) when (IsDuplicate(e)) { throw new DuplicateKeyException(); }
    }

    public async Task UpdateAsync(string table, string id, JsonObject data)
    {
        await using var conn = await OpenAsync();
        await Exec(conn, $"UPDATE {table} SET data = @data, updated_at = SYSUTCDATETIME() WHERE id = @id",
            ("@id", id), ("@data", J.Stringify(data)));
    }

    public async Task DeleteAsync(string table, string id)
    {
        await using var conn = await OpenAsync();
        await Exec(conn, $"DELETE FROM {table} WHERE id = @id", ("@id", id));
    }

    public async Task DeleteAllAsync(string table)
    {
        await using var conn = await OpenAsync();
        await Exec(conn, $"DELETE FROM {table}");
    }

    public async Task<MutateResult> MutateDocAsync(string table, string id, Func<JsonObject, MutateOutcome> mutate, int retries = 8)
    {
        await using var conn = await OpenAsync();
        for (var attempt = 0; attempt < retries; attempt++)
        {
            // đọc data hiện tại
            string? currentStr;
            await using (var sel = new SqlCommand($"SELECT data FROM {table} WHERE id = @id", conn))
            {
                sel.Parameters.AddWithValue("@id", id);
                currentStr = (await sel.ExecuteScalarAsync()) as string;
            }
            if (currentStr is null) return MutateResult.NotFound();
            if (J.Parse(currentStr) is not JsonObject current) return MutateResult.NotFound();

            MutateOutcome outcome;
            try { outcome = mutate(J.CloneObj(current)); }
            catch (Exception e) { return MutateResult.Err(e.Message ?? "Lỗi xử lý", 400); }

            if (outcome.IsError)
                return MutateResult.Err(outcome.ErrorMessage ?? "Lỗi xử lý", outcome.ErrorStatus == 0 ? 400 : outcome.ErrorStatus);
            if (outcome.Next is null) return MutateResult.NoopOk(current);

            // CAS: chỉ ghi nếu data CHƯA đổi kể từ lúc đọc (so khớp chuỗi JSON đang lưu)
            int affected;
            await using (var upd = new SqlCommand(
                $"UPDATE {table} SET data = @next, updated_at = SYSUTCDATETIME() WHERE id = @id AND data = @old", conn))
            {
                upd.Parameters.AddWithValue("@id", id);
                upd.Parameters.AddWithValue("@next", J.Stringify(outcome.Next));
                upd.Parameters.AddWithValue("@old", currentStr);
                affected = await upd.ExecuteNonQueryAsync();
            }
            if (affected == 1) return MutateResult.OkData((JsonObject)J.DeepClone(outcome.Next)!);
            // else: có ghi đồng thời -> đọc lại & thử lại
        }
        return MutateResult.Conflict();
    }

    // ---------------- Users ----------------
    public async Task<(JsonObject data, string? passwordHash)?> FindUserByUsernameAsync(string username)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new SqlCommand("SELECT data, password_hash FROM c_users WHERE username = @u", conn);
        cmd.Parameters.AddWithValue("@u", username);
        await using var rd = await cmd.ExecuteReaderAsync();
        if (!await rd.ReadAsync()) return null;
        var data = J.Parse(rd.GetString(0)) as JsonObject ?? new JsonObject();
        var hash = rd.IsDBNull(1) ? null : rd.GetString(1);
        return (data, hash);
    }

    public async Task InsertUserAsync(string id, JsonObject data, string username, string passwordHash)
    {
        await using var conn = await OpenAsync();
        try
        {
            await Exec(conn, "INSERT INTO c_users (id, data, username, password_hash) VALUES (@id, @data, @u, @h)",
                ("@id", id), ("@data", J.Stringify(data)), ("@u", username), ("@h", passwordHash));
        }
        catch (SqlException e) when (IsDuplicate(e)) { throw new DuplicateKeyException(); }
    }

    public async Task UpdateUserAsync(string id, JsonObject data, string username, string? passwordHash)
    {
        await using var conn = await OpenAsync();
        var sql = passwordHash != null
            ? "UPDATE c_users SET data = @data, username = @u, updated_at = SYSUTCDATETIME(), password_hash = @h WHERE id = @id"
            : "UPDATE c_users SET data = @data, username = @u, updated_at = SYSUTCDATETIME() WHERE id = @id";
        try
        {
            var ps = passwordHash != null
                ? new (string, object?)[] { ("@id", id), ("@data", J.Stringify(data)), ("@u", username), ("@h", passwordHash) }
                : new (string, object?)[] { ("@id", id), ("@data", J.Stringify(data)), ("@u", username) };
            await Exec(conn, sql, ps);
        }
        catch (SqlException e) when (IsDuplicate(e)) { throw new DuplicateKeyException(); }
    }

    public async Task<int> CountUsersAsync()
    {
        await using var conn = await OpenAsync();
        await using var cmd = new SqlCommand("SELECT COUNT(*) FROM c_users", conn);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    // ---------------- Sessions ----------------
    public async Task InsertSessionAsync(string idHash, string userId, DateTime expiresAtUtc)
    {
        await using var conn = await OpenAsync();
        await Exec(conn, "INSERT INTO c_sessions (id, user_id, expires_at) VALUES (@id, @uid, @exp)",
            ("@id", idHash), ("@uid", userId), ("@exp", expiresAtUtc));
    }

    public async Task<(string userId, DateTime expiresAtUtc)?> GetSessionAsync(string idHash)
    {
        await using var conn = await OpenAsync();
        await using var cmd = new SqlCommand("SELECT user_id, expires_at FROM c_sessions WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("@id", idHash);
        await using var rd = await cmd.ExecuteReaderAsync();
        if (!await rd.ReadAsync()) return null;
        return (rd.GetString(0), rd.GetDateTime(1));
    }

    public async Task DeleteSessionAsync(string idHash)
    {
        await using var conn = await OpenAsync();
        await Exec(conn, "DELETE FROM c_sessions WHERE id = @id", ("@id", idHash));
    }

    public async Task DeleteExpiredSessionsAsync()
    {
        await using var conn = await OpenAsync();
        await Exec(conn, "DELETE FROM c_sessions WHERE expires_at < SYSUTCDATETIME()");
    }

    public async Task DeleteSessionsOfUserAsync(string userId)
    {
        await using var conn = await OpenAsync();
        await Exec(conn, "DELETE FROM c_sessions WHERE user_id = @uid", ("@uid", userId));
    }

    /// <summary>Lỗi trùng khóa/UNIQUE của SQL Server: 2627 (PK/unique constraint), 2601 (unique index).</summary>
    private static bool IsDuplicate(SqlException e)
        => e.Number is 2627 or 2601 || e.Errors.Cast<SqlError>().Any(er => er.Number is 2627 or 2601);
}
