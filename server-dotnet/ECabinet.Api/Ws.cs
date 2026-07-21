using System.Net.WebSockets;
using System.Text;
using System.Text.Json.Nodes;
using System.Collections.Concurrent;
using Microsoft.AspNetCore.Http;

namespace ECabinet.Api;

/// <summary>
/// REALTIME — WebSocket đẩy sự kiện (port ws.js). Dùng WebSocket tích hợp của ASP.NET Core
/// (không cần tự bắt tay RFC 6455 như Node) nhưng GIỮ NGUYÊN HỢP ĐỒNG với frontend:
///  - Đường kết nối: /api/realtime (khớp attachRealtime(server,'/api/realtime') + realtimePath của FE).
///  - Xác thực: JWT qua query ?token=... tại thời điểm nâng cấp; sai/thiếu -> 401 (không nâng cấp).
///  - Mô hình poke-then-pull: server chỉ báo {type:'change',collection,action,id,at}; FE tự refresh REST.
///  - Gửi 'hello' ngay sau khi kết nối (parity với ws.js).
///  - clientCount() phục vụ /health.
/// </summary>
public static class Realtime
{
    private sealed class Client
    {
        public required WebSocket Socket;
        public required JwtPayload User;
    }

    private static readonly ConcurrentDictionary<Guid, Client> _clients = new();

    public static int ClientCount => _clients.Count;

    /// <summary>
    /// SCALE NGANG (App×2 sau LB): backplane Redis (nếu bật). Đặt 1 lần lúc boot qua
    /// SetBackplane. Null hoặc chưa Up -> phát LOCAL như cũ (tương thích ngược tuyệt đối).
    /// </summary>
    private static ECabinet.Api.Store.IRedisBackplane? _backplane;
    public static void SetBackplane(ECabinet.Api.Store.IRedisBackplane? bp) => _backplane = bp;

    /// <summary>
    /// Phát 1 sự kiện tới toàn bộ client WS TRÊN TIẾN TRÌNH NÀY (local). Đường phát LOCAL
    /// thuần — KHÔNG biết Redis. 1 instance (mặc định) -> NotifyChange gọi thẳng hàm này
    /// (hành vi cũ). Khi bật backplane, handler nhận message từ kênh chung gọi FanoutLocal
    /// -> mỗi instance fanout đúng 1 lần cho client của mình (chống double-send).
    /// </summary>
    public static void FanoutLocal(JsonObject ev)
    {
        if (_clients.IsEmpty) return;
        var bytes = Encoding.UTF8.GetBytes(J.Stringify(ev));
        foreach (var kv in _clients)
        {
            var c = kv.Value;
            if (c.Socket.State != WebSocketState.Open) continue;
            // gửi không chờ (không chặn luồng ghi CRUD); lỗi -> gỡ client
            _ = SendAsync(kv.Key, c, bytes);
        }
    }

    /// <summary>TƯƠNG THÍCH NGƯỢC: giữ tên Broadcast (đường phát local) — bí danh FanoutLocal.</summary>
    public static void Broadcast(JsonObject ev) => FanoutLocal(ev);

    private static async Task SendAsync(Guid id, Client c, byte[] bytes)
    {
        try
        {
            await c.Socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
        }
        catch
        {
            _clients.TryRemove(id, out _);
        }
    }

    /// <summary>
    /// Tiện dựng + phát sự kiện 'change' (port notifyChange / changed).
    ///
    /// SCALE NGANG: backplane BẬT -> CHỈ PUBLISH lên kênh `ecabinet:changes` (KHÔNG gửi
    /// local trực tiếp); mọi instance SUBSCRIBE nhận lại rồi FanoutLocal đúng 1 lần cho
    /// client của mình -> chống double-send + client nối instance khác vẫn nhận. Backplane
    /// TẮT hoặc PUBLISH lỗi -> fallback FanoutLocal như cũ. Fire-and-forget (poke-then-pull).
    /// </summary>
    public static void NotifyChange(string collection, string action, string id)
    {
        var ev = new JsonObject
        {
            ["type"] = "change",
            ["collection"] = collection,
            ["action"] = action,
            ["id"] = id,
            ["at"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
        };
        var bp = _backplane;
        if (bp is not null && bp.Up)
        {
            _ = bp.PublishChangeAsync(ev).ContinueWith(t =>
            {
                // publish=false (Redis rớt ngay lúc phát) -> fallback local (không mất realtime local)
                if (!t.IsFaulted && t.Result == false) FanoutLocal(ev);
            });
        }
        else FanoutLocal(ev); // đường cũ (1 instance / Redis tắt) — hành vi Y HỆT
    }

    /// <summary>
    /// Middleware nâng cấp WebSocket. Trả true nếu đã xử lý (đúng path), false để chuyển tiếp.
    /// Gọi TRƯỚC router trong pipeline.
    /// </summary>
    public static async Task<bool> TryHandle(HttpContext ctx, string path = "/api/realtime")
    {
        if (!ctx.WebSockets.IsWebSocketRequest) return false;
        if (ctx.Request.Path != path)
        {
            // path sai cho yêu cầu WS -> đóng (parity: Node destroy socket)
            ctx.Response.StatusCode = 400;
            return true;
        }

        var token = ctx.Request.Query["token"].FirstOrDefault();
        var payload = Auth.VerifyToken(token);
        if (payload is null)
        {
            ctx.Response.StatusCode = 401; // chưa nâng cấp -> 401 (parity 'HTTP/1.1 401')
            return true;
        }

        using var socket = await ctx.WebSockets.AcceptWebSocketAsync();
        var id = Guid.NewGuid();
        var client = new Client { Socket = socket, User = payload };
        _clients[id] = client;

        // gửi 'hello' ngay (parity ws.js)
        try
        {
            var hello = new JsonObject
            {
                ["type"] = "hello",
                ["name"] = payload.Name,
                ["at"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            };
            await socket.SendAsync(Encoding.UTF8.GetBytes(J.Stringify(hello)), WebSocketMessageType.Text, true, CancellationToken.None);

            // vòng nhận: kênh này chỉ đẩy xuống; đọc để phát hiện close từ client
            var buffer = new byte[4096];
            while (socket.State == WebSocketState.Open)
            {
                var result = await socket.ReceiveAsync(buffer, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
                    break;
                }
                // dữ liệu client gửi lên: bỏ qua (poke-then-pull)
            }
        }
        catch { /* client rớt */ }
        finally { _clients.TryRemove(id, out _); }

        return true;
    }

    /// <summary>Đóng toàn bộ client (dùng dọn dẹp test).</summary>
    public static void ClearForTests() => _clients.Clear();
}
