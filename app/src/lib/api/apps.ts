import type { App } from "@/types/app";
import { apiFetch } from "@/lib/api/client";

export async function listApps() {
  return apiFetch<App[]>("/api/apps");
}
