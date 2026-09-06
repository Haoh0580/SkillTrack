import type { SubmissionRecord } from "@/features/practice/submission-record";

type BoundStatement = {
  run: () => Promise<unknown>;
  first: <T = unknown>() => Promise<T | null>;
  all: () => Promise<{ results: unknown[] }>;
};

export type SubmissionDatabase = {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => BoundStatement;
  };
};

/**
 * Additive, idempotent schema setup (same convention as lib/records/store.ts). The
 * submissions table itself is normally provisioned by a drizzle migration
 * (drizzle/0001_living_ink.sql), which predates user_id — this ALTER TABLE brings an
 * already-deployed table up to date without a separate migration-apply step, and is
 * a safe no-op everywhere else (CREATE TABLE IF NOT EXISTS covers a from-scratch DB).
 */
export async function ensureSubmissionsSchema(database: SubmissionDatabase): Promise<void> {
  await database
    .prepare(`CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY, problem_id TEXT NOT NULL, language TEXT NOT NULL, source TEXT NOT NULL,
      verdict TEXT NOT NULL, passed INTEGER NOT NULL, total INTEGER NOT NULL, elapsed_ms INTEGER,
      stdout TEXT, stderr TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`)
    .bind()
    .run();
  try {
    await database.prepare("ALTER TABLE submissions ADD COLUMN user_id TEXT").bind().run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("duplicate column")) throw error;
  }
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id)").bind().run();
}

export async function savePendingSubmission(
  database: SubmissionDatabase,
  record: SubmissionRecord,
) {
  await ensureSubmissionsSchema(database);
  await database
    .prepare(`INSERT INTO submissions (
      id, problem_id, language, source, verdict, passed, total,
      elapsed_ms, stdout, stderr, created_at, updated_at, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      record.id,
      record.problemId,
      record.language,
      record.source,
      record.verdict,
      record.passed,
      record.total,
      record.elapsedMs ?? null,
      record.stdout ?? null,
      record.stderr ?? null,
      record.createdAt,
      record.updatedAt,
      record.userId,
    )
    .run();
}

export async function saveJudgeResult(
  database: SubmissionDatabase,
  record: SubmissionRecord,
) {
  await database
    .prepare(`UPDATE submissions
      SET verdict = ?, passed = ?, total = ?, elapsed_ms = ?, stdout = ?, stderr = ?, updated_at = ?
      WHERE id = ?`)
    .bind(
      record.verdict,
      record.passed,
      record.total,
      record.elapsedMs ?? null,
      record.stdout ?? null,
      record.stderr ?? null,
      record.updatedAt,
      record.id,
    )
    .run();
}
