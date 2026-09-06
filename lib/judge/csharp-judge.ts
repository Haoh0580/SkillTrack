import { env } from "cloudflare:workers";
import { createRemoteCSharpJudge } from "./remote-csharp-judge";
import { unavailableCSharpJudge } from "./unavailable-csharp-judge";
import type { CSharpJudge } from "./types";

type JudgeEnvironment = {
  JUDGE_ENDPOINT?: string;
  JUDGE_API_KEY?: string;
};

export function getCSharpJudge(): CSharpJudge {
  const judgeEnvironment = env as unknown as JudgeEnvironment;
  if (!judgeEnvironment.JUDGE_ENDPOINT) return unavailableCSharpJudge;

  return createRemoteCSharpJudge({
    endpoint: judgeEnvironment.JUDGE_ENDPOINT,
    apiKey: judgeEnvironment.JUDGE_API_KEY,
  });
}
