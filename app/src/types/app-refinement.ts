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
