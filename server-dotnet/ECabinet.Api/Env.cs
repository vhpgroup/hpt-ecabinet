namespace ECabinet.Api;

/// <summary>
/// Truy cập biến môi trường (tương đương process.env của Node). Đọc động mỗi lần gọi
/// để test có thể set/xóa biến trước khi dựng server (parity với Node đọc process.env runtime).
/// </summary>
public static class Env
{
    public static string? Get(string name) => Environment.GetEnvironmentVariable(name);

    public static string GetOr(string name, string fallback)
    {
        var v = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrEmpty(v) ? fallback : v;
    }

    public static int GetInt(string name, int fallback)
    {
        var v = Environment.GetEnvironmentVariable(name);
        if (string.IsNullOrEmpty(v)) return fallback;
        return int.TryParse(v, out var n) ? n : fallback;
    }

    public static bool Has(string name) => !string.IsNullOrEmpty(Environment.GetEnvironmentVariable(name));
}
