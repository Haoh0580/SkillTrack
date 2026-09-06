import type { SubmissionRequest, SubmissionResult } from "@/features/practice/domain";

export async function POST(request: Request) {
  const body = await request.json() as Partial<SubmissionRequest>;
  if (!body.problemId || !body.source || body.language !== "csharp") {
    return Response.json({ error: "題目、語言與程式碼不可空白" }, { status: 400 });
  }
  const result: SubmissionResult = { id: crypto.randomUUID(), verdict: "judge_not_configured", passed: 0, total: 0 };
  return Response.json(result, { status: 503 });
}
