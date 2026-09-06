import { env } from "cloudflare:workers";
import { questions } from "../../lib/questions";
import { isManualBackfillAllowed } from "@/features/practice/judge-test-cases";
import { ensureRecordsSchema, insertManualRecord } from "@/lib/records/store";
import type { SubmissionDatabase } from "@/lib/submissions/store";

const db = () => env.DB;
const submissionDb = () => env.DB as unknown as SubmissionDatabase;

async function init() {
  await db().prepare("CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY,year INTEGER,title TEXT,category TEXT,level TEXT,note TEXT,file TEXT,page INTEGER)").run();
  await ensureRecordsSchema(submissionDb());
  const n = await db().prepare("SELECT COUNT(*) AS n FROM resources").first<{ n: number }>();
  if (!n?.n) await db().batch(questions.map((x) => db().prepare("INSERT INTO resources VALUES (?,?,?,?,?,?,?,?)").bind(x.id, x.year, x.title, x.category, x.level, x.note, x.file, x.page)));
}

export async function GET() {
  await init();
  return Response.json({ resources: (await db().prepare("SELECT * FROM resources ORDER BY year,id").all()).results, records: (await db().prepare("SELECT * FROM records ORDER BY created_at").all()).results });
}

// This is the Manual Review / legacy self-report path — a student's own honest
// assessment for a problem that has no real auto-judge yet. It is NOT the formal
// Submit scoring authority: a validated problem (real test cases exist) must always
// go through /api/submissions, which finalizes the record server-side from an actual
// Judge0 verdict. Without this check, any client could POST here with an arbitrary
// score/status for 112-2 (or any future validated problem) and bypass real judging
// entirely — DevTools and curl can call this endpoint just as easily as the UI.
export async function POST(r: Request) {
  await init();
  const x = await r.json() as { resourceId?: string; score?: number; minutes?: number; status?: string; notes?: string };
  if (!x.resourceId || typeof x.score !== "number" || typeof x.minutes !== "number" || !x.status) {
    return Response.json({ error: "resourceId、score、minutes 與 status 為必填" }, { status: 400 });
  }
  if (!isManualBackfillAllowed(x.resourceId)) {
    return Response.json({ error: "此題已提供自動判題，請透過「送出評測」取得正式成績，不接受手動回填。" }, { status: 403 });
  }
  await insertManualRecord(submissionDb(), { resourceId: x.resourceId, score: x.score, minutes: x.minutes, status: x.status, notes: x.notes || "" });
  return Response.json({ ok: true });
}

export async function DELETE() {
  await init();
  await db().prepare("DELETE FROM records").run();
  return Response.json({ ok: true });
}
