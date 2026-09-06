import { describe, expect, it } from "vitest";
import { applyJudgeResult, createPendingSubmission } from "@/features/practice/submission-record";

describe("送出紀錄", () => {
  it("建立 C# 送出時保留題目、程式碼與可追蹤的初始狀態", () => {
    const record = createPendingSubmission({ id: "submission-1", problemId: "112-2", language: "csharp", source: "public class Program {}", now: "2026-09-06T00:00:00.000Z" });
    expect(record).toMatchObject({ id: "submission-1", problemId: "112-2", language: "csharp", source: "public class Program {}", verdict: "queued", passed: 0, total: 0, createdAt: "2026-09-06T00:00:00.000Z" });
  });

  it("判題結果只更新結果欄位並保留原始程式與建立時間", () => {
    const pending = createPendingSubmission({ id: "submission-1", problemId: "112-2", language: "csharp", source: "public class Program {}", now: "2026-09-06T00:00:00.000Z" });
    const finished = applyJudgeResult(pending, { id: "submission-1", verdict: "wrong_answer", passed: 1, total: 2, stdout: "2", stderr: "" }, "2026-09-06T00:01:00.000Z");
    expect(finished).toMatchObject({ verdict: "wrong_answer", passed: 1, total: 2, stdout: "2", source: "public class Program {}", createdAt: "2026-09-06T00:00:00.000Z", updatedAt: "2026-09-06T00:01:00.000Z" });
  });
});
