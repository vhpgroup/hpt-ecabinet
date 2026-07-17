using System.Diagnostics;

namespace ECabinet.Tests;

/// <summary>Kết quả 1 ca test.</summary>
public sealed record CaseResult(string Group, string Name, bool Passed, string? Detail, long Ms);

/// <summary>
/// Runner test tự viết (KHÔNG xunit) — gom ca theo nhóm, in bảng PASS/FAIL, trả exit code.
/// Mỗi ca là 1 async lambda; ném exception -> FAIL (kèm message).
/// </summary>
public sealed class TestRunner
{
    private readonly List<CaseResult> _results = new();
    private string _group = "";

    public void Group(string name) => _group = name;

    /// <summary>Chạy 1 ca. Ném AssertException/bất kỳ -> FAIL.</summary>
    public async Task Case(string name, Func<Task> body)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await body();
            sw.Stop();
            _results.Add(new CaseResult(_group, name, true, null, sw.ElapsedMilliseconds));
            Console.WriteLine($"  ✓ [{_group}] {name} ({sw.ElapsedMilliseconds}ms)");
        }
        catch (Exception e)
        {
            sw.Stop();
            var msg = e is AssertException ? e.Message : $"{e.GetType().Name}: {e.Message}";
            _results.Add(new CaseResult(_group, name, false, msg, sw.ElapsedMilliseconds));
            Console.WriteLine($"  ✗ [{_group}] {name} — {msg}");
        }
    }

    /// <summary>In bảng tổng hợp theo nhóm + tổng; trả exit code (0 nếu PASS hết).</summary>
    public int Report()
    {
        Console.WriteLine();
        Console.WriteLine("================ KẾT QUẢ TEST (theo nhóm) ================");
        Console.WriteLine($"{"Nhóm",-28} {"Pass",5} {"Fail",5} {"Tổng",5}");
        Console.WriteLine(new string('-', 50));
        var groups = _results.GroupBy(r => r.Group);
        var totalPass = 0; var totalFail = 0;
        foreach (var g in groups)
        {
            var pass = g.Count(r => r.Passed);
            var fail = g.Count(r => !r.Passed);
            totalPass += pass; totalFail += fail;
            Console.WriteLine($"{g.Key,-28} {pass,5} {fail,5} {g.Count(),5}");
        }
        Console.WriteLine(new string('-', 50));
        Console.WriteLine($"{"TỔNG",-28} {totalPass,5} {totalFail,5} {_results.Count,5}");
        Console.WriteLine();

        if (totalFail > 0)
        {
            Console.WriteLine("---- CHI TIẾT CA THẤT BẠI ----");
            foreach (var r in _results.Where(r => !r.Passed))
                Console.WriteLine($"  ✗ [{r.Group}] {r.Name}: {r.Detail}");
            Console.WriteLine();
            Console.WriteLine($"KẾT LUẬN: THẤT BẠI ({totalFail} ca lỗi / {_results.Count} ca).");
            return 1;
        }
        Console.WriteLine($"KẾT LUẬN: TẤT CẢ {_results.Count} CA PASS. ✅");
        return 0;
    }

    public int Total => _results.Count;
}

/// <summary>Lỗi khẳng định (assert) — message hiển thị trong bảng FAIL.</summary>
public sealed class AssertException : Exception
{
    public AssertException(string message) : base(message) { }
}

/// <summary>Bộ khẳng định gọn (tự viết, không phụ thuộc thư viện test).</summary>
public static class Assert
{
    public static void True(bool cond, string msg)
    {
        if (!cond) throw new AssertException(msg);
    }

    public static void Eq(object? expected, object? actual, string msg)
    {
        if (!Equals(expected, actual))
            throw new AssertException($"{msg} (mong đợi: {expected ?? "null"}, thực tế: {actual ?? "null"})");
    }

    public static void Status(int expected, int actual, string ctx)
    {
        if (expected != actual)
            throw new AssertException($"{ctx}: HTTP mong đợi {expected} nhưng nhận {actual}");
    }
}
