export interface AppRecord {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  recordNo?: number;
  status: string;
  data: { [key: string]: unknown };
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  workflowRunIds?: string[];
  workflowDispatchPending?: boolean;
}

export interface RecordComment {
  id: string;
  tenantId: string;
  recordId: string;
  commentText: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  isSystem?: boolean;
}

export interface Attachment {
  id: string;
  tenantId: string;
  recordId: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
}

export interface RecordBackReferenceGroup {
  fieldCode: string;
  fieldName: string;
  sourceAppId?: string;
  sourceAppCode?: string;
  sourceAppName?: string;
  sourceTableId: string;
  sourceTableCode: string;
  sourceTableName: string;
  records: AppRecord[];
}

export interface Approval {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  recordId: string;
  workflowId?: string;
  workflowRunId?: string;
  workflowNodeId?: string;
  appApprovalSettingId?: string;
  approverId: string;
  requestedBy: string;
  actedBy?: string;
  status: "pending" | "approved" | "rejected" | "returned";
  title: string;
  description?: string;
  commentText?: string;
  approvalMode?: "any" | "all" | "sequential" | "quorum";
  actedAt?: string;
  createdAt: string;
  updatedAt: string;
  appName?: string;
  tableName?: string;
  workflowName?: string;
  recordTitle?: string;
  requesterName?: string;
  approverName?: string;
  actorName?: string;
  assignees?: ApprovalAssignee[];
}

export interface ApprovalAssignee {
  id: string;
  approvalId: string;
  userId: string;
  userName?: string;
  status: "pending" | "approved" | "rejected" | "returned";
  commentText?: string;
  actedAt?: string;
  sortOrder: number;
  required: boolean;
  active: boolean;
}
