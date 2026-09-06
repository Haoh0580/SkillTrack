export const generationDifficulties = ["foundation", "core", "integration"] as const;

export type GenerationDifficulty = (typeof generationDifficulties)[number];

export type GeneratedTestCase = {
  input: string;
  expectedOutput: string;
  visibility: "public" | "private";
};

export type GeneratedProblemDraft = {
  title: string;
  difficulty: GenerationDifficulty;
  category: string;
  summary: string;
  statement: string;
  inputSpec: string;
  outputSpec: string;
  constraints: string[];
  examples: Array<{ input: string; output: string; explanation: string }>;
  tests: GeneratedTestCase[];
};

export type ProblemDraftRequest = {
  difficulty: GenerationDifficulty;
};

export function isGenerationDifficulty(value: unknown): value is GenerationDifficulty {
  return typeof value === "string" && generationDifficulties.includes(value as GenerationDifficulty);
}
