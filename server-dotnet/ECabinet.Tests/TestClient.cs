using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using ECabinet.Api;
using ECabinet.Api.Store;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ECabinet.Tests;

/// <summary>Phản hồi HTTP đã đọc sẵn (status + thân JSON đã parse + thân thô).</summary>
public sealed class Resp
{
    public required int Status { get; init; }
    public required string Raw { get; init; }
    public JsonNode? Json { get; init; }
    public HttpResponseMessage Message { get; init; } = null!;

    public JsonObject Obj => Json as JsonObject ?? new JsonObject();
    public JsonArray Arr => Json as JsonArray ?? new JsonArray();
    public string? Error => (Json as JsonObject) is { } o && o.TryGetPropertyValue("error", out var e) ? e?.GetValue<string>() : null;
}

/// <summary>
/// Máy chủ test in-memory (TestServer, KHÔNG mở socket) + tiện gọi HTTP có/không JWT.
/// Dựng pipeline THẬT qua App.ConfigurePipeline với InMemoryDocStore riêng cho mỗi harness.
/// </summary>
public sealed class TestApp : IAsyncDisposable
{
    private readonly IHost _host;
    public HttpClient Client { get; }
    public IDocStore Store { get; }

    private TestApp(IHost host, IDocStore store)
    {
        _host = host;
        Store = store;
        Client = host.GetTestClient();
    }

    /// <summary>Tạo harness mới: store InMemory sạch (đã seed). Rate-limit là static -> reset để không rò giữa nhóm.</summary>
    public static async Task<TestApp> CreateAsync()
    {
        RateLimit.Reset();
        var store = new InMemoryDocStore();
        await store.InitAsync();
        await Seed.SeedIfEmpty(store);

        var host = await new HostBuilder()
            .ConfigureWebHost(web =>
            {
                web.UseTestServer();
                web.ConfigureServices(s =>
                {
                    s.AddSingleton(store);
                    s.AddLogging(b => b.SetMinimumLevel(LogLevel.Warning));
                });
                web.Configure(app => App.ConfigurePipeline(app, store));
            })
            .StartAsync();
        return new TestApp(host, store);
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await _host.StopAsync();
        _host.Dispose();
    }

    // ---------------- Gọi HTTP ----------------
    private static async Task<Resp> Read(HttpResponseMessage m)
    {
        var raw = await m.Content.ReadAsStringAsync();
        JsonNode? json = null;
        try { json = string.IsNullOrEmpty(raw) ? null : JsonNode.Parse(raw); } catch { /* thân không phải JSON */ }
        return new Resp { Status = (int)m.StatusCode, Raw = raw, Json = json, Message = m };
    }

    private HttpRequestMessage Build(string method, string path, string? token, JsonNode? body, IDictionary<string, string>? headers)
    {
        var req = new HttpRequestMessage(new HttpMethod(method), path);
        if (token != null) req.Headers.TryAddWithoutValidation("Authorization", $"Bearer {token}");
        if (headers != null) foreach (var kv in headers) req.Headers.TryAddWithoutValidation(kv.Key, kv.Value);
        if (body != null) req.Content = new StringContent(J.Stringify(body), Encoding.UTF8, "application/json");
        return req;
    }

    public async Task<Resp> Send(string method, string path, string? token = null, JsonNode? body = null, IDictionary<string, string>? headers = null)
        => await Read(await Client.SendAsync(Build(method, path, token, body, headers)));

    public Task<Resp> Get(string path, string? token = null) => Send("GET", path, token);
    public Task<Resp> Post(string path, JsonNode? body = null, string? token = null) => Send("POST", path, token, body);
    public Task<Resp> Patch(string path, JsonNode? body = null, string? token = null) => Send("PATCH", path, token, body);
    public Task<Resp> Put(string path, JsonNode? body, string? token = null) => Send("PUT", path, token, body);
    public Task<Resp> Delete(string path, string? token = null) => Send("DELETE", path, token);

    /// <summary>Đăng nhập, trả access token (ném nếu thất bại). Dùng dựng ngữ cảnh test.</summary>
    public async Task<string> Login(string username, string password = "123456")
    {
        var r = await Post("/api/auth/login", new JsonObject { ["username"] = username, ["password"] = password });
        if (r.Status != 200) throw new AssertException($"Login {username} thất bại: {r.Status} {r.Error}");
        return r.Obj["token"]!.GetValue<string>();
    }

    /// <summary>Đăng nhập trả cả token + refreshToken.</summary>
    public async Task<(string token, string refresh)> LoginFull(string username, string password = "123456")
    {
        var r = await Post("/api/auth/login", new JsonObject { ["username"] = username, ["password"] = password });
        if (r.Status != 200) throw new AssertException($"Login {username} thất bại: {r.Status} {r.Error}");
        return (r.Obj["token"]!.GetValue<string>(), r.Obj["refreshToken"]!.GetValue<string>());
    }

    /// <summary>TestServer (dùng cho WebSocket client CreateWebSocketClient).</summary>
    public TestServer Server => _host.GetTestServer();
}
