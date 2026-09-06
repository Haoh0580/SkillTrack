import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import type { SubmissionDatabase } from "@/lib/submissions/store";
import { buildLogoutCookieHeader, getOrCreateCurrentUser, withSetCookie } from "@/lib/auth/current-user";

function createSqliteDatabase(): SubmissionDatabase {
  const raw = new DatabaseSync(":memory:");
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          const params = values as (string | number | bigint | null)[];
          return {
            async run() { raw.prepare(sql).run(...params); return undefined; },
            async first<T>() { return (raw.prepare(sql).get(...params) as T | undefined) ?? null; },
            async all() { return { results: raw.prepare(sql).all(...params) }; },
          };
        },
      };
    },
  };
}

const req = (headers: Record<string, string> = {}, url = "https://skilltrack.example/api/submissions") => new Request(url, { headers });

describe("lib/auth/current-user — 最小身份解析（cookie-based，非完整 authentication）", () => {
  it("沒有 cookie 時建立新使用者，並回傳 setCookieHeader 供 caller 附加到回應", async () => {
    const database = createSqliteDatabase();
    const { user, setCookieHeader } = await getOrCreateCurrentUser(req(), database);

    expect(user.id).toBeTruthy();
    expect(user.displayName).toContain("訪客");
    expect(setCookieHeader).toContain(`skilltrack_uid=${user.id}`);
    expect(setCookieHeader).toContain("HttpOnly");
  });

  it("帶有效 cookie 時解析回同一位使用者，不建立新使用者、不回傳 setCookieHeader", async () => {
    const database = createSqliteDatabase();
    const first = await getOrCreateCurrentUser(req(), database);

    const second = await getOrCreateCurrentUser(req({ cookie: `skilltrack_uid=${first.user.id}` }), database);

    expect(second.user.id).toBe(first.user.id);
    expect(second.setCookieHeader).toBeNull();
  });

  it("cookie 指向不存在的 user_id（過期資料庫、偽造值）時，視為新使用者處理，而不是報錯或冒用該 id", async () => {
    const database = createSqliteDatabase();
    const { user, setCookieHeader } = await getOrCreateCurrentUser(req({ cookie: "skilltrack_uid=does-not-exist" }), database);

    expect(user.id).not.toBe("does-not-exist");
    expect(setCookieHeader).toContain(`skilltrack_uid=${user.id}`);
  });

  it("cookie header 中夾雜其他 cookie 時仍能正確解析出 skilltrack_uid", async () => {
    const database = createSqliteDatabase();
    const first = await getOrCreateCurrentUser(req(), database);

    const second = await getOrCreateCurrentUser(req({ cookie: `other=1; skilltrack_uid=${first.user.id}; another=2` }), database);

    expect(second.user.id).toBe(first.user.id);
  });

  it("兩個不同瀏覽器（無 cookie）各自建立獨立的使用者", async () => {
    const database = createSqliteDatabase();
    const a = await getOrCreateCurrentUser(req(), database);
    const b = await getOrCreateCurrentUser(req(), database);
    expect(a.user.id).not.toBe(b.user.id);
  });

  it("HTTPS 請求的 cookie 會加上 Secure；非 HTTPS（本機開發）則不會", async () => {
    const database = createSqliteDatabase();
    const httpsResult = await getOrCreateCurrentUser(req({}, "https://skilltrack.example/api/submissions"), database);
    expect(httpsResult.setCookieHeader).toContain("Secure");

    const httpResult = await getOrCreateCurrentUser(req({}, "http://localhost:3000/api/submissions"), database);
    expect(httpResult.setCookieHeader).not.toContain("Secure");
  });

  it("buildLogoutCookieHeader 清空 cookie（Max-Age=0），不刪除使用者資料", async () => {
    const header = buildLogoutCookieHeader(req());
    expect(header).toContain("skilltrack_uid=;");
    expect(header).toContain("Max-Age=0");
  });

  it("withSetCookie 在 header 為 null 時不附加任何 Set-Cookie", () => {
    const response = withSetCookie(new Response("ok"), null);
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("withSetCookie 在有 header 時附加 Set-Cookie", () => {
    const response = withSetCookie(new Response("ok"), "skilltrack_uid=abc; Path=/");
    expect(response.headers.get("Set-Cookie")).toContain("skilltrack_uid=abc");
  });
});
