import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import type { SubmissionDatabase } from "@/lib/submissions/store";
import { ensureRecordsSchema, insertFinalizedRecord, insertManualRecord } from "@/lib/records/store";

/**
 * A real SQLite-backed test double (Node's built-in node:sqlite, not a mock) so the
 * idempotency guarantee is verified against actual UNIQUE-constraint enforcement —
 * the same mechanism D1 (also SQLite) uses in production — rather than asserting
 * against a hand-rolled fake that might not reproduce real constraint-violation
 * behavior (error message shape, atomicity).
 */
function createSqliteDatabase(): { database: SubmissionDatabase; raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  const database: SubmissionDatabase = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              raw.prepare(sql).run(...(values as (string | number | bigint | null)[]));
              return undefined;
            },
          };
        },
      };
    },
  };
  return { database, raw };
}

const baseInput = { resourceId: "112-2", score: 100, minutes: 5, status: "完成", notes: "test" };

describe("lib/records/store — 正式成績寫入與冪等性", () => {
  it("ensureRecordsSchema 可重複呼叫而不出錯（額外欄位與索引都是 idempotent）", async () => {
    const { database } = createSqliteDatabase();
    await ensureRecordsSchema(database);
    await ensureRecordsSchema(database);
    await ensureRecordsSchema(database);
  });

  it("insertFinalizedRecord 第一次寫入回報 applied:true，且實際寫入一筆資料", async () => {
    const { database, raw } = createSqliteDatabase();
    const result = await insertFinalizedRecord(database, { ...baseInput, submissionId: "sub-1" });
    expect(result).toEqual({ applied: true });
    const rows = raw.prepare("SELECT * FROM records").all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ resource_id: "112-2", score: 100, submission_id: "sub-1" });
  });

  it("同一個 submissionId 重複 finalize（模擬 client/network/Cloudflare retry）只會有一筆正式紀錄", async () => {
    const { database, raw } = createSqliteDatabase();
    const first = await insertFinalizedRecord(database, { ...baseInput, submissionId: "sub-2" });
    const second = await insertFinalizedRecord(database, { ...baseInput, submissionId: "sub-2" });
    const third = await insertFinalizedRecord(database, { ...baseInput, submissionId: "sub-2" });

    expect(first).toEqual({ applied: true });
    expect(second).toEqual({ applied: false });
    expect(third).toEqual({ applied: false });

    const rows = raw.prepare("SELECT * FROM records WHERE submission_id = ?").all("sub-2");
    expect(rows).toHaveLength(1);
  });

  it("兩個幾乎同時的 finalize 請求（同一 submissionId）並行送出時，仍只會有一筆正式紀錄", async () => {
    const { database, raw } = createSqliteDatabase();
    const results = await Promise.all([
      insertFinalizedRecord(database, { ...baseInput, submissionId: "sub-concurrent" }),
      insertFinalizedRecord(database, { ...baseInput, submissionId: "sub-concurrent" }),
      insertFinalizedRecord(database, { ...baseInput, submissionId: "sub-concurrent" }),
    ]);

    const appliedCount = results.filter((r) => r.applied).length;
    expect(appliedCount).toBe(1); // exactly one caller "won" the insert

    const rows = raw.prepare("SELECT * FROM records WHERE submission_id = ?").all("sub-concurrent");
    expect(rows).toHaveLength(1);
  });

  it("不同 submissionId 各自都能成功寫入（唯一性索引不會誤擋不同的送出）", async () => {
    const { database, raw } = createSqliteDatabase();
    await insertFinalizedRecord(database, { ...baseInput, submissionId: "sub-a" });
    await insertFinalizedRecord(database, { ...baseInput, submissionId: "sub-b" });

    const rows = raw.prepare("SELECT * FROM records").all();
    expect(rows).toHaveLength(2);
  });

  it("insertManualRecord（Manual Review 自評）不受 submission 唯一性限制，可重複多筆，submission_id 為 NULL", async () => {
    const { database, raw } = createSqliteDatabase();
    await insertManualRecord(database, baseInput);
    await insertManualRecord(database, baseInput);
    await insertManualRecord(database, baseInput);

    const rows = raw.prepare("SELECT * FROM records").all();
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.submission_id).toBeNull();
  });

  it("insertFinalizedRecord 遇到非唯一性衝突的其他錯誤時會往外拋出，不會被吞掉當作成功", async () => {
    const { database } = createSqliteDatabase();
    const brokenDatabase: SubmissionDatabase = {
      prepare: (sql: string) => database.prepare(sql.includes("INSERT INTO records") ? "INVALID SQL ;;;" : sql),
    };
    await expect(insertFinalizedRecord(brokenDatabase, { ...baseInput, submissionId: "sub-broken" })).rejects.toThrow();
  });
});
