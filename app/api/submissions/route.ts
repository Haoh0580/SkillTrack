import type { SubmissionRequest, SubmissionResponse, SubmissionResult } from "@/features/practice/domain";
import { applyJudgeResult, createPendingSubmission, deriveTrainingOutcome } from "@/features/practice/submission-record";
import { getCSharpJudge } from "@/lib/judge/csharp-judge";
import { getSubmissionDatabase } from "@/lib/runtime/database";
import { saveJudgeResult, savePendingSubmission } from "@/lib/submissions/store";
import { insertFinalizedRecord } from "@/lib/records/store";
import { getJudgeTestCases } from "@/features/practice/judge-test-cases";

// Purely a display value (feeds the "本週練習時數" stat) — clamped so a bogus client
// value can't blow up that stat, but it never influences verdict, score, or the radar.
const MAX_ELAPSED_SECONDS = 4 * 60 * 60;

export async function POST(request: Request) {
  const body = await request.json() as Partial<SubmissionRequest>;
  if (!body.problemId || !body.source || body.language !== "csharp") {
    return Response.json({ error: "題目、語言與程式碼不可空白" }, { status: 400 });
  }
  const database = getSubmissionDatabase();
  const submittedAt = new Date().toISOString();
  const pending = createPendingSubmission({
    id: crypto.randomUUID(),
    problemId: body.problemId,
    language: body.language,
    source: body.source,
    now: submittedAt,
  });
  await savePendingSubmission(database, pending);

  const staticTests = getJudgeTestCases(body.problemId);
  // The published-draft lookup only ever has rows for AI-generated problems; for the
  // official 112/113/114 problem IDs it's a guaranteed miss, so failures there (or in
  // non-Workers environments) must not take down submission handling.
  const tests = staticTests.length
    ? staticTests
    : await import("@/lib/problem-generation/problem-store").then((m) => m.getPublishedTests(body.problemId!)).catch(() => []);

  // A judge adapter with zero test cases would vacuously report "accepted" (an empty
  // loop over no tests never fails). Treat "no verified test data yet" as
  // judge_not_configured so the workspace falls back to the manual confirm step
  // instead of silently marking every submission correct.
  const result: SubmissionResult = tests.length
    ? await getCSharpJudge().run({
        problemId: body.problemId,
        source: body.source,
        tests,
        timeLimitMs: 2000,
        memoryLimitMb: 256,
      })
    : { id: crypto.randomUUID(), verdict: "judge_not_configured", passed: 0, total: 0, stderr: "此題尚未提供可自動評測的測試資料，請在下方確認作答結果。" };

  const completed = applyJudgeResult(pending, { ...result, id: pending.id }, new Date().toISOString());
  await saveJudgeResult(database, completed);

  // Server-authoritative finalization. The browser never decides whether this
  // submission scores or what the score is — that happens here, from the verdict the
  // server itself just produced, using the exact same formula the client used to
  // compute (see deriveTrainingOutcome). Manual Review (judge_not_configured) and
  // judge_unavailable are excluded by construction: deriveTrainingOutcome returns
  // null for both, so neither can ever write a training record from this path.
  const outcome = deriveTrainingOutcome(completed);
  let finalized = false;
  if (outcome) {
    const rawSeconds = body.elapsedSeconds;
    const elapsedSeconds = typeof rawSeconds === "number" && Number.isFinite(rawSeconds) && rawSeconds >= 0
      ? Math.min(rawSeconds, MAX_ELAPSED_SECONDS)
      : 0;
    const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    try {
      // Idempotent by completed.id: a retry (client, network, or Cloudflare-level)
      // hitting this same submission can never double-score it — see
      // lib/records/store.ts. Whether this call just inserted the record or found it
      // already there, the end state is "finalized", so both count as success here.
      await insertFinalizedRecord(database, {
        resourceId: completed.problemId,
        score: outcome.score,
        minutes,
        status: outcome.status,
        notes: `送出評測自動回填（${completed.passed}/${completed.total} 測資，判定 ${completed.verdict}）`,
        submissionId: completed.id,
      });
      finalized = true;
    } catch (error) {
      // Persistence failed for a reason other than "already recorded" (e.g. a
      // transient D1 error). The judge verdict is already durably saved on the
      // submissions row above — recovery only needs to retry writing the record from
      // that stored verdict, never re-run the student's code against Judge0. This
      // phase does not add an automatic background retry; the honest answer here is
      // "not finalized", not a fabricated success.
      console.error("[/api/submissions] failed to persist training record", error);
      finalized = false;
    }
  }

  const response: SubmissionResponse = {
    id: completed.id,
    problemId: completed.problemId,
    verdict: completed.verdict,
    passed: completed.passed,
    total: completed.total,
    elapsedMs: completed.elapsedMs,
    stdout: completed.stdout,
    stderr: completed.stderr,
    score: outcome?.score,
    status: outcome?.status,
    finalized,
  };

  // judge_not_configured (Manual Review) and judge_unavailable (upstream judge
  // failed) never produced a real verdict — 503. A scoreable verdict whose record
  // persistence failed is a server-side problem, not a client error — 502. Otherwise
  // a real, fully finalized verdict — 200.
  const noVerdictProduced = completed.verdict === "judge_not_configured" || completed.verdict === "judge_unavailable";
  const status = noVerdictProduced ? 503 : outcome && !finalized ? 502 : 200;
  return Response.json(response, { status });
}
