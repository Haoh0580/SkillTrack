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

describe("執行程式（Run Code）與送出評測（Submit）互不干擾", () => {
  it("執行程式會把測試輸入原樣送到 /api/judge，且不會呼叫 /api/submissions 或 /api/data", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: { id: 3, description: "Accepted" }, stdout: "3\n", stderr: null, compile_output: null, message: null, time: "0.02", memory: 3100 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();

    await user.type(screen.getByLabelText("測試輸入"), "abc\n\n");
    await user.click(screen.getByRole("button", { name: "執行程式" }));

    expect(await screen.findByText("Accepted")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/judge", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ source_code: expect.stringContaining("public class Program"), language_id: 51, stdin: "abc\n\n" });
    expect(fetchMock).not.toHaveBeenCalledWith("/api/submissions", expect.anything());
    expect(fetchMock).not.toHaveBeenCalledWith("/api/data", expect.anything());
  });

  it("執行程式不會寫入分數／能力雷達（不呼叫 /api/data），即使 Judge0 回報執行失敗", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: { id: 11, description: "Runtime Error (NZEC)" }, stdout: null, stderr: "boom", compile_output: null, message: null, time: null, memory: null }) });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "執行程式" }));

    expect(await screen.findByText("Runtime Error")).toBeTruthy();
    expect(fetchMock.mock.calls.every((call) => call[0] === "/api/judge")).toBe(true);
  });

  it("stdout 為空時顯示「程式沒有輸出內容」而不是空白區塊", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: { id: 3, description: "Accepted" }, stdout: "", stderr: null, compile_output: null, message: null, time: "0.01", memory: 3000 }) }));
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "執行程式" }));

    expect(await screen.findByText("程式沒有輸出內容")).toBeTruthy();
  });

  it("Judge0 服務失敗時顯示服務暫時無法使用，而不是誤判為錯誤答案", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Execution service temporarily unavailable." }) }));
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "執行程式" }));

    expect(await screen.findByText("Execution service temporarily unavailable.")).toBeTruthy();
  });

  it("執行中重複點擊「執行程式」不會建立第二個並行請求", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: unknown) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();

    const runButton = screen.getByRole("button", { name: "執行程式" });
    await user.click(runButton);
    await user.click(runButton);
    await user.click(runButton);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch({ ok: true, json: async () => ({ status: { id: 3, description: "Accepted" }, stdout: "ok", stderr: null, compile_output: null, message: null, time: "0.01", memory: 3000 }) });
  });

  it("送出評測不會帶上 Run Code 的測試輸入，也不會呼叫 /api/judge", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ verdict: "judge_not_configured" }) });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();

    await user.type(screen.getByLabelText("測試輸入"), "should-not-leak");
    await user.click(screen.getByRole("button", { name: "送出評測" }));

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty("stdin");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/judge", expect.anything());
  });
});
