// ============================================================
// eCabinet API Server (.NET 8) — entrypoint.
// Port index.js: dựng app (App.BuildAsync) rồi listen trên mọi interface:PORT
// (mặc định 3000) để nginx 'web' proxy sang api:3000 không đổi.
//
// Vá P2-3 (QA 18/07): trước đây ép "http://0.0.0.0:{port}" — CHỈ bind IPv4, bỏ lỡ
// mọi client kết nối qua IPv6 (kể cả loopback IPv6 "::1" khi công cụ health-check/
// một số reverse proxy dùng IPv6 nội bộ). Node (server/src/index.js dòng 542,
// `server.listen(PORT, cb)` KHÔNG truyền host) đã dual-stack sẵn theo mặc định của
// Node — .NET lệch hành vi so với Node cùng contract. Sửa: bind "http://[::]:{port}"
// — Kestrel/OS hiện đại (Linux/Windows) mặc định "dual-mode" khi listen trên địa chỉ
// IPv6Any ("::"), tức TỰ ĐỘNG nhận cả kết nối IPv4 (ánh xạ qua ::ffff:0:0/96) — giữ
// nguyên khả năng nhận IPv4 như hành vi cũ, KHÔNG cần đổi gì ở nginx/Caddy phía trước.
// An toàn dự phòng: một số môi trường container/host tắt hẳn IPv6 ở tầng OS (AF_INET6
// không khả dụng) — Kestrel bind "[::]" trên môi trường đó có thể lỗi lúc khởi động.
// Đặt env BIND_IPV4_ONLY=1 để ép quay lại "0.0.0.0" (hành vi cũ, chỉ IPv4) khi cần.
// ============================================================
using ECabinet.Api;

var port = Env.GetInt("PORT", 3000);
var ipv4Only = Env.GetOr("BIND_IPV4_ONLY", "0") is "1" or "true";
var bindHost = ipv4Only ? "0.0.0.0" : "[::]";
Environment.SetEnvironmentVariable("ASPNETCORE_URLS", $"http://{bindHost}:{port}");

var app = await App.BuildAsync(args);

var displayHost = ipv4Only ? "0.0.0.0" : "[::]";
Console.WriteLine($"[server] eCabinet API (.NET) chạy tại http://{displayHost}:{port} — {ECabinet.Api.Store.Db.Ordered.Count} bộ dữ liệu"
    + (ipv4Only ? "" : " (dual-stack IPv6+IPv4 — đặt BIND_IPV4_ONLY=1 để chỉ IPv4)"));
Console.WriteLine($"[server] Realtime WebSocket: ws://{displayHost}:{port}/api/realtime?token=<JWT>");
Console.WriteLine($"[server] DB: {(string.IsNullOrEmpty(Env.Get("DATABASE_URL")) ? "InMemory (đặt DATABASE_URL để dùng SQL Server)" : "SQL Server")}");

await app.RunAsync();

/// <summary>Lộ Program cho WebApplicationFactory của test (TestHost).</summary>
public partial class Program { }
