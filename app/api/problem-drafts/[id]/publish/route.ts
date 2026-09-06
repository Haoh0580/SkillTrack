import { publishDraft } from "@/lib/problem-generation/problem-store";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resourceId = await publishDraft(id);
  if (!resourceId) return Response.json({ error: "找不到草稿，或草稿已經處理過" }, { status: 404 });
  return Response.json({ ok: true, resourceId });
}
