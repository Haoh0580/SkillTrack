import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Minimal identity, not full authentication — see lib/auth/current-user.ts. A
// student is identified by a high-entropy HttpOnly cookie holding this id; there is
// no password/session table beyond this row.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const resources = sqliteTable("resources", {
  id: text("id").primaryKey(),
  year: integer("year").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  level: text("level").notNull(),
  note: text("note").notNull(),
  file: text("file").notNull(),
  page: integer("page").notNull(),
});

export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  resourceId: text("resource_id").notNull(),
  score: integer("score").notNull(),
  minutes: integer("minutes").notNull(),
  status: text("status").notNull(),
  notes: text("notes").notNull(),
  createdAt: text("created_at").notNull(),
  // Links a formal (server-finalized) record back to the submission that produced it.
  // Null for Manual Review / legacy self-reported records. A partial unique index
  // (managed at runtime in lib/records/store.ts, alongside this table's other
  // runtime-managed DDL) enforces at most one formal record per submission.
  submissionId: text("submission_id"),
  // The owning student. Null for rows written before Phase 5 — deliberately excluded
  // from every user-scoped query rather than treated as "visible to anyone".
  userId: text("user_id"),
});

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    problemId: text("problem_id").notNull(),
    language: text("language").notNull(),
    source: text("source").notNull(),
    verdict: text("verdict").notNull(),
    passed: integer("passed").notNull(),
    total: integer("total").notNull(),
    elapsedMs: integer("elapsed_ms"),
    stdout: text("stdout"),
    stderr: text("stderr"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    // The owning student. Null for rows written before Phase 5 (this table predates
    // user identity entirely — see lib/submissions/store.ts's ensureSubmissionsSchema).
    userId: text("user_id"),
  },
  (table) => [
    index("idx_submissions_problem_created").on(table.problemId, table.createdAt),
    index("idx_submissions_created").on(table.createdAt),
    index("idx_submissions_user_id").on(table.userId),
  ],
);
