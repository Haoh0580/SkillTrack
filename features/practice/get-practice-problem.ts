import { questions } from "@/app/lib/questions";
import { problemDefinitions } from "./problem-definitions";

export function getPracticeProblem(id: string) {
  const problem = questions.find((item) => item.id === id);
  if (!problem) return undefined;
  return { ...problem, definition: problemDefinitions[id] };
}
