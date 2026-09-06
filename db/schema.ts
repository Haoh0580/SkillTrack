import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  },
  (table) => [
    index("idx_submissions_problem_created").on(table.problemId, table.createdAt),
    index("idx_submissions_created").on(table.createdAt),
  ],
);
