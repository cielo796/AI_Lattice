export interface AuditLog {
  id: string;
  tenantId: string;
  actorId: string;
  actorName: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  detailJson?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  result?: "success" | "denied" | "error";
  aiInvolvement?: "autonomous" | "predictive" | "assisted" | "none";
  createdAt: string;
}

export interface AIExecutionLog {
  id: string;
  tenantId: string;
  appId: string;
  recordId?: string;
  aiActionId: string;
  actionName: string;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  modelName: string;
  tokenUsageIn: number;
  tokenUsageOut: number;
  costAmount: number;
  status: "success" | "error";
  executedBy: string;
  createdAt: string;
}
