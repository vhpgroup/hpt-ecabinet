using System.Text.Json.Nodes;
using ECabinet.Api.Store;

namespace ECabinet.Api;

/// <summary>
/// Nạp dữ liệu mẫu (port seedIfEmpty của db.js). Đọc seed.json (sinh sẵn từ seed.mjs, DÙNG CHUNG
/// nội dung với frontend) rồi chèn vào store; users hash mật khẩu bằng Auth.HashPassword (PBKDF2).
/// Nạp theo THỨ TỰ Db.Ordered (users trước để CountUsers hoạt động).
/// </summary>
public static class Seed
{
    private static JsonObject? _cached;

    private static JsonObject Load()
    {
        if (_cached is not null) return _cached;
        var path = Path.Combine(AppContext.BaseDirectory, "seed.json");
        var text = File.ReadAllText(path);
        _cached = JsonNode.Parse(text) as JsonObject
            ?? throw new Exception("seed.json không hợp lệ");
        return _cached;
    }

    /// <summary>Nạp seed nếu store trống (force=true: xóa & nạp lại). Trả true nếu đã nạp. Port seedIfEmpty.</summary>
    public static async Task<bool> SeedIfEmpty(IDocStore store, bool force = false)
    {
        var count = await store.CountUsersAsync();
        if (!force && count > 0) return false;

        if (force)
            foreach (var (_, table) in Db.Ordered)
                await store.DeleteAllAsync(table);

        var seed = Load();
        foreach (var (col, table) in Db.Ordered)
        {
            var items = seed.TryGetPropertyValue(col, out var arrNode) && arrNode is JsonArray arr ? arr : new JsonArray();
            foreach (var itemNode in items)
            {
                if (itemNode is not JsonObject item) continue;
                var id = J.Str(item, "id") ?? Guid.NewGuid().ToString();
                if (col == "users")
                {
                    var password = J.Str(item, "password") ?? "123456";
                    var username = (J.Str(item, "username") ?? "").ToLowerInvariant();
                    var data = J.CloneObj(item);
                    data["password"] = ""; // KHÔNG lưu mật khẩu thô trong data
                    await store.InsertUserAsync(id, data, username, Auth.HashPassword(password));
                }
                else
                {
                    await store.InsertAsync(table, id, item);
                }
            }
        }
        return true;
    }
}
