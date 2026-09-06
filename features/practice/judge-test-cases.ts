import type { JudgeTestCase } from "@/lib/judge/types";

const testCasesByProblem: Record<string, JudgeTestCase[]> = {
  "112-2": [
    { input: "idea\ndeal", expectedOutput: "2", visibility: "public" },
    { input: "but\nbait", expectedOutput: "3", visibility: "public" },
    { input: "\nabc", expectedOutput: "3", visibility: "private" },
    // A second line that is genuinely empty needs its own trailing newline ("abc\n\n"),
    // not just "abc\n" — otherwise the second Console.ReadLine() hits real EOF and
    // returns null (not ""), crashing an otherwise-correct C# solution.
    { input: "abc\n\n", expectedOutput: "3", visibility: "private" },
    { input: "a\nb", expectedOutput: "2", visibility: "private" },
  ],
};

export function getJudgeTestCases(problemId: string): JudgeTestCase[] {
  return testCasesByProblem[problemId] ?? [];
}
