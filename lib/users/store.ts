import type { SubmissionDatabase } from "@/lib/submissions/store";

export type User = { id: string; displayName: string; createdAt: string };

/** Additive, idempotent schema setup — same convention as lib/records/store.ts. */
export async function ensureUsersSchema(database: SubmissionDatabase): Promise<void> {
  await database
    .prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, created_at TEXT NOT NULL)")
    .bind()
    .run();
}

type UserRow = { id: string; display_name: string; created_at: string };

export async function getUserById(database: SubmissionDatabase, id: string): Promise<User | null> {
  await ensureUsersSchema(database);
  const row = await database.prepare("SELECT id, display_name, created_at FROM users WHERE id = ?").bind(id).first<UserRow>();
  return row ? { id: row.id, displayName: row.display_name, createdAt: row.created_at } : null;
}

export async function createUser(database: SubmissionDatabase, input: { id: string; displayName: string; now: string }): Promise<User> {
  await ensureUsersSchema(database);
  await database
    .prepare("INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)")
    .bind(input.id, input.displayName, input.now)
    .run();
  return { id: input.id, displayName: input.displayName, createdAt: input.now };
}

export async function updateDisplayName(database: SubmissionDatabase, id: string, displayName: string): Promise<void> {
  await ensureUsersSchema(database);
  await database.prepare("UPDATE users SET display_name = ? WHERE id = ?").bind(displayName, id).run();
}
