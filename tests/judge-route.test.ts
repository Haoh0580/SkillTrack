import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/judge/route";

const request = (body: unknown) => new Request("http://test/api/judge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("/api/judge — 未評分的 Run Code 執行端點", () => {
  it("拒絕缺少 source_code 的請求", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
  });

  it("拒絕空字串 source_code", async () => {
    const response = await POST(request({ source_code: "" }));
    expect(response.status).toBe(400);
  });

  it("拒絕非字串的 source_code", async () => {
    const response = await POST(request({ source_code: 123 }));
    expect(response.status).toBe(400);
  });

  it("source_code 超過 100KB 時回傳 413", async () => {
    const response = await POST(request({ source_code: "a".repeat(100 * 1024 + 1) }));
    expect(response.status).toBe(413);
  });

  it("stdin 超過 100KB 時回傳 413", async () => {
    const response = await POST(request({ source_code: "ok", stdin: "a".repeat(100 * 1024 + 1) }));
    expect(response.status).toBe(413);
  });

  it("language_id 未提供時預設為 51 (C# Mono)，且原樣轉發 stdin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: { id: 3, description: "Accepted" }, stdout: "3\n", stderr: null, compile_output: null, message: null, time: "0.01", memory: 3000 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ source_code: "code", stdin: "abc\n\n" }));

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ce.judge0.com/submissions?wait=true");
    expect(JSON.parse(init.body as string)).toEqual({ source_code: "code", language_id: 51, stdin: "abc\n\n" });
    await expect(response.json()).resolves.toMatchObject({ status: { id: 3, description: "Accepted" }, stdout: "3\n" });
  });

  it("不會 trim 或改寫 stdin 的語意（EOF 與空白行需保持不同）", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: { id: 3 }, stdout: "" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await POST(request({ source_code: "code", stdin: "abc\n" }));
    await POST(request({ source_code: "code", stdin: "abc\n\n" }));

    const bodies = fetchMock.mock.calls.map((call) => JSON.parse((call[1] as RequestInit).body as string).stdin);
    expect(bodies).toEqual(["abc\n", "abc\n\n"]);
  });

  it("接受自訂 language_id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: { id: 3 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await POST(request({ source_code: "code", language_id: 71 }));

    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ language_id: 71 });
  });

  it("Judge0 回傳非 2xx 時，回報服務暫時無法使用，不外洩內部細節", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("upstream secret detail", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ source_code: "code" }));

    expect(response.status).toBe(502);
    const data = await response.json() as { error: string };
    expect(data.error).toBe("Execution service temporarily unavailable.");
    expect(data.error).not.toContain("upstream secret detail");
  });

  it("Judge0 回傳 429 時，同樣視為服務暫時無法使用（而非判定為錯誤答案）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    const response = await POST(request({ source_code: "code" }));
    expect(response.status).toBe(502);
  });

  it("網路連線例外時，回報服務暫時無法使用", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const response = await POST(request({ source_code: "code" }));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: "Execution service temporarily unavailable." });
  });

  it("Judge0 回傳非預期格式（非 JSON 物件）時，安全地回報服務暫時無法使用", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));
    const response = await POST(request({ source_code: "code" }));
    expect(response.status).toBe(502);
  });

  it("逾時會中止上游請求並回報服務暫時無法使用，而不是讓請求無限期卡住", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetchMock);

    const responsePromise = POST(request({ source_code: "while(true){}" }));
    await vi.advanceTimersByTimeAsync(20000);
    const response = await responsePromise;

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: "Execution service temporarily unavailable." });
  });
});
