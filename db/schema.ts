import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
});
