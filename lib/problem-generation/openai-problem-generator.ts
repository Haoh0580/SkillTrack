import type { GeneratedProblemDraft, GenerationDifficulty } from "@/features/problem-generation/domain";
import { buildGenerationInstructions } from "@/features/problem-generation/historical-profile";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "difficulty", "category", "summary", "statement", "inputSpec", "outputSpec", "constraints", "examples", "tests"],
  properties: {
    title: { type: "string" }, difficulty: { type: "string", enum: ["foundation", "core", "integration"] }, category: { type: "string" }, summary: { type: "string" }, statement: { type: "string" }, inputSpec: { type: "string" }, outputSpec: { type: "string" },
    constraints: { type: "array", items: { type: "string" } },
    examples: { type: "array", items: { type: "object", additionalProperties: false, required: ["input", "output", "explanation"], properties: { input: { type: "string" }, output: { type: "string" }, explanation: { type: "string" } } } },
    tests: { type: "array", items: { type: "object", additionalProperties: false, required: ["input", "expectedOutput", "visibility"], properties: { input: { type: "string" }, expectedOutput: { type: "string" }, visibility: { type: "string", enum: ["public", "private"] } } } },
  },
} as const;

type OpenAiResponse = { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: unknown }> }> };

function getOutputText(response: OpenAiResponse) {
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output ?? []) for (const content of item.content ?? []) if (content.type === "output_text" && typeof content.text === "string") return content.text;
  return undefined;
}

export function validateGeneratedDraft(value: unknown, difficulty: GenerationDifficulty): GeneratedProblemDraft | undefined {
  if (!value || typeof value !== "object") return undefined;
  const draft = value as Partial<GeneratedProblemDraft>;
  const textFields = [draft.title, draft.category, draft.summary, draft.statement, draft.inputSpec, draft.outputSpec];
  if (draft.difficulty !== difficulty || textFields.some((item) => typeof item !== "string" || !item.trim())) return undefined;
  if (!Array.isArray(draft.constraints) || !draft.constraints.length || !Array.isArray(draft.examples) || draft.examples.length < 2 || !Array.isArray(draft.tests)) return undefined;
  const publicTests = draft.tests.filter((test) => test.visibility === "public");
  const privateTests = draft.tests.filter((test) => test.visibility === "private");
  if (publicTests.length < 2 || privateTests.length < 3) return undefined;
  if (draft.examples.some((item) => !item || !item.input?.trim() || !item.output?.trim() || !item.explanation?.trim())) return undefined;
  if (draft.tests.some((item) => !item || !item.input?.trim() || !item.expectedOutput?.trim() || (item.visibility !== "public" && item.visibility !== "private"))) return undefined;
  return draft as GeneratedProblemDraft;
}

export async function generateProblemDraft({ apiKey, model, difficulty }: { apiKey: string; model: string; difficulty: GenerationDifficulty }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      instructions: buildGenerationInstructions(difficulty),
      input: "請依照指定 JSON 結構輸出一題可直接進入人工審核的訓練題草稿。",
      max_output_tokens: 3000,
      text: { format: { type: "json_schema", name: "training_problem_draft", strict: true, schema } },
    }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => undefined) as { error?: { message?: string; code?: string } } | undefined;
    const reason = detail?.error?.message ?? detail?.error?.code;
    throw new Error(reason ? `AI 出題服務暫時無法使用（${response.status}：${reason}）` : `AI 出題服務暫時無法使用（${response.status}）`);
  }
  const text = getOutputText(await response.json() as OpenAiResponse);
  if (!text) throw new Error("AI 未回傳可讀取的題目內容");
  const draft = validateGeneratedDraft(JSON.parse(text), difficulty);
  if (!draft) throw new Error("AI 題目未通過測資與格式檢查，請重新產生");
  return draft;
}
