import { describe, expect, it } from "vitest";
import { buildGenerationInstructions, difficultyProfiles } from "@/features/problem-generation/historical-profile";
import { validateGeneratedDraft } from "@/lib/problem-generation/openai-problem-generator";

const validDraft = {
  title: "隊伍排序", difficulty: "core", category: "字串、排序與格式輸出", summary: "依條件排序", statement: "請排序。", inputSpec: "輸入資料。", outputSpec: "輸出結果。", constraints: ["N 不超過 100"],
  examples: [{ input: "2", output: "2", explanation: "範例" }, { input: "1", output: "1", explanation: "範例" }],
  tests: [
    { input: "1", expectedOutput: "1", visibility: "public" }, { input: "2", expectedOutput: "2", visibility: "public" },
    { input: "3", expectedOutput: "3", visibility: "private" }, { input: "4", expectedOutput: "4", visibility: "private" }, { input: "5", expectedOutput: "5", visibility: "private" },
  ],
};

describe("AI 出題規格", () => {
  it("三個難度都有符合競賽範圍的出題指引", () => {
    expect(Object.keys(difficultyProfiles)).toEqual(["foundation", "core", "integration"]);
    expect(buildGenerationInstructions("integration")).toContain("標準輸入/輸出");
    expect(buildGenerationInstructions("foundation")).toContain("原創");
  });

  it("只接受難度相符、公開兩筆與私有三筆以上的完整草稿", () => {
    expect(validateGeneratedDraft(validDraft, "core")).toMatchObject({ title: "隊伍排序" });
    expect(validateGeneratedDraft({ ...validDraft, difficulty: "foundation" }, "core")).toBeUndefined();
    expect(validateGeneratedDraft({ ...validDraft, tests: validDraft.tests.slice(0, 4) }, "core")).toBeUndefined();
  });
});
