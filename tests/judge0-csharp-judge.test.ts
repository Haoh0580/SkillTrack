import { describe, expect, it, vi } from "vitest";
import { createJudge0CSharpJudge } from "@/lib/judge/judge0-csharp-judge";

const request = {
  problemId: "112-2",
  source: "public class Program {}",
  tests: [
    { input: "idea\ndeal", expectedOutput: "2", visibility: "public" as const },
    { input: "but\nbait", expectedOutput: "3", visibility: "private" as const },
  ],
  timeLimitMs: 2000,
  memoryLimitMb: 256,
};

describe("Judge0 C# 判題 Adapter", () => {
  it("逐組送出 C# 程式並在輸出完全符合時回傳 accepted", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: { id: 3 }, stdout: "2\n", time: "0.084" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: { id: 3 }, stdout: "3\n", time: "0.091" }), { status: 201 }));
    const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test", csharpLanguageId: 51, apiKey: "server-only-secret", fetcher });

    const result = await judge.run(request);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledWith("https://judge.example.test/submissions?base64_encoded=false&wait=true", expect.objectContaining({ headers: expect.objectContaining({ "X-Auth-Token": "server-only-secret" }) }));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ source_code: "public class Program {}", language_id: 51, stdin: "idea\ndeal", cpu_time_limit: 2, memory_limit: 262144 });
    expect(result).toMatchObject({ verdict: "accepted", passed: 2, total: 2, elapsedMs: 175 });
  });

  it("程式可執行但輸出不符時回傳 wrong_answer，且停止於第一組失敗測資", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: { id: 3 }, stdout: "4\n", time: "0.01" }), { status: 201 }));
    const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test/", csharpLanguageId: 51, fetcher });

    const result = await judge.run(request);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ verdict: "wrong_answer", passed: 0, total: 2, stdout: "4\n" });
  });

  it("Judge0 回報逾時時回傳 time_limit，而不曝光上游認證資訊", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: { id: 5, description: "Time Limit Exceeded" }, stderr: "internal" }), { status: 201 }));
    const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test", csharpLanguageId: 51, apiKey: "server-only-secret", fetcher });

    const result = await judge.run(request);

    expect(result).toMatchObject({ verdict: "time_limit", passed: 0, total: 2 });
    expect(result.stderr).not.toContain("server-only-secret");
  });

  it("可改用 RapidAPI 代管的 Judge0 CE，帶上 X-RapidAPI-Key / X-RapidAPI-Host 而非 X-Auth-Token", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: { id: 3 }, stdout: "2\n", time: "0.05" }), { status: 201 }));
    const judge = createJudge0CSharpJudge({
      endpoint: "https://judge0-ce.p.rapidapi.com",
      csharpLanguageId: 51,
      headers: { "X-RapidAPI-Key": "rapid-secret", "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com" },
      fetcher,
    });

    const result = await judge.run({ ...request, tests: [request.tests[0]] });

    const headers = fetcher.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-RapidAPI-Key"]).toBe("rapid-secret");
    expect(headers["X-RapidAPI-Host"]).toBe("judge0-ce.p.rapidapi.com");
    expect(headers["X-Auth-Token"]).toBeUndefined();
    expect(result).toMatchObject({ verdict: "accepted", passed: 1, total: 1 });
  });

  describe("Verdict taxonomy", () => {
    it("Judge0 Compilation Error (status 6) 回報 compilation_error，而不是 wrong_answer 或 runtime_error", async () => {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: { id: 6, description: "Compilation Error" }, compile_output: "Main.cs(7,5): error CS1002: ; expected" }), { status: 201 }));
      const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test", csharpLanguageId: 51, fetcher });

      const result = await judge.run(request);

      expect(result.verdict).toBe("compilation_error");
      expect(result.stderr).toContain("CS1002");
    });

    it("Judge0 Runtime Error 系列狀態（7~12）仍回報 runtime_error", async () => {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: { id: 11, description: "Runtime Error (NZEC)" }, stderr: "IndexOutOfRangeException" }), { status: 201 }));
      const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test", csharpLanguageId: 51, fetcher });

      const result = await judge.run(request);

      expect(result.verdict).toBe("runtime_error");
      expect(result.stderr).toContain("IndexOutOfRangeException");
    });

    it("Judge0 自身的 Internal Error（status 13）回報 judge_unavailable，不算學生程式的錯", async () => {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: { id: 13, description: "Internal Error" } }), { status: 201 }));
      const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test", csharpLanguageId: 51, fetcher });

      const result = await judge.run(request);

      expect(result.verdict).toBe("judge_unavailable");
    });

    it("網路連線失敗回報 judge_unavailable（不是 runtime_error）", async () => {
      const fetcher = vi.fn().mockRejectedValue(new TypeError("network down"));
      const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test", csharpLanguageId: 51, fetcher });

      const result = await judge.run(request);

      expect(result.verdict).toBe("judge_unavailable");
    });

    it("Judge0 回傳非 2xx 時回報 judge_unavailable", async () => {
      const fetcher = vi.fn().mockResolvedValue(new Response("upstream secret detail", { status: 500 }));
      const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test", csharpLanguageId: 51, fetcher });

      const result = await judge.run(request);

      expect(result.verdict).toBe("judge_unavailable");
      expect(result.stderr).not.toContain("upstream secret detail");
    });

    it("Judge0 回傳無法解析的 JSON 時回報 judge_unavailable", async () => {
      const fetcher = vi.fn().mockResolvedValue(new Response("not json", { status: 201 }));
      const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test", csharpLanguageId: 51, fetcher });

      const result = await judge.run(request);

      expect(result.verdict).toBe("judge_unavailable");
    });

    it("SkillTrack 的 accepted 代表『全部測資通過』，Judge0 單筆 Accepted 但某測資輸出不符仍為 wrong_answer", async () => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: { id: 3 }, stdout: "2\n" }), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ status: { id: 3 }, stdout: "wrong\n" }), { status: 201 }));
      const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test", csharpLanguageId: 51, fetcher });

      const result = await judge.run(request);

      expect(result.verdict).toBe("wrong_answer");
      expect(result.passed).toBe(1);
    });
  });

  describe("stdin 原樣傳遞", () => {
    it("test case 的 stdin（含刻意保留的空白行）原封不動送到 Judge0", async () => {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: { id: 3 }, stdout: "3\n" }), { status: 201 }));
      const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test", csharpLanguageId: 51, fetcher });

      await judge.run({ ...request, tests: [{ input: "abc\n\n", expectedOutput: "3", visibility: "private" }] });

      expect(JSON.parse(fetcher.mock.calls[0][1].body).stdin).toBe("abc\n\n");
    });
  });

  describe("Output normalization", () => {
    const runWithStdout = async (stdout: string, expectedOutput: string) => {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: { id: 3 }, stdout }), { status: 201 }));
      const judge = createJudge0CSharpJudge({ endpoint: "https://judge.example.test", csharpLanguageId: 51, fetcher });
      return judge.run({ ...request, tests: [{ input: "x", expectedOutput, visibility: "public" as const }] });
    };

    it("允許 \\r\\n 與 \\n 視為相同", async () => {
      const result = await runWithStdout("2\r\n", "2\n");
      expect(result.verdict).toBe("accepted");
    });

    it("忽略每行結尾的多餘空白", async () => {
      const result = await runWithStdout("2   \n", "2");
      expect(result.verdict).toBe("accepted");
    });

    it("忽略輸出結尾多餘的空白行", async () => {
      const result = await runWithStdout("2\n\n\n", "2");
      expect(result.verdict).toBe("accepted");
    });

    it("不忽略大小寫差異", async () => {
      const result = await runWithStdout("Accepted\n", "accepted");
      expect(result.verdict).toBe("wrong_answer");
    });

    it("不忽略行中間的空白差異", async () => {
      const result = await runWithStdout("4 3\n", "43");
      expect(result.verdict).toBe("wrong_answer");
    });

    it("不忽略開頭空白（leading whitespace 仍視為不同）", async () => {
      const result = await runWithStdout("  2\n", "2");
      expect(result.verdict).toBe("wrong_answer");
    });
  });
});
