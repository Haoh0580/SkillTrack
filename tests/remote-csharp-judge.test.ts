import { describe, expect, it, vi } from "vitest";
import { createRemoteCSharpJudge } from "@/lib/judge/remote-csharp-judge";

const judgeRequest = {
  problemId: "112-2",
  source: "public class Program {}",
  tests: [{ input: "idea\ndeal", expectedOutput: "2", visibility: "public" as const }],
  timeLimitMs: 2000,
  memoryLimitMb: 256,
};

describe("遠端 C# 判題 Adapter", () => {
  it("將程式與測資送到伺服器端判題端點，並轉回一致的結果格式", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ verdict: "accepted", passed: 1, total: 1, elapsedMs: 84, stdout: "2" }), { status: 200 }));
    const judge = createRemoteCSharpJudge({ endpoint: "https://judge.example.test/run", apiKey: "server-only-secret", fetcher });

    const result = await judge.run(judgeRequest);

    expect(fetcher).toHaveBeenCalledWith("https://judge.example.test/run", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ authorization: "Bearer server-only-secret" }) }));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ language: "csharp", source: "public class Program {}", tests: judgeRequest.tests, timeLimitMs: 2000 });
    expect(result).toMatchObject({ verdict: "accepted", passed: 1, total: 1, elapsedMs: 84, stdout: "2" });
  });

  it("遠端服務失敗時回報 judge_unavailable（而非誤判為 runtime_error），且不洩漏服務回應或密鑰", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("upstream detail: server-only-secret", { status: 500 }));
    const judge = createRemoteCSharpJudge({ endpoint: "https://judge.example.test/run", apiKey: "server-only-secret", fetcher });

    const result = await judge.run(judgeRequest);

    expect(result).toMatchObject({ verdict: "judge_unavailable", passed: 0, total: 1 });
    expect(result.stderr).not.toContain("server-only-secret");
  });

  it("遠端服務回傳無法辨識的 verdict 時，同樣視為 judge_unavailable，不當作任何一種評測結果", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ verdict: "totally_bogus", passed: 1, total: 1 }), { status: 200 }));
    const judge = createRemoteCSharpJudge({ endpoint: "https://judge.example.test/run", fetcher });

    const result = await judge.run(judgeRequest);

    expect(result).toMatchObject({ verdict: "judge_unavailable" });
  });
});
