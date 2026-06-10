import { apiFetch } from "@/lib/api/client";
import type { AIExecutionLog } from "@/types/ai";

export interface ListAIExecutionLogsOptions {
  limit?: number;
  operation?: string;
  status?: AIExecutionLog["status"] | "all";
}

export async function listAIExecutionLogs(
  options: ListAIExecutionLogsOptions = {}
) {
  return apiFetch<AIExecutionLog[]>("/api/admin/ai-logs", {
    query: { ...options },
  });
}
