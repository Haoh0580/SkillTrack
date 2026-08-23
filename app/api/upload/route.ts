import { env } from "cloudflare:workers";

export async function POST(r: Request) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY,year INTEGER,title TEXT,category TEXT,level TEXT,note TEXT,file TEXT,page INTEGER)").run();
  const f = await r.formData(), file = f.get("file") as File;
  if (!file) return Response.json({ error: "缺少檔案" }, { status: 400 });
  const id = crypto.randomUUID(), key = `questions/${id}`;
  await env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  await env.DB.prepare("INSERT INTO resources VALUES (?,?,?,?,?,?,?,?)").bind(id, +f.get("year")!, f.get("title"), f.get("category"), f.get("level"), f.get("note") || "", `/api/file/${id}`, 1).run();
  return Response.json({ ok: true });
}
