export type SupportedLanguage = "csharp";

export type SubmissionRequest = {
  problemId: string;
  language: SupportedLanguage;
  source: string;
  /**
   * How long the student spent in the workspace before submitting, in seconds.
   * Purely informational (feeds the "本週練習時數" stat) — the server clamps it and
   * never lets it influence verdict, score, or the ability radar, so a client lying
   * about this has no scoring impact.
   */
  elapsedSeconds?: number;
};

/**
 * Verdict taxonomy for the formal Submit pipeline.
 *
 * - "accepted" / "wrong_answer" / "compilation_error" / "runtime_error" / "time_limit":
 *   a real, completed judgement against validated test cases. These score and feed
 *   the ability radar.
 * - "judge_not_configured": Manual Review — this problem has no validated test cases
 *   (or no judge backend at all) yet, so the workspace falls back to a human
 *   self-report instead of pretending a real judgement happened.
 * - "judge_unavailable": the judge attempted to run a validated problem but the
 *   upstream execution service failed (network error, timeout, 5xx, malformed
 *   response, or the judge's own internal error). This is never a verdict on the
 *   student's code and must never score or update the radar.
 * - "queued": a pending submission record before the judge has responded.
 */
export type SubmissionVerdict =
  | "judge_not_configured"
  | "judge_unavailable"
  | "queued"
  | "accepted"
  | "wrong_answer"
  | "compilation_error"
  | "runtime_error"
  | "time_limit";

export type SubmissionResult = {
  id: string;
  verdict: SubmissionVerdict;
  passed: number;
  total: number;
  elapsedMs?: number;
  stdout?: string;
  stderr?: string;
};

/**
 * The server-authoritative response for a formal Submit. `score`/`status` are only
 * present when the verdict is scoreable (see isScoreableVerdict); `finalized`
 * distinguishes "training record written" from "we couldn't persist it" so the
 * browser never has to guess whether a real score actually landed.
 */
export type SubmissionResponse = {
  id: string;
  problemId: string;
  verdict: SubmissionVerdict;
  passed: number;
  total: number;
  elapsedMs?: number;
  stdout?: string;
  stderr?: string;
  score?: number;
  status?: string;
  finalized: boolean;
};
