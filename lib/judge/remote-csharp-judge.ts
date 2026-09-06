import type { SubmissionResult } from "@/features/practice/domain";
import type { CSharpJudge, CSharpJudgeRequest } from "./types";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type RemoteJudgeConfig = {
  endpoint: string;
  apiKey?: string;
  fetcher?: Fetcher;
};

const supportedVerdicts = new Set<SubmissionResult["verdict"]>([
  "accepted",
  "wrong_answer",
  "runtime_error",
  "time_limit",
]);

function unavailableResult(request: CSharpJudgeRequest): SubmissionResult {
  return {
    id: crypto.randomUUID(),
    verdict: "runtime_error",
    passed: 0,
    total: request.tests.length,
    stderr: "遠端判題服務暫時無法使用，請稍後再試。",
  };
}

function parseResult(payload: unknown, request: CSharpJudgeRequest): SubmissionResult {
  if (!payload || typeof payload !== "object") return unavailableResult(request);
  const response = payload as Partial<SubmissionResult>;
  if (!response.verdict || !supportedVerdicts.has(response.verdict)) return unavailableResult(request);

  return {
    id: crypto.randomUUID(),
    verdict: response.verdict,
    passed: typeof response.passed === "number" ? response.passed : 0,
    total: typeof response.total === "number" ? response.total : request.tests.length,
    elapsedMs: typeof response.elapsedMs === "number" ? response.elapsedMs : undefined,
    stdout: typeof response.stdout === "string" ? response.stdout : undefined,
    stderr: typeof response.stderr === "string" ? response.stderr : undefined,
  };
}

export function createRemoteCSharpJudge(config: RemoteJudgeConfig): CSharpJudge {
  const fetcher = config.fetcher ?? fetch;

  return {
    async run(request) {
      try {
        const response = await fetcher(config.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify({
            language: "csharp",
            source: request.source,
            tests: request.tests,
            timeLimitMs: request.timeLimitMs,
            memoryLimitMb: request.memoryLimitMb,
          }),
        });
        if (!response.ok) return unavailableResult(request);
        return parseResult(await response.json(), request);
      } catch {
        return unavailableResult(request);
      }
    },
  };
}
