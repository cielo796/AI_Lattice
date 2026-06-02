import type { AppViewType, FieldType } from "@/types/app";

export type AppRefinementOperationAction =
  | "add_table"
  | "add_field"
  | "update_field"
  | "add_view"
  | "add_form";

export interface AppRefinementOperation {
  action: AppRefinementOperationAction;
  tableCode: string;
  tableName: string;
  fieldCode: string;
  fieldName: string;
  fieldType: "" | FieldType;
  setRequired: boolean;
  required: boolean;
  options: string[];
  viewName: string;
  viewType: AppViewType;
  columns: string[];
  groupByFieldCode: string;
  dateFieldCode: string;
  metricFieldCode: string;
  formName: string;
  formFieldCodes: string[];
  helpText: string;
}

export type AppRefinementChangeType =
  | "table_created"
  | "field_created"
  | "field_updated"
  | "view_created"
  | "form_created";

export interface AppRefinementChange {
  type: AppRefinementChangeType;
  tableCode: string;
  tableName: string;
  resourceName: string;
  description: string;
}

export interface AppRefinementResult {
  summary: string;
  changes: AppRefinementChange[];
}

export interface AppRefinementPreview {
  summary: string;
  operations: AppRefinementOperation[];
  changes: AppRefinementChange[];
}
