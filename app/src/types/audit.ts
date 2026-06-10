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
