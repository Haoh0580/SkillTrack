// Phase 1 "Run Code": a thin, ungraded pass-through to the public Judge0 CE
// instance. This is intentionally separate from /api/submissions, which
// compares output against stored test cases and produces a scored verdict.
// This route just runs whatever code the student has open and returns the
// raw result — no test cases, no accepted/wrong_answer judgement here.

const JUDGE0_RUN_ENDPOINT = "https://ce.judge0.com/submissions?wait=true";
const DEFAULT_LANGUAGE_ID = 51; // C# (Mono 6.6.0.161)
const REQUEST_TIMEOUT_MS = 20000;

type JudgeRunRequestBody = {
  source_code?: unknown;
  language_id?: unknown;
  stdin?: unknown;
};

type Judge0Status = { id?: number; description?: string };

export type JudgeRunResult = {
  status: Judge0Status | null;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null;
  memory: number | null;
};

function serviceUnavailable() {
  return Response.json({ error: "Execution service temporarily unavailable." }, { status: 502 });
}

export async function POST(request: Request) {
  let body: JudgeRunRequestBody;
  try {
    body = (await request.json()) as JudgeRunRequestBody;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const sourceCode = body.source_code;
  if (typeof sourceCode !== "string" || sourceCode.trim() === "") {
    return Response.json({ error: "source_code is required and must be a non-empty string." }, { status: 400 });
  }

  const languageId =
    typeof body.language_id === "number" && Number.isInteger(body.language_id) && body.language_id > 0
      ? body.language_id
      : DEFAULT_LANGUAGE_ID;
  const stdin = typeof body.stdin === "string" ? body.stdin : "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(JUDGE0_RUN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_code: sourceCode, language_id: languageId, stdin }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error("[/api/judge] Judge0 returned non-2xx", response.status, await response.text().catch(() => "<no body>"));
      return serviceUnavailable();
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      console.error("[/api/judge] Judge0 response was not valid JSON", error);
      return serviceUnavailable();
    }

    if (!payload || typeof payload !== "object") {
      console.error("[/api/judge] Judge0 response was not an object", payload);
      return serviceUnavailable();
    }

    const raw = payload as Record<string, unknown>;
    const status = raw.status && typeof raw.status === "object" ? (raw.status as Judge0Status) : null;
    const result: JudgeRunResult = {
      status,
      stdout: typeof raw.stdout === "string" ? raw.stdout : null,
      stderr: typeof raw.stderr === "string" ? raw.stderr : null,
      compile_output: typeof raw.compile_output === "string" ? raw.compile_output : null,
      message: typeof raw.message === "string" ? raw.message : null,
      time: typeof raw.time === "string" ? raw.time : null,
      memory: typeof raw.memory === "number" ? raw.memory : null,
    };
    return Response.json(result);
  } catch (error) {
    console.error("[/api/judge] Request to Judge0 failed", error);
    return serviceUnavailable();
  } finally {
    clearTimeout(timeout);
  }
}
