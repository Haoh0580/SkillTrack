import type { SubmissionRequest, SubmissionResult } from "@/features/practice/domain";
import { applyJudgeResult, createPendingSubmission } from "@/features/practice/submission-record";
import { unavailableCSharpJudge } from "@/lib/judge/unavailable-csharp-judge";
import { getSubmissionDatabase } from "@/lib/runtime/database";
import { saveJudgeResult, savePendingSubmission } from "@/lib/submissions/store";

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

  const result: SubmissionResult = await unavailableCSharpJudge.run({ problemId: body.problemId, source: body.source, tests: [], timeLimitMs: 2000, memoryLimitMb: 256 });
  const completed = applyJudgeResult(pending, { ...result, id: pending.id }, new Date().toISOString());
  await saveJudgeResult(database, completed);
  return Response.json(completed, { status: 503 });
}
