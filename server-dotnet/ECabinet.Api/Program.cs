// ============================================================
// eCabinet API Server (.NET 8) — entrypoint.
// Port index.js: dựng app (App.BuildAsync) rồi listen 0.0.0.0:PORT (mặc định 3000)
// để nginx 'web' proxy sang api:3000 không đổi.
// ============================================================
using ECabinet.Api;

var port = Env.GetInt("PORT", 3000);
Environment.SetEnvironmentVariable("ASPNETCORE_URLS", $"http://0.0.0.0:{port}");

var app = await App.BuildAsync(args);

Console.WriteLine($"[server] eCabinet API (.NET) chạy tại http://0.0.0.0:{port} — {ECabinet.Api.Store.Db.Ordered.Count} bộ dữ liệu");
Console.WriteLine($"[server] Realtime WebSocket: ws://0.0.0.0:{port}/api/realtime?token=<JWT>");
Console.WriteLine($"[server] DB: {(string.IsNullOrEmpty(Env.Get("DATABASE_URL")) ? "InMemory (đặt DATABASE_URL để dùng SQL Server)" : "SQL Server")}");

await app.RunAsync();

/// <summary>Lộ Program cho WebApplicationFactory của test (TestHost).</summary>
public partial class Program { }
