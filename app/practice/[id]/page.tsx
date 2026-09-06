import { notFound } from "next/navigation";
import { questions } from "@/app/lib/questions";
import { PracticeWorkspace } from "./practice-workspace";

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = questions.find((item) => item.id === id);
  if (!problem) notFound();
  return <PracticeWorkspace id={problem.id} title={problem.title} category={problem.category} note={problem.note} />;
}
