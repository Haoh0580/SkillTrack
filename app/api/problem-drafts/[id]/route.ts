import { deleteDraft } from "@/lib/problem-generation/problem-store";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteDraft(id);
  return Response.json({ ok: true });
}
