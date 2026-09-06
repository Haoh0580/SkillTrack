import type { SubmissionRequest, SubmissionResult } from "./domain";

export type SubmissionRecord = SubmissionResult & {
  problemId: string;
  language: SubmissionRequest["language"];
  source: string;
  createdAt: string;
  updatedAt: string;
};

type PendingSubmissionInput = SubmissionRequest & {
  id: string;
  now: string;
};

export function createPendingSubmission(input: PendingSubmissionInput): SubmissionRecord {
  return {
    id: input.id,
    problemId: input.problemId,
    language: input.language,
    source: input.source,
    verdict: "queued",
    passed: 0,
    total: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function applyJudgeResult(
  record: SubmissionRecord,
  result: SubmissionResult,
  updatedAt: string,
): SubmissionRecord {
  return {
    ...record,
    verdict: result.verdict,
    passed: result.passed,
    total: result.total,
    elapsedMs: result.elapsedMs,
    stdout: result.stdout,
    stderr: result.stderr,
    updatedAt,
  };
}
