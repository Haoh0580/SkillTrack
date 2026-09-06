import type { JudgeTestCase } from "@/lib/judge/types";

/**
 * "manual": no test cases exist yet — Submit always falls back to Manual Review.
 * "testing": test cases exist but haven't cleared validation yet (reference
 *   solution + boundary/mutation testing) — still must NOT be auto-judged.
 * "validated": reference solution passes all cases, and at least 3 distinct wrong
 *   solutions are each caught by at least one case — safe for real Auto Judge.
 *
 * getJudgeTestCases() is the single enforcement point: only a "validated" suite's
 * tests are ever handed to the judge adapter. Adding rows here with judgeMode
 * "testing" is fine for authoring/review; it has zero effect on Submit until
 * flipped to "validated".
 */
export type JudgeMode = "manual" | "testing" | "validated";

type ProblemTestSuite = { judgeMode: JudgeMode; tests: JudgeTestCase[] };

const testSuitesByProblem: Record<string, ProblemTestSuite> = {
  "112-2": {
    judgeMode: "validated",
    tests: [
      { input: "idea\ndeal", expectedOutput: "2", visibility: "public" },
      { input: "but\nbait", expectedOutput: "3", visibility: "public" },
      { input: "\nabc", expectedOutput: "3", visibility: "private" },
      // A second line that is genuinely empty needs its own trailing newline ("abc\n\n"),
      // not just "abc\n" — otherwise the second Console.ReadLine() hits real EOF and
      // returns null (not ""), crashing an otherwise-correct C# solution.
      { input: "abc\n\n", expectedOutput: "3", visibility: "private" },
      { input: "a\nb", expectedOutput: "2", visibility: "private" },
    ],
  },
  // 連分數計算器 — validated 2026-09-06. Reference solution (bottom-up recurrence,
  // long arithmetic) live-verified against ce.judge0.com: 5/5 accepted. Three wrong
  // solutions (off-by-one loop bound, sample-hardcoding, skipped middle term) were
  // each live-verified to fail at least one case below.
  "113-1": {
    judgeMode: "validated",
    tests: [
      // Normal cases — the two worked examples from the official 113 exam paper.
      { input: "1,2,3,4", expectedOutput: "43/30", visibility: "public" },
      { input: "5,5,5,5", expectedOutput: "701/135", visibility: "public" },
      // Boundary: minimum length (n=1, i.e. 2 terms).
      { input: "1,1", expectedOutput: "2/1", visibility: "private" },
      // Boundary/special: maximum length (9 terms), all-ones — a Fibonacci-ratio
      // pattern distinct in shape from the all-fives normal case above.
      { input: "1,1,1,1,1,1,1,1,1", expectedOutput: "55/34", visibility: "private" },
      // Non-sample: a value the student never sees in the problem statement, so a
      // solution that only special-cases the two visible samples cannot pass.
      { input: "1,1,1,1,1,2", expectedOutput: "21/13", visibility: "private" },
    ],
  },
  // 計算族譜上"代"數距離 (tree diameter) — validated 2026-09-06. Reference solution
  // (two-pass BFS) live-verified against ce.judge0.com: 5/5 accepted. Three wrong
  // solutions (off-by-one edge/node count, sample-hardcoding, single-BFS-pass
  // shortcut) were each live-verified to fail at least one case below.
  "114-3": {
    judgeMode: "validated",
    tests: [
      // Normal cases — the two worked examples from the official 114 exam paper.
      { input: "8\n7 4\n7 5\n7 6\n8 7\n6 3\n4 1\n4 2", expectedOutput: "4", visibility: "public" },
      { input: "4\n1 2\n1 3\n3 4", expectedOutput: "3", visibility: "public" },
      // Boundary: a single node has no edges and a diameter of 0.
      { input: "1", expectedOutput: "0", visibility: "private" },
      // Special shape: a star graph. Catches solutions that assume the tree is a
      // simple chain, or that only run BFS once from an arbitrary root.
      { input: "5\n1 2\n1 3\n1 4\n1 5", expectedOutput: "2", visibility: "private" },
      // Non-sample: a straight path (the tree's worst case for diameter == N-1).
      { input: "5\n1 2\n2 3\n3 4\n4 5", expectedOutput: "4", visibility: "private" },
    ],
  },
};

export function getJudgeTestCases(problemId: string): JudgeTestCase[] {
  const suite = testSuitesByProblem[problemId];
  return suite && suite.judgeMode === "validated" ? suite.tests : [];
}

export function getJudgeMode(problemId: string): JudgeMode {
  return testSuitesByProblem[problemId]?.judgeMode ?? "manual";
}
