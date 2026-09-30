import type { Workflow, WorkflowDefinition, WorkflowNodeType } from "@/types/workflow";
import { validateWorkflowGraph } from "./workflow-graph";

export const workflowNodeLabels: Record<WorkflowNodeType, string> = {
  trigger: "トリガー", condition: "条件分岐", approval: "承認", notification: "通知",
  status_update: "ステータス更新", api_call: "API呼び出し", ai_action: "AIアクション",
};

export const workflowTriggerLabels: Record<Workflow["triggerType"], string> = {
  create: "レコード作成", update: "レコード更新", status_change: "ステータス変更",
  schedule: "スケジュール", webhook: "Webhook",
};

export function workflowNodeViewType(nodeType: WorkflowNodeType) {
  return `${nodeType}EditorNode`;
}

export function createEditorNode(nodeType: WorkflowNodeType, position = { x: 100, y: 120 }): WorkflowDefinition["nodes"][number] {
  const configs: Record<WorkflowNodeType, Record<string, unknown>> = {
    trigger: {}, condition: { fieldCode: "status", operator: "equals", value: "submitted", yesLabel: "yes", noLabel: "no" },
    approval: { policy: "app" }, notification: { title: "{{recordTitle}} の通知", body: "{{tableName}} の処理が完了しました。", failurePolicy: "fail" },
    status_update: { status: "complete" }, api_call: { url: "", method: "POST", timeoutMs: 5000, failurePolicy: "fail" },
    ai_action: { action: "summarize", output: "comment", failurePolicy: "fail" },
  };
  return { id: crypto.randomUUID(), type: workflowNodeViewType(nodeType), position, data: { label: workflowNodeLabels[nodeType], nodeType, config: configs[nodeType] } };
}

export function createWorkflowTemplate(template: "blank" | "approval"): WorkflowDefinition {
  const start = createEditorNode("trigger");
  if (template === "blank") return { nodes: [start], edges: [] };
  const approval = createEditorNode("approval", { x: 430, y: 120 });
  const notification = createEditorNode("notification", { x: 760, y: 120 });
  return { nodes: [start, approval, notification], edges: [
    { id: crypto.randomUUID(), source: start.id, target: approval.id },
    { id: crypto.randomUUID(), source: approval.id, target: notification.id, label: "approved", sourceHandle: "approved" },
  ] };
}

export function duplicateEditorNode(definition: WorkflowDefinition, nodeId: string): WorkflowDefinition {
  const original = definition.nodes.find((node) => node.id === nodeId);
  if (!original || original.data.nodeType === "trigger" || definition.nodes.length >= 100) return definition;
  const copy = structuredClone(original);
  copy.id = crypto.randomUUID();
  copy.data.label += "（コピー）";
  copy.position = { x: (original.position?.x ?? 100) + 50, y: (original.position?.y ?? 120) + 160 };
  return { ...definition, nodes: [...definition.nodes, copy] };
}

export function removeEditorNode(definition: WorkflowDefinition, nodeId: string): WorkflowDefinition {
  return { ...definition, nodes: definition.nodes.filter((node) => node.id !== nodeId), edges: definition.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId) };
}

export function connectEditorNodes(definition: WorkflowDefinition, source: string, target: string, branch = "") {
  if (definition.edges.some((edge) => edge.source === source && edge.target === target && (edge.sourceHandle ?? edge.label ?? "") === branch)) {
    return { definition, error: "同じ接続は既に存在します。" };
  }
  const next = { ...definition, edges: [...definition.edges, { id: crypto.randomUUID(), source, target, ...(branch ? { label: branch, sourceHandle: branch } : {}) }] };
  const errors = validateWorkflowGraph(next);
  return errors.length ? { definition, error: errors[0] } : { definition: next, error: null };
}

export function workflowBranchOptions(node?: WorkflowDefinition["nodes"][number]) {
  if (node?.data.nodeType === "condition") return [
    { value: "yes", label: String(node.data.config?.yesLabel ?? "yes") },
    { value: "no", label: String(node.data.config?.noLabel ?? "no") },
  ];
  if (node?.data.nodeType === "approval") return [
    { value: "", label: "すべての判断後" }, { value: "approved", label: "承認後" },
    { value: "rejected", label: "却下後" }, { value: "returned", label: "差戻し後" },
  ];
  return [{ value: "", label: "次の処理" }];
}
