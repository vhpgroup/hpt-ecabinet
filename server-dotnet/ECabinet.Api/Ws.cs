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

    /// <summary>Phát 1 sự kiện tới toàn bộ client (fire-and-forget). Port broadcast().</summary>
    public static void Broadcast(JsonObject ev)
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
    /// </summary>
    public static void NotifyChange(string collection, string action, string id)
        => Broadcast(new JsonObject
        {
            ["type"] = "change",
            ["collection"] = collection,
            ["action"] = action,
            ["id"] = id,
            ["at"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
        });

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
