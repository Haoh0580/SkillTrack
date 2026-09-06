import { env } from "cloudflare:workers";
import type { GeneratedProblemDraft, GenerationDifficulty } from "@/features/problem-generation/domain";
import { difficultyProfiles } from "@/features/problem-generation/historical-profile";
import type { JudgeTestCase } from "@/lib/judge/types";

export type ProblemDraftRecord = GeneratedProblemDraft & {
  id: string;
  status: "pending" | "published";
  createdAt: string;
};

type DraftRow = {
  id: string;
  difficulty: GenerationDifficulty;
  category: string;
  title: string;
  summary: string;
  statement: string;
  input_spec: string;
  output_spec: string;
  constraints_json: string;
  examples_json: string;
  tests_json: string;
  status: "pending" | "published";
  created_at: string;
};

type ProblemRow = {
  id: string;
  title: string;
  category: string;
  note: string;
  statement: string;
  input_spec: string;
  output_spec: string;
  constraints_json: string;
  examples_json: string;
  tests_json: string;
};

async function ensureTables() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS problem_drafts (
      id TEXT PRIMARY KEY, difficulty TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL,
      summary TEXT NOT NULL, statement TEXT NOT NULL, input_spec TEXT NOT NULL, output_spec TEXT NOT NULL,
      constraints_json TEXT NOT NULL, examples_json TEXT NOT NULL, tests_json TEXT NOT NULL,
      status TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, note TEXT NOT NULL,
      statement TEXT NOT NULL, input_spec TEXT NOT NULL, output_spec TEXT NOT NULL,
      constraints_json TEXT NOT NULL, examples_json TEXT NOT NULL, tests_json TEXT NOT NULL
    )`),
  ]);
}

function rowToDraft(row: DraftRow): ProblemDraftRecord {
  return {
    id: row.id,
    difficulty: row.difficulty,
    category: row.category,
    title: row.title,
    summary: row.summary,
    statement: row.statement,
    inputSpec: row.input_spec,
    outputSpec: row.output_spec,
    constraints: JSON.parse(row.constraints_json),
    examples: JSON.parse(row.examples_json),
    tests: JSON.parse(row.tests_json),
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function saveDraft(id: string, difficulty: GenerationDifficulty, draft: GeneratedProblemDraft, createdAt: string) {
  await ensureTables();
  await env.DB.prepare(
    `INSERT INTO problem_drafts (id, difficulty, category, title, summary, statement, input_spec, output_spec, constraints_json, examples_json, tests_json, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(id, difficulty, draft.category, draft.title, draft.summary, draft.statement, draft.inputSpec, draft.outputSpec, JSON.stringify(draft.constraints), JSON.stringify(draft.examples), JSON.stringify(draft.tests), "pending", createdAt)
    .run();
}

export async function listPendingDrafts(): Promise<ProblemDraftRecord[]> {
  await ensureTables();
  const { results } = await env.DB.prepare("SELECT * FROM problem_drafts WHERE status='pending' ORDER BY created_at DESC").all<DraftRow>();
  return results.map(rowToDraft);
}

export async function getDraft(id: string): Promise<ProblemDraftRecord | undefined> {
  await ensureTables();
  const row = await env.DB.prepare("SELECT * FROM problem_drafts WHERE id=?").bind(id).first<DraftRow>();
  return row ? rowToDraft(row) : undefined;
}

export async function deleteDraft(id: string) {
  await ensureTables();
  await env.DB.prepare("DELETE FROM problem_drafts WHERE id=?").bind(id).run();
}

export async function publishDraft(id: string): Promise<string | undefined> {
  await ensureTables();
  const draft = await getDraft(id);
  if (!draft || draft.status !== "pending") return undefined;
  const resourceId = `ai-${draft.id}`;
  const level = difficultyProfiles[draft.difficulty].label;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO resources (id, year, title, category, level, note, file, page) VALUES (?,?,?,?,?,?,?,?)")
      .bind(resourceId, new Date().getFullYear(), draft.title, draft.category, level, draft.summary, "", 0),
    env.DB.prepare(
      `INSERT INTO problems (id, title, category, note, statement, input_spec, output_spec, constraints_json, examples_json, tests_json)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).bind(resourceId, draft.title, draft.category, draft.summary, draft.statement, draft.inputSpec, draft.outputSpec, JSON.stringify(draft.constraints), JSON.stringify(draft.examples), JSON.stringify(draft.tests)),
    env.DB.prepare("DELETE FROM problem_drafts WHERE id=?").bind(id),
  ]);
  return resourceId;
}

export async function getPublishedProblem(id: string) {
  await ensureTables();
  const row = await env.DB.prepare("SELECT * FROM problems WHERE id=?").bind(id).first<ProblemRow>();
  if (!row) return undefined;
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    note: row.note,
    definition: {
      id: row.id,
      statement: row.statement,
      inputSpec: row.input_spec,
      outputSpec: row.output_spec,
      constraints: JSON.parse(row.constraints_json) as string[],
      examples: JSON.parse(row.examples_json) as Array<{ input: string; output: string; explanation: string }>,
    },
  };
}

export async function getPublishedTests(id: string): Promise<JudgeTestCase[]> {
  await ensureTables();
  const row = await env.DB.prepare("SELECT tests_json FROM problems WHERE id=?").bind(id).first<{ tests_json: string }>();
  return row ? JSON.parse(row.tests_json) : [];
}
