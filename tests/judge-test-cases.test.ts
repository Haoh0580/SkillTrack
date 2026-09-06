import { describe, expect, it } from "vitest";
import { getJudgeMode, getJudgeTestCases } from "@/features/practice/judge-test-cases";
import { questions } from "@/app/lib/questions";

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

  it("getJudgeMode 對未收錄的題目回報 manual", () => {
    expect(getJudgeMode("112-1")).toBe("manual");
    expect(getJudgeMode("999-99")).toBe("manual");
  });

  it("只有 judgeMode 為 validated 的題目會回傳測資 —— 對全部 18 題歷屆題庫逐一驗證這個不變式", () => {
    const historical = questions.filter((question) => /^\d{3}-\d+$/.test(question.id));
    expect(historical.length).toBeGreaterThan(0);
    for (const question of historical) {
      const mode = getJudgeMode(question.id);
      const tests = getJudgeTestCases(question.id);
      if (mode === "validated") {
        expect(tests.length, `${question.id} 標記為 validated 應提供測資`).toBeGreaterThan(0);
      } else {
        expect(tests, `${question.id} 標記為 ${mode}，不應被自動判題`).toEqual([]);
      }
    }
  });

  it("Phase 3 新增的 113-1 與 114-3 已標記為 validated，且各自至少有一組非 sample（private）測資", () => {
    for (const id of ["113-1", "114-3"]) {
      expect(getJudgeMode(id)).toBe("validated");
      const tests = getJudgeTestCases(id);
      expect(tests.some((testCase) => testCase.visibility === "public")).toBe(true);
      expect(tests.some((testCase) => testCase.visibility === "private")).toBe(true);
    }
  });
});
