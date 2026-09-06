import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/submissions/route";

const request = (body: unknown) => new Request("http://test/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("送出評測 API", () => {
  it("拒絕缺少題目、程式碼或 C# 語言的送出", async () => {
    const missingSource = await POST(request({ problemId: "112-2", language: "csharp" }));
    const wrongLanguage = await POST(request({ problemId: "112-2", language: "python", source: "print(1)" }));
    expect(missingSource.status).toBe(400);
    expect(wrongLanguage.status).toBe(400);
  });

  it("有效 C# 送出會安全地回報尚未設定判題器", async () => {
    const response = await POST(request({ problemId: "112-2", language: "csharp", source: "public class Program {}" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ verdict: "judge_not_configured", passed: 0, total: 0 });
  });
});
