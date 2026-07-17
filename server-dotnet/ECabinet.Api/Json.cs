using System.Text.Json;
using System.Text.Json.Nodes;

namespace ECabinet.Api;

/// <summary>
/// Tiện ích JSON schemaless (dữ liệu giống Node — không POCO từng entity).
/// Dùng System.Text.Json JsonNode/JsonObject xuyên suốt.
///
/// LƯU Ý ngữ nghĩa JS mà ta phải mô phỏng:
///  - "undefined" (JS) == khóa KHÔNG tồn tại trong JsonObject (ContainsKey == false).
///  - "null" (JS)      == khóa tồn tại với giá trị JsonValue null (node == null nhưng ContainsKey == true).
/// Nhiều nhánh guard/validate của Node phân biệt rõ hai trạng thái này (vd `body.role !== undefined`).
/// </summary>
public static class J
{
    public static readonly JsonSerializerOptions Opts = new()
    {
        // Giữ nguyên Unicode tiếng Việt (không escape) — parity với Node JSON.stringify
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        WriteIndented = false,
    };

    /// <summary>Parse chuỗi JSON thành JsonNode (null nếu rỗng).</summary>
    public static JsonNode? Parse(string? s)
    {
        if (string.IsNullOrEmpty(s)) return null;
        return JsonNode.Parse(s);
    }

    /// <summary>Serialize JsonNode -> chuỗi (giống JSON.stringify Node, không format).</summary>
    public static string Stringify(JsonNode? node) => node?.ToJsonString(Opts) ?? "null";

    /// <summary>Sao chép sâu 1 node (JSON.parse(JSON.stringify(x)) của Node).</summary>
    public static JsonNode? DeepClone(JsonNode? node)
    {
        if (node is null) return null;
        return JsonNode.Parse(node.ToJsonString());
    }

    public static JsonObject CloneObj(JsonObject o) => (JsonObject)DeepClone(o)!;

    /// <summary>
    /// So khớp NGỮ NGHĨA hai node JSON (không phụ thuộc thứ tự khóa object) — dùng cho CAS
    /// (tương đương so sánh jsonb = jsonb của Postgres trong Node).
    /// </summary>
    public static bool DeepEquals(JsonNode? a, JsonNode? b)
    {
        if (a is null && b is null) return true;
        if (a is null || b is null) return false;
        return NodeEquals(a, b);
    }

    private static bool NodeEquals(JsonNode? a, JsonNode? b)
    {
        if (a is null && b is null) return true;
        if (a is null || b is null) return false;

        switch (a)
        {
            case JsonObject oa when b is JsonObject ob:
                if (oa.Count != ob.Count) return false;
                foreach (var kv in oa)
                {
                    if (!ob.TryGetPropertyValue(kv.Key, out var bv)) return false;
                    if (!NodeEquals(kv.Value, bv)) return false;
                }
                return true;
            case JsonArray aa when b is JsonArray ab:
                if (aa.Count != ab.Count) return false;
                for (var i = 0; i < aa.Count; i++)
                    if (!NodeEquals(aa[i], ab[i])) return false;
                return true;
            case JsonValue va when b is JsonValue vb:
                return ValueEquals(va, vb);
            default:
                return false;
        }
    }

    private static bool ValueEquals(JsonValue a, JsonValue b)
    {
        // So sánh theo kiểu JSON nguyên thủy. Số so bằng decimal/double để 1 == 1.0.
        if (a.TryGetValue<bool>(out var ba) && b.TryGetValue<bool>(out var bb)) return ba == bb;

        var an = a.GetValue<JsonElement>();
        var bn = b.GetValue<JsonElement>();
        if (an.ValueKind != bn.ValueKind)
        {
            // number có thể ra dưới nhiều dạng — thử so bằng double
            if (IsNum(an) && IsNum(bn)) return NumEq(an, bn);
            return false;
        }
        return an.ValueKind switch
        {
            JsonValueKind.String => an.GetString() == bn.GetString(),
            JsonValueKind.Number => NumEq(an, bn),
            JsonValueKind.True or JsonValueKind.False => an.ValueKind == bn.ValueKind,
            JsonValueKind.Null => true,
            _ => an.GetRawText() == bn.GetRawText(),
        };
    }

    private static bool IsNum(JsonElement e) => e.ValueKind == JsonValueKind.Number;
    private static bool NumEq(JsonElement a, JsonElement b)
        => a.TryGetDouble(out var da) && b.TryGetDouble(out var db) && da == db;

    // ---------------- Accessor an toàn (ngữ nghĩa JS) ----------------

    /// <summary>Khóa có tồn tại không (khác undefined của JS).</summary>
    public static bool Has(JsonObject o, string key) => o.ContainsKey(key);

    /// <summary>Lấy chuỗi (null nếu thiếu / không phải chuỗi).</summary>
    public static string? Str(JsonNode? node)
    {
        if (node is JsonValue v && v.TryGetValue<string>(out var s)) return s;
        return null;
    }

    public static string? Str(JsonObject? o, string key)
    {
        if (o is null) return null;
        return o.TryGetPropertyValue(key, out var n) ? Str(n) : null;
    }

    /// <summary>Lấy bool (null nếu thiếu/không phải bool).</summary>
    public static bool? Bool(JsonObject? o, string key)
    {
        if (o is null || !o.TryGetPropertyValue(key, out var n) || n is not JsonValue v) return null;
        return v.TryGetValue<bool>(out var b) ? b : (bool?)null;
    }

    public static bool BoolOr(JsonObject? o, string key, bool fallback) => Bool(o, key) ?? fallback;

    /// <summary>Lấy số (double) — null nếu thiếu/không phải số hữu hạn.</summary>
    public static double? Num(JsonObject? o, string key)
    {
        if (o is null || !o.TryGetPropertyValue(key, out var n) || n is not JsonValue v) return null;
        if (v.TryGetValue<double>(out var d) && double.IsFinite(d)) return d;
        return null;
    }

    public static JsonArray? Arr(JsonObject? o, string key)
    {
        if (o is null || !o.TryGetPropertyValue(key, out var n)) return null;
        return n as JsonArray;
    }

    public static JsonObject? Obj(JsonObject? o, string key)
    {
        if (o is null || !o.TryGetPropertyValue(key, out var n)) return null;
        return n as JsonObject;
    }

    /// <summary>Tạo JsonObject từ cặp khóa-giá trị (tiện dựng response).</summary>
    public static JsonObject O(params (string, JsonNode?)[] pairs)
    {
        var o = new JsonObject();
        foreach (var (k, v) in pairs) o[k] = v;
        return o;
    }

    /// <summary>Merge nông: ghi đè các khóa của patch lên bản sao của baseObj (giống {...a, ...b}).</summary>
    public static JsonObject ShallowMerge(JsonObject baseObj, JsonObject patch)
    {
        var outp = CloneObj(baseObj);
        foreach (var kv in patch)
            outp[kv.Key] = DeepClone(kv.Value);
        return outp;
    }
}
