import { describe, expect, it } from "vitest";
import { questions } from "@/app/lib/questions";
import { problemDefinitions } from "@/features/practice/problem-definitions";

describe("結構化題目資料", () => {
  it("112-2 具有可供 C# 作答頁使用的完整規格與範例", () => {
    const problem = problemDefinitions["112-2"];
    expect(problem.statement).toContain("最小編輯距離");
    expect(problem.inputSpec).toContain("第一個英文單字");
    expect(problem.inputSpec).toContain("第二個英文單字");
    expect(problem.outputSpec).toContain("最小編輯距離");
    expect(problem.constraints).toContain("使用 C# 字串索引可寫成 word[i]。");
    expect(problem.examples).toEqual([
      expect.objectContaining({ input: "idea\ndeal", output: "2" }),
      expect.objectContaining({ input: "but\nbait", output: "3" }),
    ]);
  });

  it("每個結構化題目都對應到題庫中的公開作答路由", () => {
    const ids = new Set(questions.map((question) => question.id));
    expect(Object.keys(problemDefinitions).every((id) => ids.has(id))).toBe(true);
  });
});
