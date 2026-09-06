import type { SubmissionRequest, SubmissionResult } from "./domain";

export type SubmissionRecord = SubmissionResult & {
  problemId: string;
  language: SubmissionRequest["language"];
  source: string;
  createdAt: string;
  updatedAt: string;
  /** The student who owns this submission — resolved server-side from the session
   * cookie (see lib/auth/current-user.ts), never from client-supplied input. */
  userId: string;
};

type PendingSubmissionInput = SubmissionRequest & {
  id: string;
  now: string;
  userId: string;
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
    userId: input.userId,
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

// A real, completed judgement against validated test cases — these are the only
// verdicts that produce a formal training record. "judge_not_configured" (Manual
// Review) and "judge_unavailable" (upstream judge failed) are deliberately excluded:
// neither is a verdict on the student's code, so neither may score.
const SCOREABLE_VERDICTS: SubmissionResult["verdict"][] = [
  "accepted",
  "wrong_answer",
  "compilation_error",
  "runtime_error",
  "time_limit",
];

export function isScoreableVerdict(verdict: SubmissionResult["verdict"]): boolean {
  return SCOREABLE_VERDICTS.includes(verdict);
}

export type TrainingOutcome = { score: number; status: string };

/**
 * The formal score/status rule for a judged submission. This is the same formula the
 * workspace used to compute client-side before Phase 4 — moved here so the server,
 * not the browser, is the one deciding whether a formal training record gets written
 * and what it says. The algorithm itself is unchanged.
 */
export function deriveTrainingOutcome(result: Pick<SubmissionResult, "verdict" | "passed">): TrainingOutcome | null {
  if (!isScoreableVerdict(result.verdict)) return null;
  const score = result.verdict === "accepted" ? 100 : 0;
  const status = result.verdict === "accepted" ? "完成" : result.passed > 0 ? "部分完成" : "未完成";
  return { score, status };
}
