import { describe, expect, it } from "vitest";
import { getPracticeProblem } from "@/features/practice/get-practice-problem";
import { questions } from "@/app/lib/questions";

describe("作答路由題目解析", () => {
  it("已結構化的 112-2 回傳完整作答資料", () => {
    const problem = getPracticeProblem("112-2");
    expect(problem).toMatchObject({ id: "112-2", title: "最小編輯距離" });
    expect(problem?.definition?.examples).toHaveLength(2);
  });

  it("歷屆題庫的 112-1 已補齊結構化題目內容，不需再連往 PDF", () => {
    const problem = getPracticeProblem("112-1");
    expect(problem).toMatchObject({ id: "112-1", title: "黑洞數" });
    expect(problem?.definition).toBeDefined();
    expect(problem?.definition?.examples.length).toBeGreaterThan(0);
  });

  it("歷屆 18 題官方題目全部都有結構化的題目內容", () => {
    const historical = questions.filter((question) => /^\d{3}-\d+$/.test(question.id));
    expect(historical).toHaveLength(18);
    for (const question of historical) {
      const problem = getPracticeProblem(question.id);
      expect(problem?.definition, `${question.id} 應有結構化題目內容`).toBeDefined();
      expect(problem?.definition?.statement.length ?? 0).toBeGreaterThan(0);
      expect(problem?.definition?.examples.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("不存在的題目代號不建立作答路由", () => {
    expect(getPracticeProblem("999-99")).toBeUndefined();
  });
});
