using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace ECabinet.Api;

/// <summary>1 mục mô tả endpoint API mở (port phần tử CATALOG của openapi.js).</summary>
public sealed record CatalogParam(string Name, string In, bool Required, string Type, string Description);
public sealed record CatalogEntry(string Id, string Method, string Path, string Summary, string Description,
    CatalogParam[] Params, string? Scope, int HsmtItem);

/// <summary>
/// DANH MỤC MÔ TẢ API MỞ + OPENAPI 3.0 (port openapi.js).
/// CATALOG dùng chung cho /spec và trang quản trị "Danh mục API".
/// buildOpenApiSpec(): object OpenAPI 3.0 tự sinh từ CATALOG + securitySchemes.
/// </summary>
public static class OpenApiCatalog
{
    public const string OpenApiVersion = "v1";
    public const string ServiceName = "ecabinet-open-api";

    public static readonly CatalogEntry[] Catalog =
    {
        new("unit-meetings-upcoming", "GET", "/api/open/v1/units/{unitId}/meetings/upcoming",
            "Danh sách cuộc họp của đơn vị sắp diễn ra",
            "Trả về các cuộc họp SẮP hoặc ĐANG diễn ra mà đơn vị chủ trì hoặc có thành phần tham dự thuộc đơn vị. Sắp xếp theo thời gian bắt đầu tăng dần. Có phân trang.",
            new[]
            {
                new CatalogParam("unitId", "path", true, "string", "Mã đơn vị"),
                new CatalogParam("page", "query", false, "integer", "Trang (mặc định 1)"),
                new CatalogParam("size", "query", false, "integer", "Số bản ghi/trang (mặc định 20, tối đa 100)"),
            }, "meetings", 54),
        new("user-meetings-upcoming", "GET", "/api/open/v1/users/{userId}/meetings/upcoming",
            "Danh sách cuộc họp của cá nhân sắp diễn ra",
            "Trả về các cuộc họp SẮP hoặc ĐANG diễn ra mà cá nhân (userId) là thành phần tham dự. Sắp xếp theo thời gian bắt đầu tăng dần. Có phân trang.",
            new[]
            {
                new CatalogParam("userId", "path", true, "string", "Mã người dùng"),
                new CatalogParam("page", "query", false, "integer", "Trang (mặc định 1)"),
                new CatalogParam("size", "query", false, "integer", "Số bản ghi/trang (mặc định 20, tối đa 100)"),
            }, "meetings", 55),
        new("unit-meetings-past", "GET", "/api/open/v1/units/{unitId}/meetings/past",
            "Danh sách cuộc họp của đơn vị đã diễn ra",
            "Trả về các cuộc họp ĐÃ kết thúc (hoặc đã qua thời gian) mà đơn vị chủ trì hoặc có thành phần tham dự thuộc đơn vị. Sắp xếp theo thời gian bắt đầu giảm dần (mới nhất trước). Có phân trang.",
            new[]
            {
                new CatalogParam("unitId", "path", true, "string", "Mã đơn vị"),
                new CatalogParam("page", "query", false, "integer", "Trang (mặc định 1)"),
                new CatalogParam("size", "query", false, "integer", "Số bản ghi/trang (mặc định 20, tối đa 100)"),
            }, "meetings", 56),
        new("user-meetings-past", "GET", "/api/open/v1/users/{userId}/meetings/past",
            "Danh sách cuộc họp của cá nhân đã diễn ra",
            "Trả về các cuộc họp ĐÃ kết thúc (hoặc đã qua thời gian) mà cá nhân (userId) là thành phần tham dự. Sắp xếp theo thời gian bắt đầu giảm dần (mới nhất trước). Có phân trang.",
            new[]
            {
                new CatalogParam("userId", "path", true, "string", "Mã người dùng"),
                new CatalogParam("page", "query", false, "integer", "Trang (mặc định 1)"),
                new CatalogParam("size", "query", false, "integer", "Số bản ghi/trang (mặc định 20, tối đa 100)"),
            }, "meetings", 57),
        new("meeting-detail", "GET", "/api/open/v1/meetings/{id}",
            "Lấy thông tin cuộc họp",
            "Thông tin đầy đủ của 1 cuộc họp: metadata + chương trình (agenda) + thành phần tham dự + thống kê biểu quyết tổng hợp. KHÔNG kèm biên bản, kết luận chi tiết hay phiếu biểu quyết cá nhân (dữ liệu nghị sự nhạy cảm).",
            new[] { new CatalogParam("id", "path", true, "string", "Mã cuộc họp") }, "meetings", 58),
        new("meeting-documents", "GET", "/api/open/v1/meetings/{id}/documents",
            "Danh sách tài liệu cuộc họp",
            "Danh sách tài liệu ĐÃ DUYỆT và KHÔNG MẬT của cuộc họp. Trả metadata + contentUrl để tải nội dung. Yêu cầu quyền (scope) \"documents\".",
            new[] { new CatalogParam("id", "path", true, "string", "Mã cuộc họp") }, "documents", 59),
        new("document-content", "GET", "/api/open/v1/documents/{id}/content",
            "Tải nội dung tài liệu",
            "Trả nội dung/dữ liệu (text hoặc dataUrl base64) của 1 tài liệu ĐÃ DUYỆT và KHÔNG MẬT. Yêu cầu quyền (scope) \"documents\".",
            new[] { new CatalogParam("id", "path", true, "string", "Mã tài liệu") }, "documents", 59),
        new("health", "GET", "/api/open/v1/health",
            "Kiểm tra tình trạng dịch vụ",
            "Trả {ok, service, version}. Dùng để LGSP thăm dò tình trạng dịch vụ. Vẫn yêu cầu khóa API hợp lệ.",
            Array.Empty<CatalogParam>(), "meetings", 58),
    };

