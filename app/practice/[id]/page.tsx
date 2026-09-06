import { notFound } from "next/navigation";
import { questions } from "@/app/lib/questions";
import { problemDefinitions } from "@/features/practice/problem-definitions";
import { PracticeWorkspace } from "./practice-workspace";

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = questions.find((item) => item.id === id);
  if (!problem) notFound();
  const definition = problemDefinitions[id];
  return <PracticeWorkspace id={problem.id} title={problem.title} category={problem.category} note={problem.note} definition={definition} />;
}
