import { env } from "cloudflare:workers";
import { isGenerationDifficulty, type ProblemDraftRequest } from "@/features/problem-generation/domain";
import { generateProblemDraft } from "@/lib/problem-generation/openai-problem-generator";

type AiEnvironment = { AI_MODEL?: string };

export async function POST(request: Request) {
  let body: Partial<ProblemDraftRequest>;
  try { body = await request.json(); } catch { return Response.json({ error: "請選擇出題難度" }, { status: 400 }); }
  if (!isGenerationDifficulty(body.difficulty)) return Response.json({ error: "難度只能選擇保底、核心或整合" }, { status: 400 });
  const apiKey = request.headers.get("x-openai-api-key")?.trim();
  if (!apiKey) return Response.json({ error: "AI 出題尚未啟用：請先在「設定 API Key」輸入你的 OpenAI API Key。" }, { status: 401 });
  const ai = env as unknown as AiEnvironment;
  try {
    const draft = await generateProblemDraft({ apiKey, model: ai.AI_MODEL ?? "gpt-5.4-mini", difficulty: body.difficulty });
    return Response.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 出題服務暫時無法使用";
    return Response.json({ error: message }, { status: 502 });
  }
}
