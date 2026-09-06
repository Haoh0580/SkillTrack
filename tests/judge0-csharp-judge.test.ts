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
});
