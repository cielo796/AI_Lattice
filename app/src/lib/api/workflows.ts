import { apiFetch } from "@/lib/api/client";
import type { Workflow, WorkflowDefinition } from "@/types/workflow";

export interface CreateWorkflowInput {
  name: string;
  triggerType?: Workflow["triggerType"];
  status?: Workflow["status"];
  definitionJson?: WorkflowDefinition;
}

export interface UpdateWorkflowInput {
  name?: string;
  triggerType?: Workflow["triggerType"];
  status?: Workflow["status"];
  definitionJson?: WorkflowDefinition;
}

function workflowsPath(appId: string) {
  return `/api/apps/${appId}/workflows`;
}

function workflowPath(appId: string, workflowId: string) {
  return `${workflowsPath(appId)}/${workflowId}`;
}

export async function listWorkflows(appId: string) {
  return apiFetch<Workflow[]>(workflowsPath(appId));
}

export async function createWorkflow(appId: string, input: CreateWorkflowInput) {
  return apiFetch<Workflow>(workflowsPath(appId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getWorkflow(appId: string, workflowId: string) {
  return apiFetch<Workflow>(workflowPath(appId, workflowId));
}

export async function updateWorkflow(
  appId: string,
  workflowId: string,
  input: UpdateWorkflowInput
) {
  return apiFetch<Workflow>(workflowPath(appId, workflowId), {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteWorkflow(appId: string, workflowId: string) {
  await apiFetch<string>(workflowPath(appId, workflowId), {
    method: "DELETE",
  });
}
