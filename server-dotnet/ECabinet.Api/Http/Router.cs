using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;

namespace ECabinet.Api.Http;

/// <summary>
/// Ngữ cảnh 1 request đã khớp route (port req.params / req.query / req.user của Node).
/// Handler đọc/ghi qua đây; middleware xác thực gắn User.
/// </summary>
public sealed class Ctx
{
    public required HttpContext Http { get; init; }
    public HttpRequest Req => Http.Request;
    public HttpResponse Res => Http.Response;

    /// <summary>Tham số path đã decode (vd :collection, :id).</summary>
    public Dictionary<string, string> Params { get; } = new();
    public IQueryCollection Query => Req.Query;

    /// <summary>Payload JWT sau requireAuth ({ sub, role, name, iat, exp }). null nếu chưa xác thực.</summary>
    public JwtPayload? User { get; set; }

    public string Method => Req.Method;
    public string Path => Req.Path.Value ?? "/";

    /// <summary>Đã gửi phản hồi chưa (tương đương res.writableEnded của Node).</summary>
    public bool Ended => Res.HasStarted;
}

/// <summary>Handler middleware — chạy tuần tự, dừng khi response đã kết thúc (port handler(req,res) của Node).</summary>
public delegate Task Handler(Ctx c);

/// <summary>
/// Router tối giản — port router.js. Cú pháp path kiểu '/api/:collection/:id'.
/// Handler chạy tuần tự; dừng khi response đã ghi. KHỚP THEO THỨ TỰ ĐĂNG KÝ
/// (route đăng ký trước được thử trước) — bắt buộc để open/apikeys/rtc/auth/actions
/// đứng TRƯỚC CRUD chung /api/:collection.
/// </summary>
public sealed class Router
{
    private sealed class Route
    {
        public required string Method;
        public required Regex Pattern;
        public required List<string> Keys;
        public required Handler[] Handlers;
    }

    private readonly List<Route> _routes = new();

    public void Add(string method, string path, params Handler[] handlers)
    {
        var keys = new List<string>();
        // :param -> nhóm bắt ([^/]+); thêm '/?' cuối + neo ^...$ (giống router.js)
        var regex = "^" + Regex.Replace(path, ":[^/]+", m =>
        {
            keys.Add(m.Value.Substring(1));
            return "([^/]+)";
        }) + "/?$";
        _routes.Add(new Route
        {
            Method = method,
            Pattern = new Regex(regex, RegexOptions.Compiled),
            Keys = keys,
            Handlers = handlers,
        });
    }

    /// <summary>
    /// Xử lý 1 request. Trả về true nếu đã khớp 1 route (kể cả OPTIONS), false nếu không route nào khớp
    /// (caller gửi 404 "Không tìm thấy endpoint" — port cuối handle() của Node).
    /// </summary>
    public async Task<bool> Handle(Ctx c)
    {
        // OPTIONS: preflight CORS -> 204 (port đầu handle()). CORS header do Program áp ở tầng ngoài.
        if (c.Method == "OPTIONS")
        {
            await HttpUtil.Send(c.Res, 204);
            return true;
        }

        var pathname = c.Path;
        foreach (var r in _routes)
        {
            if (r.Method != c.Method) continue;
            var m = r.Pattern.Match(pathname);
            if (!m.Success) continue;

            c.Params.Clear();
            for (var i = 0; i < r.Keys.Count; i++)
                c.Params[r.Keys[i]] = Uri.UnescapeDataString(m.Groups[i + 1].Value);

            try
            {
                foreach (var h in r.Handlers)
                {
                    await h(c);
                    if (c.Ended) break;
                }
                if (!c.Ended)
                    await HttpUtil.Send(c.Res, 500, new System.Text.Json.Nodes.JsonObject { ["error"] = "Handler không trả về phản hồi" });
            }
            catch (HttpError he)
            {
                await HttpUtil.SendError(c.Res, he.Status, he.Message);
            }
            catch (Exception e)
            {
                await HttpUtil.SendError(c.Res, 500, e.Message ?? "Lỗi máy chủ");
            }
            return true;
        }
        return false;
    }
}
