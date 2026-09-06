import { getOrCreateCurrentUser, buildLogoutCookieHeader, withSetCookie } from "@/lib/auth/current-user";
import { getSubmissionDatabase } from "@/lib/runtime/database";
import { updateDisplayName } from "@/lib/users/store";

const MAX_DISPLAY_NAME_LENGTH = 40;

export async function GET(request: Request) {
  const database = getSubmissionDatabase();
  const { user, setCookieHeader } = await getOrCreateCurrentUser(request, database);
  return withSetCookie(Response.json({ id: user.id, displayName: user.displayName }), setCookieHeader);
}

export async function POST(request: Request) {
  const database = getSubmissionDatabase();
  const { user, setCookieHeader } = await getOrCreateCurrentUser(request, database);
  const body = await request.json() as { displayName?: unknown };
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH) : "";
  if (!displayName) {
    return withSetCookie(Response.json({ error: "displayName is required" }, { status: 400 }), setCookieHeader);
  }
  await updateDisplayName(database, user.id, displayName);
  return withSetCookie(Response.json({ id: user.id, displayName }), setCookieHeader);
}

// "登出": ends this browser's identity without touching the student's stored data —
// the next request from this browser resolves to a brand-new, separate user.
export async function DELETE(request: Request) {
  return withSetCookie(Response.json({ ok: true }), buildLogoutCookieHeader(request));
}
