import { env } from "cloudflare:workers";
import type { SubmissionDatabase } from "@/lib/submissions/store";

export function getSubmissionDatabase(): SubmissionDatabase {
  return env.DB as unknown as SubmissionDatabase;
}
