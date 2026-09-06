import { describe, expect, it } from "vitest";
import { applyJudgeResult, createPendingSubmission } from "@/features/practice/submission-record";
import { saveJudgeResult, savePendingSubmission } from "@/lib/submissions/store";

function createDatabaseSpy() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    calls,
    // savePendingSubmission/saveJudgeResult now also run idempotent schema-ensure
    // statements (ensureSubmissionsSchema) before the actual write, so tests must
    // find their statement of interest by content rather than assuming calls[0].
    findCall: (needle: string) => calls.find((call) => call.sql.includes(needle)),
    database: {
      prepare(sql: string) {
        const call = { sql, values: [] as unknown[] };
        calls.push(call);
        return {
          bind(...values: unknown[]) {
            call.values = values;
            return {
              run: async () => ({ success: true }),
              first: async () => null,
              all: async () => ({ results: [] }),
            };
          },
        };
      },
    },
  };
}

describe("送出紀錄資料庫", () => {
  it("將剛送出的 C# 程式完整寫入 submissions", async () => {
    const { database, findCall } = createDatabaseSpy();
    const record = createPendingSubmission({ id: "submission-1", problemId: "112-2", language: "csharp", source: "public class Program {}", now: "2026-09-06T00:00:00.000Z", userId: "user-1" });

    await savePendingSubmission(database, record);

    const insert = findCall("INSERT INTO submissions (");
    expect(insert?.values).toContain("public class Program {}");
    expect(insert?.values).toContain("queued");
    expect(insert?.values).toContain("user-1");
  });

  it("只以判題結果欄位更新已存在的送出紀錄", async () => {
    const { database, findCall } = createDatabaseSpy();
    const pending = createPendingSubmission({ id: "submission-1", problemId: "112-2", language: "csharp", source: "public class Program {}", now: "2026-09-06T00:00:00.000Z", userId: "user-1" });
    const completed = applyJudgeResult(pending, { id: "submission-1", verdict: "accepted", passed: 2, total: 2, elapsedMs: 83, stdout: "2", stderr: "" }, "2026-09-06T00:01:00.000Z");

    await saveJudgeResult(database, completed);

    const update = findCall("UPDATE submissions");
    expect(update?.values).toEqual(expect.arrayContaining(["accepted", 2, 83, "submission-1"]));
    expect(update?.values).not.toContain("public class Program {}");
  });
});
