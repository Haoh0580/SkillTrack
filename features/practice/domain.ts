export type SupportedLanguage = "cpp" | "python";

export type SubmissionRequest = {
  problemId: string;
  language: SupportedLanguage;
  source: string;
};

export type SubmissionResult = {
  id: string;
  verdict: "judge_not_configured" | "queued" | "accepted" | "wrong_answer" | "runtime_error" | "time_limit";
  passed: number;
  total: number;
  elapsedMs?: number;
  stdout?: string;
  stderr?: string;
};
