import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import type { SubmissionDatabase } from "@/lib/submissions/store";
import { deleteRecordsForUser, ensureRecordsSchema, getRecordsForUser, insertFinalizedRecord, insertManualRecord } from "@/lib/records/store";

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
          const params = values as (string | number | bigint | null)[];
          return {
            async run() { raw.prepare(sql).run(...params); return undefined; },
            async first<T>() { return (raw.prepare(sql).get(...params) as T | undefined) ?? null; },
            async all() { return { results: raw.prepare(sql).all(...params) }; },
          };
        },
      };
    },
  };
  return { database, raw };
}

const baseInput = { resourceId: "112-2", score: 100, minutes: 5, status: "完成", notes: "test", userId: "user-a" };

describe("lib/records/store — 正式成績寫入與冪等性", () => {
  it("ensureRecordsSchema 可重複呼叫而不出錯（額外欄位與索引都是 idempotent）", async () => {
    const { database } = createSqliteDatabase();
    await ensureRecordsSchema(database);
    await ensureRecordsSchema(database);
    await ensureRecordsSchema(database);
  });

  it("insertFinalizedRecord 第一次寫入回報 applied:true，且實際寫入一筆資料（含 user_id）", async () => {
    const { database, raw } = createSqliteDatabase();
    const result = await insertFinalizedRecord(database, { ...baseInput, submissionId: "sub-1" });
    expect(result).toEqual({ applied: true });
    const rows = raw.prepare("SELECT * FROM records").all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ resource_id: "112-2", score: 100, submission_id: "sub-1", user_id: "user-a" });
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

  it("insertManualRecord（Manual Review 自評）不受 submission 唯一性限制，可重複多筆，submission_id 為 NULL，但仍記錄 user_id", async () => {
    const { database, raw } = createSqliteDatabase();
    await insertManualRecord(database, baseInput);
    await insertManualRecord(database, baseInput);
    await insertManualRecord(database, baseInput);

    const rows = raw.prepare("SELECT * FROM records").all();
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.submission_id).toBeNull();
      expect(row.user_id).toBe("user-a");
    }
  });

  it("insertFinalizedRecord 遇到非唯一性衝突的其他錯誤時會往外拋出，不會被吞掉當作成功", async () => {
    const { database } = createSqliteDatabase();
    const brokenDatabase: SubmissionDatabase = {
      prepare: (sql: string) => database.prepare(sql.includes("INSERT INTO records") ? "INVALID SQL ;;;" : sql),
    };
    await expect(insertFinalizedRecord(brokenDatabase, { ...baseInput, submissionId: "sub-broken" })).rejects.toThrow();
  });
});

describe("lib/records/store — per-user 資料邊界（Phase 5）", () => {
  it("getRecordsForUser 只回傳該使用者自己的紀錄，看不到其他使用者的（U3/U4 對應的 store 層驗證）", async () => {
    const { database } = createSqliteDatabase();
    await insertFinalizedRecord(database, { ...baseInput, userId: "user-a", submissionId: "sub-a1" });
    await insertFinalizedRecord(database, { resourceId: "113-1", score: 0, minutes: 3, status: "未完成", notes: "b", userId: "user-b", submissionId: "sub-b1" });

    const aRecords = await getRecordsForUser(database, "user-a") as { user_id: string; submission_id: string }[];
    const bRecords = await getRecordsForUser(database, "user-b") as { user_id: string; submission_id: string }[];

    expect(aRecords).toHaveLength(1);
    expect(aRecords[0].submission_id).toBe("sub-a1");
    expect(bRecords).toHaveLength(1);
    expect(bRecords[0].submission_id).toBe("sub-b1");
  });

  it("legacy 資料（user_id 為 NULL）不會出現在任何使用者的 getRecordsForUser 結果中", async () => {
    const { database, raw } = createSqliteDatabase();
    await ensureRecordsSchema(database);
    raw.prepare("INSERT INTO records (id, resource_id, score, minutes, status, notes, created_at, submission_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("legacy-1", "112-2", 100, 5, "完成", "", "2026-01-01T00:00:00.000Z", null, null);
    await insertFinalizedRecord(database, { ...baseInput, userId: "user-a", submissionId: "sub-a1" });

    const aRecords = await getRecordsForUser(database, "user-a");
    expect(aRecords).toHaveLength(1);
    // The legacy NULL-user row exists in the table but is invisible to every
    // per-user query — never "visible to anyone" by accident.
    const total = raw.prepare("SELECT COUNT(*) as n FROM records").get() as { n: number };
    expect(total.n).toBe(2);
  });

  it("deleteRecordsForUser 只刪除該使用者自己的紀錄，不影響其他使用者（U13-equivalent cross-user write protection at the store層）", async () => {
    const { database } = createSqliteDatabase();
    await insertFinalizedRecord(database, { ...baseInput, userId: "user-a", submissionId: "sub-a1" });
    await insertFinalizedRecord(database, { resourceId: "113-1", score: 0, minutes: 3, status: "未完成", notes: "b", userId: "user-b", submissionId: "sub-b1" });

    await deleteRecordsForUser(database, "user-a");

    expect(await getRecordsForUser(database, "user-a")).toHaveLength(0);
    expect(await getRecordsForUser(database, "user-b")).toHaveLength(1);
  });
});