    private static JsonObject MeetingItemSchema() => new()
    {
        ["type"] = "object",
        ["properties"] = new JsonObject
        {
            ["id"] = new JsonObject { ["type"] = "string" },
            ["title"] = new JsonObject { ["type"] = "string" },
            ["meetingType"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
            ["status"] = new JsonObject { ["type"] = "string", ["enum"] = new JsonArray("draft", "invited", "live", "finished", "cancelled") },
            ["startTime"] = new JsonObject { ["type"] = "string", ["format"] = "date-time" },
            ["endTime"] = new JsonObject { ["type"] = "string", ["format"] = "date-time" },
            ["room"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
            ["chairName"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
            ["hostUnit"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
            ["participantCount"] = new JsonObject { ["type"] = "integer" },
        },
    };

    private static JsonObject PageWrapper(JsonNode itemsSchema) => new()
    {
        ["type"] = "object",
        ["properties"] = new JsonObject
        {
            ["page"] = new JsonObject { ["type"] = "integer" },
            ["size"] = new JsonObject { ["type"] = "integer" },
            ["total"] = new JsonObject { ["type"] = "integer" },
            ["totalPages"] = new JsonObject { ["type"] = "integer" },
            ["items"] = new JsonObject { ["type"] = "array", ["items"] = itemsSchema },
        },
    };

    private static JsonObject Ref(string name) => new() { ["$ref"] = $"#/components/schemas/{name}" };

    /// <summary>Sinh object OpenAPI 3.0 từ CATALOG. Port buildOpenApiSpec.</summary>
    public static JsonObject BuildOpenApiSpec(string serverUrl = "/")
    {
        var paths = new JsonObject();
        foreach (var e in Catalog)
        {
            var parameters = new JsonArray();
            foreach (var p in e.Params)
                parameters.Add(new JsonObject
                {
                    ["name"] = p.Name,
                    ["in"] = p.In,
                    ["required"] = p.Required,
                    ["description"] = p.Description,
                    ["schema"] = new JsonObject { ["type"] = p.Type == "integer" ? "integer" : "string" },
                });

            JsonNode okSchema = e.Id switch
            {
                "health" => new JsonObject
                {
                    ["type"] = "object",
                    ["properties"] = new JsonObject
                    {
                        ["ok"] = new JsonObject { ["type"] = "boolean" },
                        ["service"] = new JsonObject { ["type"] = "string" },
                        ["version"] = new JsonObject { ["type"] = "string" },
                    },
                },
                "meeting-detail" => Ref("MeetingDetail"),
                "meeting-documents" => Ref("DocumentList"),
                "document-content" => Ref("DocumentContent"),
                _ => PageWrapper(MeetingItemSchema()),
            };

            var responses = new JsonObject
            {
                ["200"] = new JsonObject { ["description"] = "Thành công", ["content"] = new JsonObject { ["application/json"] = new JsonObject { ["schema"] = okSchema } } },
                ["401"] = new JsonObject { ["description"] = "Thiếu hoặc sai khóa API", ["content"] = new JsonObject { ["application/json"] = new JsonObject { ["schema"] = Ref("Error") } } },
                ["404"] = new JsonObject { ["description"] = "Không tìm thấy", ["content"] = new JsonObject { ["application/json"] = new JsonObject { ["schema"] = Ref("Error") } } },
            };
            if (e.Scope == "documents")
                responses["403"] = new JsonObject { ["description"] = "Khóa API không có quyền tài liệu", ["content"] = new JsonObject { ["application/json"] = new JsonObject { ["schema"] = Ref("Error") } } };

            var op = new JsonObject
            {
                ["operationId"] = Regex.Replace(e.Id, "-([a-z])", m => m.Groups[1].Value.ToUpperInvariant()),
                ["summary"] = e.Summary,
                ["description"] = $"{e.Description}\n\n(E-HSMT Hải Phòng — mục {e.HsmtItem})",
                ["tags"] = new JsonArray("eCabinet Open API"),
            };
            if (parameters.Count > 0) op["parameters"] = parameters;
            op["security"] = new JsonArray(new JsonObject { ["ApiKeyAuth"] = new JsonArray() });
            op["responses"] = responses;

            paths[e.Path] = new JsonObject { [e.Method.ToLowerInvariant()] = op };
        }

        return new JsonObject
        {
            ["openapi"] = "3.0.3",
            ["info"] = new JsonObject
            {
                ["title"] = "eCabinet — API công bố cho bên thứ 3",
                ["description"] = "Bộ API chia sẻ dữ liệu cuộc họp của Hệ thống phòng họp không giấy eCabinet, phục vụ tích hợp với các hệ thống khác của thành phố qua Nền tảng tích hợp và chia sẻ dữ liệu LGSP. Xác thực bằng khóa API qua header X-API-Key.",
                ["version"] = "1.0.0",
            },
            ["servers"] = new JsonArray(new JsonObject { ["url"] = TrimTrailingSlash(serverUrl) }),
            ["tags"] = new JsonArray(new JsonObject { ["name"] = "eCabinet Open API", ["description"] = "Tích hợp và chia sẻ dữ liệu cuộc họp (E-HSMT mục 54–59)" }),
            ["components"] = new JsonObject
            {
                ["securitySchemes"] = new JsonObject
                {
                    ["ApiKeyAuth"] = new JsonObject
                    {
                        ["type"] = "apiKey",
                        ["in"] = "header",
                        ["name"] = "X-API-Key",
                        ["description"] = "Khóa API dạng \"ecab_...\". Có thể gửi qua header \"X-API-Key: <key>\" hoặc \"Authorization: ApiKey <key>\".",
                    },
                },
                ["schemas"] = BuildSchemas(),
            },
            ["paths"] = paths,
        };
    }

    private static string TrimTrailingSlash(string s)
    {
        var t = Regex.Replace(s, "/+$", "");
        return string.IsNullOrEmpty(t) ? "/" : t;
    }

    private static JsonObject BuildSchemas() => new()
    {
        ["Error"] = new JsonObject { ["type"] = "object", ["properties"] = new JsonObject { ["error"] = new JsonObject { ["type"] = "string" } } },
        ["MeetingItem"] = MeetingItemSchema(),
        ["AgendaItem"] = new JsonObject
        {
            ["type"] = "object",
            ["properties"] = new JsonObject
            {
                ["id"] = new JsonObject { ["type"] = "string" },
                ["order"] = new JsonObject { ["type"] = "integer" },
                ["title"] = new JsonObject { ["type"] = "string" },
                ["durationMinutes"] = new JsonObject { ["type"] = "integer" },
                ["status"] = new JsonObject { ["type"] = "string", ["enum"] = new JsonArray("pending", "current", "done") },
            },
        },
        ["Participant"] = new JsonObject
        {
            ["type"] = "object",
            ["properties"] = new JsonObject
            {
                ["userId"] = new JsonObject { ["type"] = "string" },
                ["name"] = new JsonObject { ["type"] = "string" },
                ["unit"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
                ["role"] = new JsonObject { ["type"] = "string" },
                ["attendStatus"] = new JsonObject { ["type"] = "string" },
                ["checkedIn"] = new JsonObject { ["type"] = "boolean" },
            },
        },
        ["VoteSummary"] = new JsonObject
        {
            ["type"] = "object",
            ["properties"] = new JsonObject
            {
                ["total"] = new JsonObject { ["type"] = "integer", ["description"] = "Số nội dung biểu quyết" },
                ["open"] = new JsonObject { ["type"] = "integer" },
                ["closed"] = new JsonObject { ["type"] = "integer" },
                ["pending"] = new JsonObject { ["type"] = "integer" },
                ["items"] = new JsonObject
                {
                    ["type"] = "array",
                    ["items"] = new JsonObject
                    {
                        ["type"] = "object",
                        ["properties"] = new JsonObject
                        {
                            ["id"] = new JsonObject { ["type"] = "string" },
                            ["title"] = new JsonObject { ["type"] = "string" },
                            ["status"] = new JsonObject { ["type"] = "string" },
                            ["eligibleCount"] = new JsonObject { ["type"] = "integer" },
                            ["ballotCount"] = new JsonObject { ["type"] = "integer" },
                            ["outcome"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
                        },
                    },
                },
            },
        },
        ["MeetingDetail"] = new JsonObject
        {
            ["type"] = "object",
            ["properties"] = new JsonObject
            {
                ["id"] = new JsonObject { ["type"] = "string" },
                ["code"] = new JsonObject { ["type"] = "string" },
                ["title"] = new JsonObject { ["type"] = "string" },
                ["description"] = new JsonObject { ["type"] = "string" },
                ["meetingType"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
                ["status"] = new JsonObject { ["type"] = "string" },
                ["startTime"] = new JsonObject { ["type"] = "string", ["format"] = "date-time" },
                ["endTime"] = new JsonObject { ["type"] = "string", ["format"] = "date-time" },
                ["room"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
                ["isOnline"] = new JsonObject { ["type"] = "boolean" },
                ["chairName"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
                ["secretaryName"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
                ["hostUnit"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
                ["agenda"] = new JsonObject { ["type"] = "array", ["items"] = Ref("AgendaItem") },
                ["participants"] = new JsonObject { ["type"] = "array", ["items"] = Ref("Participant") },
                ["voteSummary"] = Ref("VoteSummary"),
            },
        },
        ["DocumentMeta"] = new JsonObject
        {
            ["type"] = "object",
            ["properties"] = new JsonObject
            {
                ["id"] = new JsonObject { ["type"] = "string" },
                ["name"] = new JsonObject { ["type"] = "string" },
                ["kind"] = new JsonObject { ["type"] = "string" },
                ["agendaItemId"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
                ["issuingBody"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
                ["version"] = new JsonObject { ["type"] = "integer" },
                ["size"] = new JsonObject { ["type"] = "integer", ["nullable"] = true },
                ["mime"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
                ["contentUrl"] = new JsonObject { ["type"] = "string" },
            },
        },
        ["DocumentList"] = new JsonObject
        {
            ["type"] = "object",
            ["properties"] = new JsonObject
            {
                ["meetingId"] = new JsonObject { ["type"] = "string" },
                ["total"] = new JsonObject { ["type"] = "integer" },
                ["items"] = new JsonObject { ["type"] = "array", ["items"] = Ref("DocumentMeta") },
            },
        },
        ["DocumentContent"] = new JsonObject
        {
            ["type"] = "object",
            ["properties"] = new JsonObject
            {
                ["id"] = new JsonObject { ["type"] = "string" },
                ["name"] = new JsonObject { ["type"] = "string" },
                ["mime"] = new JsonObject { ["type"] = "string", ["nullable"] = true },
                ["content"] = new JsonObject { ["type"] = "string", ["nullable"] = true, ["description"] = "Nội dung văn bản (nếu là tài liệu soạn trực tiếp)" },
                ["dataUrl"] = new JsonObject { ["type"] = "string", ["nullable"] = true, ["description"] = "Dữ liệu tệp base64 (nếu là tệp tải lên)" },
            },
        },
    };
}
