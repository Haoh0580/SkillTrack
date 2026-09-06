import type { SubmissionRequest, SubmissionResult } from "@/features/practice/domain";
import { applyJudgeResult, createPendingSubmission } from "@/features/practice/submission-record";
import { getCSharpJudge } from "@/lib/judge/csharp-judge";
import { getSubmissionDatabase } from "@/lib/runtime/database";
import { saveJudgeResult, savePendingSubmission } from "@/lib/submissions/store";
import { getJudgeTestCases } from "@/features/practice/judge-test-cases";

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
  // judge_not_configured (Manual Review) and judge_unavailable (upstream judge failed)
  // are both "no real verdict was produced" — 503 signals that at the HTTP level too.
  const noVerdictProduced = result.verdict === "judge_not_configured" || result.verdict === "judge_unavailable";
  return Response.json(completed, { status: noVerdictProduced ? 503 : 200 });
}
