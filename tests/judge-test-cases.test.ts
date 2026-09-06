import { describe, expect, it } from "vitest";
import { getJudgeTestCases } from "@/features/practice/judge-test-cases";

describe("判題測資資料", () => {
  it("112-2 提供可直接交給 C# 判題器的公開與私有測資", () => {
    const tests = getJudgeTestCases("112-2");

    expect(tests).toEqual(expect.arrayContaining([
      expect.objectContaining({ input: "idea\ndeal", expectedOutput: "2", visibility: "public" }),
      expect.objectContaining({ input: "\nabc", expectedOutput: "3", visibility: "private" }),
    ]));
    expect(tests.some((testCase) => testCase.visibility === "private")).toBe(true);
  });

  it("尚未整理測資的題目不會被送到判題器", () => {
    expect(getJudgeTestCases("114-1")).toEqual([]);
  });
});
