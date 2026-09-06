import type { CSharpJudge } from "./types";

export const unavailableCSharpJudge: CSharpJudge = {
  async run() {
    return { id: crypto.randomUUID(), verdict: "judge_not_configured", passed: 0, total: 0 };
  },
};
