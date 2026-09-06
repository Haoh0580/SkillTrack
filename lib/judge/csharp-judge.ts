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
  /** Set when using the RapidAPI-hosted Judge0 CE instead of a self-hosted one; it
   * needs X-RapidAPI-Key / X-RapidAPI-Host headers instead of X-Auth-Token. */
  JUDGE0_RAPIDAPI_KEY?: string;
  JUDGE0_RAPIDAPI_HOST?: string;
};

const DEFAULT_JUDGE0_RAPIDAPI_ENDPOINT = "https://judge0-ce.p.rapidapi.com";
const DEFAULT_JUDGE0_RAPIDAPI_HOST = "judge0-ce.p.rapidapi.com";

export function getCSharpJudge(): CSharpJudge {
  const judgeEnvironment = env as unknown as JudgeEnvironment;

  if (judgeEnvironment.JUDGE0_RAPIDAPI_KEY) {
    const csharpLanguageId = Number(judgeEnvironment.JUDGE0_CSHARP_LANGUAGE_ID ?? 51);
    if (!Number.isInteger(csharpLanguageId) || csharpLanguageId <= 0) return unavailableCSharpJudge;
    return createJudge0CSharpJudge({
      endpoint: judgeEnvironment.JUDGE_ENDPOINT ?? DEFAULT_JUDGE0_RAPIDAPI_ENDPOINT,
      csharpLanguageId,
      headers: {
        "X-RapidAPI-Key": judgeEnvironment.JUDGE0_RAPIDAPI_KEY,
        "X-RapidAPI-Host": judgeEnvironment.JUDGE0_RAPIDAPI_HOST ?? DEFAULT_JUDGE0_RAPIDAPI_HOST,
      },
    });
  }

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
