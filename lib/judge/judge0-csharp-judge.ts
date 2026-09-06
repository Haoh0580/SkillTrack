import type { SubmissionResult } from "@/features/practice/domain";
import type { CSharpJudge, CSharpJudgeRequest } from "./types";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type Judge0Config = {
  endpoint: string;
  csharpLanguageId: number;
  apiKey?: string;
  /** Extra headers merged in after the apiKey-derived X-Auth-Token header, e.g. the
   * X-RapidAPI-Key / X-RapidAPI-Host pair required by Judge0 CE hosted on RapidAPI. */
  headers?: Record<string, string>;
  fetcher?: Fetcher;
};

type Judge0Response = {
  status?: { id?: number; description?: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
};

// Judge0 status IDs (https://ce.judge0.com/ "About"): 1/2 are in-progress states that
// never reach us here because we call with wait=true. 3=Accepted, 4=Wrong Answer (we
// don't use Judge0's own comparison, so this shouldn't occur), 5=Time Limit Exceeded,
// 6=Compilation Error, 7-12=various Runtime Error causes, 13=Internal Error,
// 14=Exec Format Error. 13/14 are Judge0's own infrastructure failing, not the
// student's program, so they must not be reported as the student's fault.
const JUDGE0_STATUS = { ACCEPTED: 3, TIME_LIMIT_EXCEEDED: 5, COMPILATION_ERROR: 6 } as const;
const JUDGE0_INTERNAL_FAILURE_STATUSES = new Set([13, 14]);

/**
 * The judge attempted to run a validated problem, but the upstream execution
 * service itself failed — never a verdict on the student's code. Must never
 * score or update the ability radar; the caller/route treats this the same as
 * Manual Review for persistence purposes (i.e. it doesn't persist a score).
 */
function judgeUnavailable(request: CSharpJudgeRequest, reason: string): SubmissionResult {
  return { id: crypto.randomUUID(), verdict: "judge_unavailable", passed: 0, total: request.tests.length, stderr: reason };
}

function normalizeOutput(value: string | null | undefined): string {
  // Allowed normalization per project convention: CRLF -> LF, trailing whitespace
  // stripped per line, and trailing blank lines collapsed. Deliberately NOT doing:
  // case-insensitive compare, mid-line whitespace collapsing, leading-whitespace
  // trimming, numeric parsing, or floating-point tolerance — those would hide real
  // formatting mistakes a student should be told about.
  const unified = (value ?? "").replace(/\r\n/g, "\n");
  const trimmedLines = unified.split("\n").map((line) => line.replace(/[ \t]+$/, ""));
  return trimmedLines.join("\n").replace(/\n+$/, "");
}

function elapsedMilliseconds(time: string | null | undefined) {
  const seconds = Number(time);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0;
}

export function createJudge0CSharpJudge(config: Judge0Config): CSharpJudge {
  const fetcher = config.fetcher ?? fetch;
  const url = `${config.endpoint.replace(/\/$/, "")}/submissions?base64_encoded=false&wait=true`;

  return {
    async run(request) {
      let passed = 0;
      let totalElapsedMs = 0;

      for (const testCase of request.tests) {
        let response: Response;
        try {
          response = await fetcher(url, {
            method: "POST",
            headers: { "content-type": "application/json", ...(config.apiKey ? { "X-Auth-Token": config.apiKey } : {}), ...config.headers },
            body: JSON.stringify({
              source_code: request.source,
              language_id: config.csharpLanguageId,
              // stdin is forwarded exactly as stored in the test case — never trimmed
              // or normalized. "abc\n" (EOF on the next ReadLine) and "abc\n\n" (a
              // genuinely empty next line) are different inputs and must stay that way.
              stdin: testCase.input,
              cpu_time_limit: request.timeLimitMs / 1000,
              memory_limit: request.memoryLimitMb * 1024,
            }),
          });
        } catch {
          return judgeUnavailable(request, "判題服務暫時無法連線，請稍後再試，本次不計入成績。");
        }
        if (!response.ok) {
          return judgeUnavailable(request, "判題服務暫時無法使用，請稍後再試，本次不計入成績。");
        }

        let execution: Judge0Response;
        try {
          execution = await response.json() as Judge0Response;
        } catch {
          return judgeUnavailable(request, "判題服務回傳格式異常，請稍後再試，本次不計入成績。");
        }
        totalElapsedMs += elapsedMilliseconds(execution.time);
        const status = execution.status?.id;

        if (status === JUDGE0_STATUS.TIME_LIMIT_EXCEEDED) {
          return { id: crypto.randomUUID(), verdict: "time_limit", passed, total: request.tests.length, elapsedMs: totalElapsedMs, stderr: "程式超過時間限制。" };
        }
        if (status === JUDGE0_STATUS.COMPILATION_ERROR) {
          return { id: crypto.randomUUID(), verdict: "compilation_error", passed, total: request.tests.length, elapsedMs: totalElapsedMs, stderr: execution.compile_output ?? "編譯失敗。" };
        }
        if (status !== undefined && JUDGE0_INTERNAL_FAILURE_STATUSES.has(status)) {
          return judgeUnavailable(request, `判題服務內部錯誤（${execution.status?.description ?? status}），本次不計入成績。`);
        }
        if (status !== JUDGE0_STATUS.ACCEPTED) {
          return {
            id: crypto.randomUUID(),
            verdict: "runtime_error",
            passed,
            total: request.tests.length,
            elapsedMs: totalElapsedMs,
            stderr: execution.stderr ?? execution.message ?? "程式無法完成執行。",
          };
        }
        if (normalizeOutput(execution.stdout) !== normalizeOutput(testCase.expectedOutput)) {
          return { id: crypto.randomUUID(), verdict: "wrong_answer", passed, total: request.tests.length, elapsedMs: totalElapsedMs, stdout: execution.stdout ?? "" };
        }
        passed += 1;
      }

      return { id: crypto.randomUUID(), verdict: "accepted", passed, total: request.tests.length, elapsedMs: totalElapsedMs };
    },
  };
}
