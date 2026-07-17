using System.Text.Json.Nodes;

namespace ECabinet.Api.Store;

/// <summary>
/// Kho JSON trong bộ nhớ — parity chế độ PGlite của Node (không cần DATABASE_URL).
/// Dùng cho dev nhanh + toàn bộ test in-memory.
///
/// CAS (MutateDoc): khóa theo bảng + so sánh sâu data cũ (giống WHERE data = data_cũ của Postgres).
/// Mỗi bản ghi lưu kèm updated_at + seq (thứ tự chèn) để sắp xếp ổn định như ORDER BY updated_at, id.
/// Read/Write đều deep-clone để không rò tham chiếu (Postgres trả bản sao mới).
/// </summary>
public sealed class InMemoryDocStore : IDocStore
{
    private sealed class Row
    {
        public JsonObject Data = new();
        public DateTime UpdatedAt;
        public long Seq;
        public string? Username;      // chỉ dùng cho c_users
        public string? PasswordHash;  // chỉ dùng cho c_users
    }

    private sealed class Session
    {
        public string UserId = "";
        public DateTime ExpiresAt;
    }

    private readonly Dictionary<string, Dictionary<string, Row>> _tables = new();
    private readonly Dictionary<string, Session> _sessions = new();
    private readonly object _lock = new();
    private long _seq;

    public Task InitAsync()
    {
        lock (_lock)
        {
            foreach (var t in Db.Collections.Values)
                if (!_tables.ContainsKey(t)) _tables[t] = new Dictionary<string, Row>();
        }
        return Task.CompletedTask;
    }

    private Dictionary<string, Row> Table(string table)
    {
        if (!_tables.TryGetValue(table, out var t))
        {
            t = new Dictionary<string, Row>();
            _tables[table] = t;
        }
        return t;
    }

    public Task<List<JsonObject>> GetAllAsync(string table)
    {
        lock (_lock)
        {
            var rows = Table(table).Values
                .OrderBy(r => r.UpdatedAt)
                .ThenBy(r => r.Seq)
                .Select(r => J.CloneObj(r.Data))
                .ToList();
            return Task.FromResult(rows);
        }
    }

    public Task<JsonObject?> GetByIdAsync(string table, string id)
    {
        lock (_lock)
        {
            return Task.FromResult(Table(table).TryGetValue(id, out var r) ? J.CloneObj(r.Data) : null);
        }
    }

    public Task InsertAsync(string table, string id, JsonObject data)
    {
        lock (_lock)
        {
            var t = Table(table);
            if (t.ContainsKey(id)) throw new DuplicateKeyException();
            t[id] = new Row { Data = J.CloneObj(data), UpdatedAt = DateTime.UtcNow, Seq = ++_seq };
        }
        return Task.CompletedTask;
    }

    public Task UpdateAsync(string table, string id, JsonObject data)
    {
        lock (_lock)
        {
            var t = Table(table);
            if (t.TryGetValue(id, out var r))
            {
                r.Data = J.CloneObj(data);
                r.UpdatedAt = DateTime.UtcNow;
            }
        }
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string table, string id)
    {
        lock (_lock) { Table(table).Remove(id); }
        return Task.CompletedTask;
    }

    public Task DeleteAllAsync(string table)
    {
        lock (_lock) { Table(table).Clear(); }
        return Task.CompletedTask;
    }

    public Task<MutateResult> MutateDocAsync(string table, string id, Func<JsonObject, MutateOutcome> mutate, int retries = 8)
    {
        // Với kho in-memory, ta thực thi mutate DƯỚI khóa để mô phỏng CAS nguyên tử:
        // đọc data hiện tại -> mutate(bản sao) -> so sánh (không đổi) rồi ghi. Vì đang giữ khóa
        // nên không có ghi xen giữa; song vẫn giữ vòng lặp retries cho đúng hợp đồng.
        for (var attempt = 0; attempt < retries; attempt++)
        {
            JsonObject current;
            lock (_lock)
            {
                var t = Table(table);
                if (!t.TryGetValue(id, out var row)) return Task.FromResult(MutateResult.NotFound());
                current = J.CloneObj(row.Data);
                MutateOutcome outcome;
                try
                {
                    outcome = mutate(J.CloneObj(current));
                }
                catch (Exception e)
                {
                    return Task.FromResult(MutateResult.Err(e.Message ?? "Lỗi xử lý", 400));
                }
                if (outcome.IsError)
                    return Task.FromResult(MutateResult.Err(outcome.ErrorMessage ?? "Lỗi xử lý", outcome.ErrorStatus == 0 ? 400 : outcome.ErrorStatus));
                if (outcome.Next is null)
                    return Task.FromResult(MutateResult.NoopOk(current));

                // CAS: chỉ ghi nếu data CHƯA đổi kể từ lúc đọc (luôn đúng vì đang giữ khóa)
                if (J.DeepEquals(row.Data, current))
                {
                    row.Data = J.CloneObj(outcome.Next);
                    row.UpdatedAt = DateTime.UtcNow;
                    return Task.FromResult(MutateResult.OkData((JsonObject)J.DeepClone(outcome.Next)!));
                }
                // else: vòng lặp thử lại (thực tế không xảy ra trong in-memory có khóa)
            }
        }
        return Task.FromResult(MutateResult.Conflict());
    }

