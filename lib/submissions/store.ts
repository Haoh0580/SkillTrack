import type { SubmissionRecord } from "@/features/practice/submission-record";

type BoundStatement = {
  run: () => Promise<unknown>;
};

export type SubmissionDatabase = {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => BoundStatement;
  };
};

export async function savePendingSubmission(
  database: SubmissionDatabase,
  record: SubmissionRecord,
) {
  await database
    .prepare(`INSERT INTO submissions (
      id, problem_id, language, source, verdict, passed, total,
      elapsed_ms, stdout, stderr, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
