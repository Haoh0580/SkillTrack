import { env } from "cloudflare:workers";
import { createJudge0CSharpJudge } from "./judge0-csharp-judge";
import { createRemoteCSharpJudge } from "./remote-csharp-judge";
import { unavailableCSharpJudge } from "./unavailable-csharp-judge";
import type { CSharpJudge } from "./types";

type JudgeEnvironment = {
  JUDGE_PROVIDER?: "judge0" | "generic";
  JUDGE_ENDPOINT?: string;
  JUDGE_API_KEY?: string;
  JUDGE0_CSHARP_LANGUAGE_ID?: string;
};

export function getCSharpJudge(): CSharpJudge {
  const judgeEnvironment = env as unknown as JudgeEnvironment;
  if (!judgeEnvironment.JUDGE_ENDPOINT) return unavailableCSharpJudge;

  if (judgeEnvironment.JUDGE_PROVIDER === "judge0") {
    const csharpLanguageId = Number(judgeEnvironment.JUDGE0_CSHARP_LANGUAGE_ID);
    if (!Number.isInteger(csharpLanguageId) || csharpLanguageId <= 0) return unavailableCSharpJudge;
    return createJudge0CSharpJudge({
      endpoint: judgeEnvironment.JUDGE_ENDPOINT,
      csharpLanguageId,
      apiKey: judgeEnvironment.JUDGE_API_KEY,
    });
  }

  return createRemoteCSharpJudge({
    endpoint: judgeEnvironment.JUDGE_ENDPOINT,
    apiKey: judgeEnvironment.JUDGE_API_KEY,
  });
}
