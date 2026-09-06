import type { SubmissionDatabase } from "@/lib/submissions/store";

export type RecordInput = {
  resourceId: string;
  score: number;
  minutes: number;
  status: string;
  notes: string;
  /** The student who owns this record — resolved server-side, never from client body. */
  userId: string;
};

const UNIQUE_CONSTRAINT_MARKER = "UNIQUE constraint failed";

/**
 * Additive, idempotent schema setup for the `records` table. Safe to call on every
 * request: CREATE TABLE / CREATE INDEX use IF NOT EXISTS, and each ADD COLUMN (needed
 * because older deployments created this table before submission_id/user_id existed)
 * is wrapped to ignore the "column already exists" error on repeat runs.
 *
 * submission_id is nullable — legacy/manual records (Manual Review self-reports, the
 * old dashboard backfill modal) have none. The partial UNIQUE index only constrains
 * non-null values, so it enforces "at most one formal record per submission" without
 * restricting how many manual records can exist.
 *
 * user_id is nullable for the same reason (rows written before Phase 5). Under
 * per-user filtering (WHERE user_id = ?), a NULL user_id row matches no one's
 * query — it becomes permanently invisible rather than "everyone's" by accident.
 * See the Phase 5 report's Migration Strategy for why that's the deliberate choice.
 */
export async function ensureRecordsSchema(database: SubmissionDatabase): Promise<void> {
  await database
    .prepare("CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, resource_id TEXT, score INTEGER, minutes INTEGER, status TEXT, notes TEXT, created_at TEXT)")
    .bind()
    .run();
  for (const column of ["submission_id", "user_id"]) {
    try {
      await database.prepare(`ALTER TABLE records ADD COLUMN ${column} TEXT`).bind().run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("duplicate column")) throw error;
    }
  }
  await database
    .prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_records_submission_id ON records(submission_id) WHERE submission_id IS NOT NULL")
    .bind()
    .run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_records_user_id ON records(user_id)").bind().run();
}

/**
 * Insert the formal training record produced by finalizing a validated Submit.
 * Idempotent by submissionId: if a record for this submission already exists (this
 * call already ran once, or ran concurrently on another request), the UNIQUE index
 * rejects the second insert and this returns `applied: false` instead of throwing —
 * a second scoring side effect for the same submission can never happen, no matter
 * how many times finalize is retried (client retry, network retry, Cloudflare retry).
 *
 * Any other database error (not a uniqueness conflict) propagates to the caller,
 * which must not report success to the browser when this throws.
 */
export async function insertFinalizedRecord(
  database: SubmissionDatabase,
  input: RecordInput & { submissionId: string },
): Promise<{ applied: boolean }> {
  await ensureRecordsSchema(database);
  try {
    await database
      .prepare("INSERT INTO records (id, resource_id, score, minutes, status, notes, created_at, submission_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), input.resourceId, input.score, input.minutes, input.status, input.notes, new Date().toISOString(), input.submissionId, input.userId)
      .run();
    return { applied: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(UNIQUE_CONSTRAINT_MARKER)) return { applied: false };
    throw error;
  }
}

/** Manual Review / legacy backfill: a self-reported record with no backing submission. */
export async function insertManualRecord(database: SubmissionDatabase, input: RecordInput): Promise<void> {
  await ensureRecordsSchema(database);
  await database
    .prepare("INSERT INTO records (id, resource_id, score, minutes, status, notes, created_at, submission_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)")
    .bind(crypto.randomUUID(), input.resourceId, input.score, input.minutes, input.status, input.notes, new Date().toISOString(), input.userId)
    .run();
}

/**
 * The dashboard/radar's only view into `records` — always scoped to one student.
 * There is deliberately no "get all records" query left in the codebase for this
 * table: every read of training history goes through here.
 */
export async function getRecordsForUser(database: SubmissionDatabase, userId: string): Promise<unknown[]> {
  await ensureRecordsSchema(database);
  const result = await database.prepare("SELECT * FROM records WHERE user_id = ? ORDER BY created_at").bind(userId).all();
  return result.results;
}

/** Manual Review reset ("重設練習紀錄") — scoped to one student, never the whole table. */
export async function deleteRecordsForUser(database: SubmissionDatabase, userId: string): Promise<void> {
  await ensureRecordsSchema(database);
  await database.prepare("DELETE FROM records WHERE user_id = ?").bind(userId).run();
}
