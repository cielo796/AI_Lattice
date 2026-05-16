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

export type AppViewType = "list" | "kanban" | "calendar" | "chart" | "kpi";

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