    // ---------------- Users ----------------
    public Task<(JsonObject data, string? passwordHash)?> FindUserByUsernameAsync(string username)
    {
        lock (_lock)
        {
            foreach (var r in Table(Db.C_Users).Values)
            {
                if (string.Equals(r.Username, username, StringComparison.Ordinal))
                    return Task.FromResult<(JsonObject, string?)?>((J.CloneObj(r.Data), r.PasswordHash));
            }
            return Task.FromResult<(JsonObject, string?)?>(null);
        }
    }

    public Task InsertUserAsync(string id, JsonObject data, string username, string passwordHash)
    {
        lock (_lock)
        {
            var t = Table(Db.C_Users);
            if (t.ContainsKey(id)) throw new DuplicateKeyException();
            // UNIQUE username
            if (t.Values.Any(r => string.Equals(r.Username, username, StringComparison.Ordinal)))
                throw new DuplicateKeyException();
            t[id] = new Row { Data = J.CloneObj(data), Username = username, PasswordHash = passwordHash, UpdatedAt = DateTime.UtcNow, Seq = ++_seq };
        }
        return Task.CompletedTask;
    }

    public Task UpdateUserAsync(string id, JsonObject data, string username, string? passwordHash)
    {
        lock (_lock)
        {
            var t = Table(Db.C_Users);
            if (t.TryGetValue(id, out var r))
            {
                // UNIQUE username (trừ chính bản ghi này)
                if (t.Any(kv => kv.Key != id && string.Equals(kv.Value.Username, username, StringComparison.Ordinal)))
                    throw new DuplicateKeyException();
                r.Data = J.CloneObj(data);
                r.Username = username;
                if (passwordHash != null) r.PasswordHash = passwordHash;
                r.UpdatedAt = DateTime.UtcNow;
            }
        }
        return Task.CompletedTask;
    }

    public Task<int> CountUsersAsync()
    {
        lock (_lock) { return Task.FromResult(Table(Db.C_Users).Count); }
    }

    // ---------------- Sessions ----------------
    public Task InsertSessionAsync(string idHash, string userId, DateTime expiresAtUtc)
    {
        lock (_lock) { _sessions[idHash] = new Session { UserId = userId, ExpiresAt = expiresAtUtc }; }
        return Task.CompletedTask;
    }

    public Task<(string userId, DateTime expiresAtUtc)?> GetSessionAsync(string idHash)
    {
        lock (_lock)
        {
            return Task.FromResult(_sessions.TryGetValue(idHash, out var s)
                ? ((string, DateTime)?)(s.UserId, s.ExpiresAt)
                : null);
        }
    }

    public Task DeleteSessionAsync(string idHash)
    {
        lock (_lock) { _sessions.Remove(idHash); }
        return Task.CompletedTask;
    }

    public Task DeleteExpiredSessionsAsync()
    {
        lock (_lock)
        {
            var now = DateTime.UtcNow;
            foreach (var k in _sessions.Where(kv => kv.Value.ExpiresAt < now).Select(kv => kv.Key).ToList())
                _sessions.Remove(k);
        }
        return Task.CompletedTask;
    }

    public Task DeleteSessionsOfUserAsync(string userId)
    {
        lock (_lock)
        {
            foreach (var k in _sessions.Where(kv => kv.Value.UserId == userId).Select(kv => kv.Key).ToList())
                _sessions.Remove(k);
        }
        return Task.CompletedTask;
    }
}

/// <summary>Ném khi trùng khóa (id hoặc username) — index.js bắt để trả 400 "đã tồn tại".</summary>
public sealed class DuplicateKeyException : Exception
{
    public DuplicateKeyException() : base("duplicate key") { }
}
