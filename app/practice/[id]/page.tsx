import { notFound } from "next/navigation";
import { getPracticeProblem } from "@/features/practice/get-practice-problem";
import { PracticeWorkspace } from "./practice-workspace";

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = getPracticeProblem(id);
  if (!problem) notFound();
  return <PracticeWorkspace id={problem.id} title={problem.title} category={problem.category} note={problem.note} definition={problem.definition} />;
}
