import type { SubmissionResult } from "@/features/practice/domain";

export type JudgeTestCase = { input: string; expectedOutput: string; visibility: "public" | "private" };

export type CSharpJudgeRequest = {
  problemId: string;
  source: string;
  tests: JudgeTestCase[];
  timeLimitMs: number;
  memoryLimitMb: number;
};

export interface CSharpJudge {
  run(request: CSharpJudgeRequest): Promise<SubmissionResult>;
}
