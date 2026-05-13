import { apiFetch } from "@/lib/api/client";
import type { Approval } from "@/types/record";

export interface ListApprovalsOptions {
  status?: Approval["status"] | "all";
  limit?: number;
}

export interface UpdateApprovalDecisionInput {
  status: "approved" | "rejected";
  commentText?: string;
}

function approvalsPath(options: ListApprovalsOptions = {}) {
  const params = new URLSearchParams();

  if (options.status && options.status !== "all") {
    params.set("status", options.status);
  }

  if (options.limit) {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();
  return `/api/admin/approvals${query ? `?${query}` : ""}`;
}

function approvalPath(approvalId: string) {
  return `/api/admin/approvals/${approvalId}`;
}

export async function listApprovals(options: ListApprovalsOptions = {}) {
  return apiFetch<Approval[]>(approvalsPath(options));
}

export async function updateApprovalDecision(
  approvalId: string,
  input: UpdateApprovalDecisionInput
) {
  return apiFetch<Approval>(approvalPath(approvalId), {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
