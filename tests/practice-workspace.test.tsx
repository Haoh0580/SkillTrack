import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PracticeWorkspace } from "@/app/practice/[id]/practice-workspace";
import { problemDefinitions } from "@/features/practice/problem-definitions";

const renderWorkspace = () => render(<PracticeWorkspace id="112-2" title="最小編輯距離" category="動態規劃與最佳化" note="字串 DP" definition={problemDefinitions["112-2"]} />);

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("C# 作答工作區", () => {
  it("顯示 C# 範本並可開始與暫停計時", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect((screen.getByLabelText("C# 程式碼編輯器") as HTMLTextAreaElement).value).toContain("public class Program");
    await user.click(screen.getByRole("button", { name: "開始計時" }));
    expect(screen.getByRole("button", { name: "暫停" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "暫停" }));
    expect(screen.getByRole("button", { name: "開始計時" })).toBeTruthy();
  });

  it("送出時只傳送 C# 的既定 API 契約", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ verdict: "judge_not_configured" }) });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();
    await user.click(screen.getByRole("button", { name: "送出評測" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/submissions", expect.objectContaining({ method: "POST" }));
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(options.body as string)).toMatchObject({ problemId: "112-2", language: "csharp" });
    expect(await screen.findByText("判題服務尚未接入，已驗證送出 API 契約")).toBeTruthy();
  });

  it("取得判題結果後顯示通過數、耗時與輸出", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ verdict: "accepted", passed: 5, total: 5, elapsedMs: 84, stdout: "2" }) }));
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "送出評測" }));

    expect(await screen.findByText("已通過 5 / 5 測資")).toBeTruthy();
    expect(screen.getByText("耗時 84 ms")).toBeTruthy();
    expect(screen.getByText("程式輸出：2")).toBeTruthy();
  });
});
