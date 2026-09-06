import { describe, expect, it } from "vitest";
import { applyJudgeResult, createPendingSubmission } from "@/features/practice/submission-record";
import { saveJudgeResult, savePendingSubmission } from "@/lib/submissions/store";

function createDatabaseSpy() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    calls,
    database: {
      prepare(sql: string) {
        const call = { sql, values: [] as unknown[] };
        calls.push(call);
        return {
          bind(...values: unknown[]) {
            call.values = values;
            return { run: async () => ({ success: true }) };
          },
        };
      },
    },
  };
}

describe("送出紀錄資料庫", () => {
  it("將剛送出的 C# 程式完整寫入 submissions", async () => {
    const { database, calls } = createDatabaseSpy();
    const record = createPendingSubmission({ id: "submission-1", problemId: "112-2", language: "csharp", source: "public class Program {}", now: "2026-09-06T00:00:00.000Z" });

    await savePendingSubmission(database, record);

    expect(calls[0].sql).toContain("INSERT INTO submissions");
    expect(calls[0].values).toContain("public class Program {}");
    expect(calls[0].values).toContain("queued");
  });

  it("只以判題結果欄位更新已存在的送出紀錄", async () => {
    const { database, calls } = createDatabaseSpy();
    const pending = createPendingSubmission({ id: "submission-1", problemId: "112-2", language: "csharp", source: "public class Program {}", now: "2026-09-06T00:00:00.000Z" });
    const completed = applyJudgeResult(pending, { id: "submission-1", verdict: "accepted", passed: 2, total: 2, elapsedMs: 83, stdout: "2", stderr: "" }, "2026-09-06T00:01:00.000Z");

    await saveJudgeResult(database, completed);

    expect(calls[0].sql).toContain("UPDATE submissions");
    expect(calls[0].values).toEqual(expect.arrayContaining(["accepted", 2, 83, "submission-1"]));
    expect(calls[0].values).not.toContain("public class Program {}");
  });
});
