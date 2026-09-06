import { beforeEach, describe, expect, it, vi } from "vitest";

const { savePendingSubmission, saveJudgeResult } = vi.hoisted(() => ({
  savePendingSubmission: vi.fn(),
  saveJudgeResult: vi.fn(),
}));
const { runJudge } = vi.hoisted(() => ({ runJudge: vi.fn() }));
const { insertFinalizedRecord } = vi.hoisted(() => ({ insertFinalizedRecord: vi.fn() }));

vi.mock("@/lib/runtime/database", () => ({ getSubmissionDatabase: vi.fn(() => ({})) }));
vi.mock("@/lib/submissions/store", () => ({ savePendingSubmission, saveJudgeResult }));
vi.mock("@/lib/judge/csharp-judge", () => ({ getCSharpJudge: vi.fn(() => ({ run: runJudge })) }));
vi.mock("@/lib/records/store", () => ({ insertFinalizedRecord }));

import { POST } from "@/app/api/submissions/route";

const request = (body: unknown) => new Request("http://test/api/submissions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("送出評測 API", () => {
  beforeEach(() => {
    savePendingSubmission.mockReset().mockResolvedValue(undefined);
    saveJudgeResult.mockReset().mockResolvedValue(undefined);
    runJudge.mockReset().mockResolvedValue({ id: "remote-id", verdict: "judge_not_configured", passed: 0, total: 0 });
    insertFinalizedRecord.mockReset().mockResolvedValue({ applied: true });
  });

  it("拒絕缺少題目、程式碼或 C# 語言的送出", async () => {
    const missingSource = await POST(request({ problemId: "112-2", language: "csharp" }));
    const wrongLanguage = await POST(request({ problemId: "112-2", language: "python", source: "print(1)" }));
    expect(missingSource.status).toBe(400);
    expect(wrongLanguage.status).toBe(400);
  });

  it("有效 C# 送出會安全地回報尚未設定判題器，且不建立正式成績", async () => {
    const response = await POST(request({ problemId: "112-2", language: "csharp", source: "public class Program {}" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ verdict: "judge_not_configured", passed: 0, total: 0, finalized: false });
    expect(savePendingSubmission).toHaveBeenCalledOnce();
    expect(saveJudgeResult).toHaveBeenCalledOnce();
    expect(runJudge).toHaveBeenCalledWith(expect.objectContaining({ problemId: "112-2", tests: expect.arrayContaining([expect.objectContaining({ input: "idea\ndeal" })]) }));
    expect(insertFinalizedRecord).not.toHaveBeenCalled();
  });

  it("真正判定通過時回傳 200，並由 server 端完成計分（finalized: true, score: 100）", async () => {
    runJudge.mockResolvedValue({ id: "remote-id", verdict: "accepted", passed: 1, total: 1 });
    const response = await POST(request({ problemId: "112-2", language: "csharp", source: "public class Program {}" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ verdict: "accepted", passed: 1, total: 1, score: 100, status: "完成", finalized: true });
    expect(insertFinalizedRecord).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ resourceId: "112-2", score: 100, status: "完成", submissionId: expect.any(String) }));
  });

  it("wrong_answer 依既有規則計分為 0 分／未完成", async () => {
    runJudge.mockResolvedValue({ id: "remote-id", verdict: "wrong_answer", passed: 0, total: 5 });
    const response = await POST(request({ problemId: "112-2", language: "csharp", source: "..." }));
    await expect(response.json()).resolves.toMatchObject({ score: 0, status: "未完成", finalized: true });
  });

  it("沒有已驗證測試資料的題目不會呼叫判題器，也不會計分，避免空迴圈被誤判為 accepted", async () => {
    const response = await POST(request({ problemId: "112-1", language: "csharp", source: "public class Program {}" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ verdict: "judge_not_configured", passed: 0, total: 0, finalized: false });
    expect(runJudge).not.toHaveBeenCalled();
    expect(insertFinalizedRecord).not.toHaveBeenCalled();
  });

  it("compilation_error 視為真實評測結果，回傳 200 並計 0 分（而非誤判為服務不可用）", async () => {
    runJudge.mockResolvedValue({ id: "remote-id", verdict: "compilation_error", passed: 0, total: 5, stderr: "CS1002: ; expected" });
    const response = await POST(request({ problemId: "112-2", language: "csharp", source: "broken" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ verdict: "compilation_error", score: 0, status: "未完成", finalized: true });
  });

  it("runtime_error / time_limit 同樣計 0 分並更新訓練紀錄", async () => {
    runJudge.mockResolvedValue({ id: "remote-id", verdict: "runtime_error", passed: 0, total: 5 });
    await expect((await POST(request({ problemId: "112-2", language: "csharp", source: "..." }))).json()).resolves.toMatchObject({ score: 0, finalized: true });

    runJudge.mockResolvedValue({ id: "remote-id", verdict: "time_limit", passed: 0, total: 5 });
    await expect((await POST(request({ problemId: "112-2", language: "csharp", source: "..." }))).json()).resolves.toMatchObject({ score: 0, finalized: true });
  });

  it("judge_unavailable 與 judge_not_configured 一樣回傳 503，且絕不建立正式成績或呼叫計分", async () => {
    runJudge.mockResolvedValue({ id: "remote-id", verdict: "judge_unavailable", passed: 0, total: 5, stderr: "判題服務暫時無法使用" });
    const response = await POST(request({ problemId: "112-2", language: "csharp", source: "public class Program {}" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ verdict: "judge_unavailable", finalized: false });
    expect(response.json).toBeDefined();
    expect(insertFinalizedRecord).not.toHaveBeenCalled();
  });

  it("Phase 3 新增的 validated 題目（113-1、114-3）現在會把測資交給判題器", async () => {
    runJudge.mockResolvedValue({ id: "remote-id", verdict: "accepted", passed: 5, total: 5 });

    await POST(request({ problemId: "113-1", language: "csharp", source: "..." }));
    expect(runJudge).toHaveBeenCalledWith(expect.objectContaining({ problemId: "113-1", tests: expect.arrayContaining([expect.objectContaining({ input: "1,2,3,4", expectedOutput: "43/30" })]) }));

    runJudge.mockClear();
    await POST(request({ problemId: "114-3", language: "csharp", source: "..." }));
    expect(runJudge).toHaveBeenCalledWith(expect.objectContaining({ problemId: "114-3", tests: expect.arrayContaining([expect.objectContaining({ expectedOutput: "4" })]) }));
  });

  describe("Phase 4：server-authoritative finalization", () => {
    it("每個 submission 都有自己的 id，且該 id 會原封不動交給 insertFinalizedRecord 當作 idempotency key", async () => {
      runJudge.mockResolvedValue({ id: "remote-id", verdict: "accepted", passed: 1, total: 1 });
      const response = await POST(request({ problemId: "112-2", language: "csharp", source: "..." }));
      const body = await response.json() as { id: string };
      expect(insertFinalizedRecord).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ submissionId: body.id }));
    });

    it("兩次獨立送出各自產生不同的 submission id（不是同一個 idempotency key）", async () => {
      runJudge.mockResolvedValue({ id: "remote-id", verdict: "accepted", passed: 1, total: 1 });
      const first = await (await POST(request({ problemId: "112-2", language: "csharp", source: "..." }))).json() as { id: string };
      const second = await (await POST(request({ problemId: "112-2", language: "csharp", source: "..." }))).json() as { id: string };
      expect(first.id).not.toBe(second.id);
    });

    it("同一次 finalize 若偵測到已經記錄過（applied:false），仍視為 finalized，不視為錯誤", async () => {
      insertFinalizedRecord.mockResolvedValue({ applied: false });
      runJudge.mockResolvedValue({ id: "remote-id", verdict: "accepted", passed: 1, total: 1 });
      const response = await POST(request({ problemId: "112-2", language: "csharp", source: "..." }));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ finalized: true });
    });

    it("成績寫入失敗時，不得向 Browser 回報成功；verdict 仍照實回傳，但 finalized:false 且非 200", async () => {
      insertFinalizedRecord.mockRejectedValue(new Error("D1_ERROR: transient failure"));
      runJudge.mockResolvedValue({ id: "remote-id", verdict: "accepted", passed: 1, total: 1 });
      const response = await POST(request({ problemId: "112-2", language: "csharp", source: "..." }));
      expect(response.status).not.toBe(200);
      await expect(response.json()).resolves.toMatchObject({ verdict: "accepted", score: 100, finalized: false });
    });

    it("成績寫入失敗不會導致重新呼叫 Judge0（不重跑學生程式）", async () => {
      insertFinalizedRecord.mockRejectedValue(new Error("boom"));
      runJudge.mockResolvedValue({ id: "remote-id", verdict: "accepted", passed: 1, total: 1 });
      await POST(request({ problemId: "112-2", language: "csharp", source: "..." }));
      expect(runJudge).toHaveBeenCalledOnce();
    });

    it("elapsedSeconds 由 client 提供時會轉換為分鐘並隨 finalize 一起送出，且會被 clamp 到合理上限", async () => {
      runJudge.mockResolvedValue({ id: "remote-id", verdict: "accepted", passed: 1, total: 1 });
      await POST(request({ problemId: "112-2", language: "csharp", source: "...", elapsedSeconds: 125 }));
      expect(insertFinalizedRecord).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ minutes: 2 }));

      insertFinalizedRecord.mockClear();
      await POST(request({ problemId: "112-2", language: "csharp", source: "...", elapsedSeconds: 999999999 }));
      const minutes = insertFinalizedRecord.mock.calls[0][1].minutes as number;
      expect(minutes).toBeLessThanOrEqual(4 * 60);
    });

    it("elapsedSeconds 缺漏或型別錯誤時，minutes 安全地退回最小值，不影響 verdict 或 score", async () => {
      runJudge.mockResolvedValue({ id: "remote-id", verdict: "accepted", passed: 1, total: 1 });
      const response = await POST(request({ problemId: "112-2", language: "csharp", source: "...", elapsedSeconds: "not-a-number" }));
      expect(response.status).toBe(200);
      expect(insertFinalizedRecord).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ minutes: 1 }));
    });

    it("Client 無法偽造 score／verdict／finalized：request body 裡任何這類欄位都會被忽略", async () => {
      runJudge.mockResolvedValue({ id: "remote-id", verdict: "wrong_answer", passed: 0, total: 5 });
      const response = await POST(request({
        problemId: "112-2", language: "csharp", source: "...",
        score: 100, verdict: "accepted", finalized: true, status: "完成",
      }));
      const body = await response.json() as { verdict: string; score: number; status: string };
      expect(body.verdict).toBe("wrong_answer");
      expect(body.score).toBe(0);
      expect(body.status).toBe("未完成");
    });

    it("回應不包含 private test case 的 input／expectedOutput", async () => {
      runJudge.mockResolvedValue({ id: "remote-id", verdict: "wrong_answer", passed: 3, total: 5, stdout: "student-own-output" });
      const response = await POST(request({ problemId: "112-2", language: "csharp", source: "..." }));
      const text = await response.text();
      expect(text).not.toContain("idea");
      expect(text).not.toContain("deal");
      expect(text).not.toContain("expectedOutput");
      expect(text).not.toContain("bait");
    });
  });
});
