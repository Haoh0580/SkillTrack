import { describe, expect, it } from "vitest";
import { getPracticeProblem } from "@/features/practice/get-practice-problem";

describe("作答路由題目解析", () => {
  it("已結構化的 112-2 回傳完整作答資料", () => {
    const problem = getPracticeProblem("112-2");
    expect(problem).toMatchObject({ id: "112-2", title: "最小編輯距離" });
    expect(problem?.definition?.examples).toHaveLength(2);
  });

  it("題庫中但尚待轉換的題目仍可進入工作區", () => {
    const problem = getPracticeProblem("112-1");
    expect(problem).toMatchObject({ id: "112-1", title: "黑洞數", definition: undefined });
  });

  it("不存在的題目代號不建立作答路由", () => {
    expect(getPracticeProblem("999-99")).toBeUndefined();
  });
});
