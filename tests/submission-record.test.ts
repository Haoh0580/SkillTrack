import { describe, expect, it } from "vitest";
import { applyJudgeResult, createPendingSubmission, deriveTrainingOutcome, isScoreableVerdict } from "@/features/practice/submission-record";

describe("送出紀錄", () => {
  it("建立 C# 送出時保留題目、程式碼、擁有者與可追蹤的初始狀態", () => {
    const record = createPendingSubmission({ id: "submission-1", problemId: "112-2", language: "csharp", source: "public class Program {}", now: "2026-09-06T00:00:00.000Z", userId: "user-a" });
    expect(record).toMatchObject({ id: "submission-1", problemId: "112-2", language: "csharp", source: "public class Program {}", verdict: "queued", passed: 0, total: 0, createdAt: "2026-09-06T00:00:00.000Z", userId: "user-a" });
  });

  it("判題結果只更新結果欄位並保留原始程式、建立時間與擁有者", () => {
    const pending = createPendingSubmission({ id: "submission-1", problemId: "112-2", language: "csharp", source: "public class Program {}", now: "2026-09-06T00:00:00.000Z", userId: "user-a" });
    const finished = applyJudgeResult(pending, { id: "submission-1", verdict: "wrong_answer", passed: 1, total: 2, stdout: "2", stderr: "" }, "2026-09-06T00:01:00.000Z");
    expect(finished).toMatchObject({ verdict: "wrong_answer", passed: 1, total: 2, stdout: "2", source: "public class Program {}", createdAt: "2026-09-06T00:00:00.000Z", updatedAt: "2026-09-06T00:01:00.000Z", userId: "user-a" });
  });
});

describe("正式計分規則（server-authoritative — Phase 4 從 client 移到這裡，公式不變）", () => {
  it("accepted 計 100 分、狀態為完成", () => {
    expect(deriveTrainingOutcome({ verdict: "accepted", passed: 5 })).toEqual({ score: 100, status: "完成" });
  });

  it("wrong_answer / compilation_error / runtime_error / time_limit 都計 0 分", () => {
    for (const verdict of ["wrong_answer", "compilation_error", "runtime_error", "time_limit"] as const) {
      expect(deriveTrainingOutcome({ verdict, passed: 0 })?.score).toBe(0);
    }
  });

  it("未通過但至少通過一組測資時狀態為部分完成，一組都沒過則為未完成", () => {
    expect(deriveTrainingOutcome({ verdict: "wrong_answer", passed: 2 })?.status).toBe("部分完成");
    expect(deriveTrainingOutcome({ verdict: "wrong_answer", passed: 0 })?.status).toBe("未完成");
  });

  it("judge_not_configured（Manual Review）與 judge_unavailable 都不產生任何計分結果", () => {
    expect(deriveTrainingOutcome({ verdict: "judge_not_configured", passed: 0 })).toBeNull();
    expect(deriveTrainingOutcome({ verdict: "judge_unavailable", passed: 0 })).toBeNull();
  });

  it("queued 也不計分（尚未有結果）", () => {
    expect(deriveTrainingOutcome({ verdict: "queued", passed: 0 })).toBeNull();
  });

  it("isScoreableVerdict 與 deriveTrainingOutcome 對每個 verdict 的判斷一致", () => {
    const allVerdicts = ["accepted", "wrong_answer", "compilation_error", "runtime_error", "time_limit", "judge_not_configured", "judge_unavailable", "queued"] as const;
    for (const verdict of allVerdicts) {
      expect(deriveTrainingOutcome({ verdict, passed: 0 }) !== null).toBe(isScoreableVerdict(verdict));
    }
  });
});
