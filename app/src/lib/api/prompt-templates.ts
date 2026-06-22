import { apiFetch } from "@/lib/api/client";
import type {
  PromptTemplate,
  PromptTemplateVersion,
} from "@/types/prompt-template";

export interface CreatePromptTemplateInput {
  key: string;
  name: string;
  operation: string;
  description?: string;
  modelName: string;
  instructions: string;
  responseSchemaJson?: Record<string, unknown>;
  isActive?: boolean;
}

export interface UpdatePromptTemplateInput {
  name?: string;
  operation?: string;
  description?: string;
}

export interface CreatePromptTemplateVersionInput {
  modelName: string;
  instructions: string;
  responseSchemaJson?: Record<string, unknown>;
  isActive?: boolean;
}

const basePath = "/api/admin/prompt-templates";

export async function listPromptTemplates() {
  return apiFetch<PromptTemplate[]>(basePath);
}

export async function createPromptTemplate(input: CreatePromptTemplateInput) {
  return apiFetch<PromptTemplate>(basePath, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePromptTemplate(
  templateId: string,
  input: UpdatePromptTemplateInput
) {
  return apiFetch<PromptTemplate>(`${basePath}/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function createPromptTemplateVersion(
  templateId: string,
  input: CreatePromptTemplateVersionInput
) {
  return apiFetch<PromptTemplateVersion>(`${basePath}/${templateId}/versions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function activatePromptTemplateVersion(
  templateId: string,
  versionId: string
) {
  return apiFetch<PromptTemplateVersion>(
    `${basePath}/${templateId}/versions/${versionId}/activate`,
    { method: "PATCH" }
  );
}

