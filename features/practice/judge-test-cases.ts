import type { JudgeTestCase } from "@/lib/judge/types";

const testCasesByProblem: Record<string, JudgeTestCase[]> = {
  "112-2": [
    { input: "idea\ndeal", expectedOutput: "2", visibility: "public" },
    { input: "but\nbait", expectedOutput: "3", visibility: "public" },
    { input: "\nabc", expectedOutput: "3", visibility: "private" },
    { input: "abc\n", expectedOutput: "3", visibility: "private" },
    { input: "a\nb", expectedOutput: "2", visibility: "private" },
  ],
};

export function getJudgeTestCases(problemId: string): JudgeTestCase[] {
  return testCasesByProblem[problemId] ?? [];
}
