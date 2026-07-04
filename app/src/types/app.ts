export interface App {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description?: string;
  status: "draft" | "published" | "archived";
  icon: string;
  primaryTableCode?: string;
  tableCount?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppTable {
  id: string;
  tenantId: string;
  appId: string;
  name: string;
  code: string;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
}

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "user_ref"
  | "master_ref"
  | "file"
  | "ai_generated"
  | "calculated";

export type AppViewType = "list" | "kanban" | "calendar" | "chart" | "summary";

export type ApprovalMode = "any" | "all" | "sequential" | "quorum";

export interface AppApprovalApprover {
  id: string;
  tenantId: string;
  settingId: string;
  approverType: "user" | "role";
  userId?: string;
  userName?: string;
  roleId?: string;
  roleName?: string;
  roleType?: "system_admin" | "tenant_admin" | "app_admin" | "approver" | "user" | "viewer";
  sortOrder: number;
  required: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppApprovalRecordUpdateAction {
  target?: "current_record";
  status?: string;
  dataPatch?: Record<string, unknown>;
}

export interface AppApprovalUserCandidate {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
}

export interface AppApprovalSetting {
  id: string;
  tenantId: string;
  appId: string;
  enabled: boolean;
  approvalMode: ApprovalMode;
  targetTableId?: string;
  pendingStatus: string;
  approvedStatus: string;
  rejectedStatus: string;
  returnedStatus: string;
  quorumCount?: number;
  requestTitleTemplate?: string;
  requestBodyTemplate?: string;
  conditionJson?: Record<string, unknown>;
  postApprovalActionsJson?: {
    approved?: AppApprovalRecordUpdateAction[];
    rejected?: AppApprovalRecordUpdateAction[];
    returned?: AppApprovalRecordUpdateAction[];
  };
  approvers: AppApprovalApprover[];
  createdAt: string;
  updatedAt: string;
}

export interface AppField {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  name: string;
  code: string;
  fieldType: FieldType;
  required: boolean;
  uniqueFlag: boolean;
  defaultValue?: unknown;
  settingsJson?: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
}

export interface AppView {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  name: string;
  viewType: AppViewType;
  settingsJson?: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppForm {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  name: string;
  layoutJson: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeTableMeta {
  table: Pick<AppTable, "id" | "name" | "code">;
  fields: AppField[];
  views: AppView[];
  forms: AppForm[];
}

export interface RuntimeAppTableSummary {
  id: string;
  name: string;
  code: string;
  recordCount: number;
  fieldCount: number;
  viewCount: number;
  formCount: number;
  viewTypes: AppViewType[];
}

export interface RuntimeAppOverview {
  app: App;
  tables: RuntimeAppTableSummary[];
  totals: {
    records: number;
    pendingApprovals: number;
  };
}

export interface AppVersionSummary {
  id: string;
  tenantId: string;
  appId: string;
  versionNo: number;
  publishedByName?: string;
  publishedAt: string;
  createdAt: string;
  tableCount: number;
  viewCount: number;
  workflowCount: number;
}
