import { env } from "cloudflare:workers";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (/^\d{3}-\d+$/.test(id)) return Response.json({ error: "官方歷屆題目不可刪除" }, { status: 403 });
  const resource = await env.DB.prepare("SELECT file FROM resources WHERE id=?").bind(id).first<{ file: string }>();
  if (!resource) return Response.json({ error: "找不到題目" }, { status: 404 });
  await env.DB.batch([
    env.DB.prepare("DELETE FROM records WHERE resource_id=?").bind(id),
    env.DB.prepare("DELETE FROM resources WHERE id=?").bind(id),
  ]);
  await env.FILES.delete(resource.file.replace("/api/file/", "questions/"));
  return Response.json({ ok: true });
}
