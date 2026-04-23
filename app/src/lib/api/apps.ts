import type { App, AppField, AppTable, FieldType } from "@/types/app";
import type { GeneratedAppBlueprint } from "@/types/ai";
import { apiFetch } from "@/lib/api/client";

export interface CreateTableInput {
  name: string;
  code?: string;
  isSystem?: boolean;
  sortOrder?: number;
}

export interface UpdateTableInput {
  name?: string;
  code?: string;
  isSystem?: boolean;
  sortOrder?: number;
}

export interface CreateFieldInput {
  name: string;
  code?: string;
  fieldType: FieldType;
  required?: boolean;
  uniqueFlag?: boolean;
  defaultValue?: unknown;
  settingsJson?: Record<string, unknown>;
  sortOrder?: number;
}

export interface UpdateFieldInput {
  name?: string;
  code?: string;
  fieldType?: FieldType;
  required?: boolean;
  uniqueFlag?: boolean;
  defaultValue?: unknown;
  settingsJson?: Record<string, unknown>;
  sortOrder?: number;
}

function appPath(appId: string) {
  return `/api/apps/${appId}`;
}

function appBlueprintPath() {
  return "/api/apps/blueprints";
}

function appGeneratePath() {
  return "/api/apps/generate";
}

function tableCollectionPath(appId: string) {
  return `${appPath(appId)}/tables`;
}

function tableItemPath(appId: string, tableId: string) {
  return `${tableCollectionPath(appId)}/${tableId}`;
}

function fieldCollectionPath(appId: string, tableId: string) {
  return `${tableItemPath(appId, tableId)}/fields`;
}

function fieldItemPath(appId: string, tableId: string, fieldId: string) {
  return `${fieldCollectionPath(appId, tableId)}/${fieldId}`;
}

export async function listApps() {
  return apiFetch<App[]>("/api/apps");
}

export async function generateAppBlueprint(prompt: string) {
  return apiFetch<GeneratedAppBlueprint>(appGeneratePath(), {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export async function createAppFromBlueprint(blueprint: GeneratedAppBlueprint) {
  return apiFetch<App>(appBlueprintPath(), {
    method: "POST",
    body: JSON.stringify(blueprint),
  });
}

export async function deleteApp(appId: string) {
  await apiFetch<string>(appPath(appId), {
    method: "DELETE",
  });
}

export async function listTables(appId: string) {
  return apiFetch<AppTable[]>(tableCollectionPath(appId));
}

export async function createTable(appId: string, input: CreateTableInput) {
  return apiFetch<AppTable>(tableCollectionPath(appId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTable(
  appId: string,
  tableId: string,
  input: UpdateTableInput
) {
  return apiFetch<AppTable>(tableItemPath(appId, tableId), {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteTable(appId: string, tableId: string) {
  await apiFetch<string>(tableItemPath(appId, tableId), {
    method: "DELETE",
  });
}

export async function listFields(appId: string, tableId: string) {
  return apiFetch<AppField[]>(fieldCollectionPath(appId, tableId));
}

export async function createField(
  appId: string,
  tableId: string,
  input: CreateFieldInput
) {
  return apiFetch<AppField>(fieldCollectionPath(appId, tableId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateField(
  appId: string,
  tableId: string,
  fieldId: string,
  input: UpdateFieldInput
) {
  return apiFetch<AppField>(fieldItemPath(appId, tableId, fieldId), {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteField(
  appId: string,
  tableId: string,
  fieldId: string
) {
  await apiFetch<string>(fieldItemPath(appId, tableId, fieldId), {
    method: "DELETE",
  });
}
