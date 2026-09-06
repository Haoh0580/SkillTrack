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
  status?: { id?: number };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
};

function genericFailure(request: CSharpJudgeRequest): SubmissionResult {
  return { id: crypto.randomUUID(), verdict: "runtime_error", passed: 0, total: request.tests.length, stderr: "判題服務暫時無法使用，請稍後再試。" };
}

function normalizeOutput(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trimEnd();
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
              stdin: testCase.input,
              cpu_time_limit: request.timeLimitMs / 1000,
              memory_limit: request.memoryLimitMb * 1024,
            }),
          });
        } catch {
          return genericFailure(request);
        }
        if (!response.ok) return genericFailure(request);

        let execution: Judge0Response;
        try {
          execution = await response.json() as Judge0Response;
        } catch {
          return genericFailure(request);
        }
        totalElapsedMs += elapsedMilliseconds(execution.time);
        const status = execution.status?.id;
        if (status === 5) {
          return { id: crypto.randomUUID(), verdict: "time_limit", passed, total: request.tests.length, elapsedMs: totalElapsedMs, stderr: "程式超過時間限制。" };
        }
        if (status !== 3) {
          return {
            id: crypto.randomUUID(),
            verdict: "runtime_error",
            passed,
            total: request.tests.length,
            elapsedMs: totalElapsedMs,
            stderr: execution.compile_output ?? execution.stderr ?? execution.message ?? "程式無法完成執行。",
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
