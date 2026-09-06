import type { SubmissionDatabase } from "@/lib/submissions/store";
import { createUser, getUserById, type User } from "@/lib/users/store";

const COOKIE_NAME = "skilltrack_uid";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Minimal identity, not authentication: a high-entropy (crypto.randomUUID, ~122 bits)
 * HttpOnly cookie that doubles as a stable bearer token for "which student is this."
 * There is no password, login form, OAuth, or session store — deliberately, per this
 * phase's scope (see Phase 5 report, section B, for the trade-off this accepts).
 *
 * The cookie is never readable from client JS (HttpOnly) and is never echoed back to
 * any other user in an API response, so the only way to acquire it is to already be
 * the browser holding it. Guessing another student's id is infeasible (UUID entropy);
 * the residual risk is someone with direct access to another student's cookie store.
 */

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function buildCookieHeader(request: Request, value: string, maxAgeSeconds: number): string {
  const isHttps = new URL(request.url).protocol === "https:";
  const attributes = [`${COOKIE_NAME}=${encodeURIComponent(value)}`, "Path=/", `Max-Age=${maxAgeSeconds}`, "HttpOnly", "SameSite=Lax"];
  if (isHttps) attributes.push("Secure");
  return attributes.join("; ");
}

export type CurrentUserResolution = { user: User; setCookieHeader: string | null };

/**
 * Resolves the student making this request. If the cookie is missing, or points at a
 * user id that no longer exists (e.g. a fresh database, or a forged/garbage value),
 * a brand-new user is created and `setCookieHeader` is returned so the caller can
 * attach it to the response — the browser never gets to assert its own user_id.
 */
export async function getOrCreateCurrentUser(request: Request, database: SubmissionDatabase): Promise<CurrentUserResolution> {
  const cookieUserId = readCookie(request, COOKIE_NAME);
  if (cookieUserId) {
    const existing = await getUserById(database, cookieUserId);
    if (existing) return { user: existing, setCookieHeader: null };
  }

  const id = crypto.randomUUID();
  const displayName = `訪客-${id.slice(0, 4)}`;
  const user = await createUser(database, { id, displayName, now: new Date().toISOString() });
  return { user, setCookieHeader: buildCookieHeader(request, id, ONE_YEAR_SECONDS) };
}

/** "登出" — ends this browser's identity. Does not delete the student's data; the
 * next request from this browser simply resolves to a fresh, separate identity. */
export function buildLogoutCookieHeader(request: Request): string {
  return buildCookieHeader(request, "", 0);
}

export function withSetCookie(response: Response, setCookieHeader: string | null): Response {
  if (!setCookieHeader) return response;
  response.headers.append("Set-Cookie", setCookieHeader);
  return response;
}
