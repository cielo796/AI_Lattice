export interface AppRecord {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  status: string;
  data: { [key: string]: unknown };
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface RecordComment {
  id: string;
  tenantId: string;
  recordId: string;
  commentText: string;
  createdBy: string;
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
  sourceTableId: string;
  sourceTableCode: string;
  sourceTableName: string;
  records: AppRecord[];
}

export interface Approval {
  id: string;
  tenantId: string;
  recordId: string;
  workflowId: string;
  approverId: string;
  status: "pending" | "approved" | "rejected";
  commentText?: string;
  actedAt?: string;
  createdAt: string;
}
