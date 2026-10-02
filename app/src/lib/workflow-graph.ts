import type { Workflow, WorkflowDefinition, WorkflowNodeType } from "@/types/workflow";
import { validateWorkflowNodeConfig } from "./workflow-config";

const nodeTypes: WorkflowNodeType[] = ["trigger", "condition", "approval", "notification", "status_update", "api_call", "ai_action"];
const operators = ["equals", "not_equals", "contains", "greater_than", "less_than", "empty", "not_empty"];

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function workflowEdgeBranch(edge: WorkflowDefinition["edges"][number]) {
  return (typeof edge.sourceHandle === "string" && edge.sourceHandle ? edge.sourceHandle : edge.label ?? "").trim().toLowerCase();
}

export function workflowEntryId(definition: WorkflowDefinition) {
  const triggers = definition.nodes.filter((node) => node.data.nodeType === "trigger");
  if (triggers.length === 1) return triggers[0].id;
  const roots = definition.nodes.filter((node) => !definition.edges.some((edge) => edge.target === node.id));
  return triggers.length === 0 && roots.length === 1 ? roots[0].id : undefined;
}

export function workflowNextNodeIds(definition: WorkflowDefinition, nodeId: string, outcome?: string) {
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  return [...new Set(definition.edges.filter((edge) => {
    if (edge.source !== nodeId) return false;
    const branch = workflowEdgeBranch(edge);
    if (node?.data.nodeType === "condition") {
      const yes = ["", "yes", "true", "はい", String(node.data.config?.yesLabel ?? "yes").trim().toLowerCase()];
      const no = ["no", "false", "いいえ", String(node.data.config?.noLabel ?? "no").trim().toLowerCase()];
      return (outcome === "yes" ? yes : no).includes(branch);
    }
    if (node?.data.nodeType === "approval") {
      if (!branch) return true;
      const branches: Record<string, string[]> = {
        approved: ["approved", "approve", "yes", "承認"],
        rejected: ["rejected", "reject", "no", "却下"],
        returned: ["returned", "return", "差戻し"],
      };
      return (branches[outcome ?? ""] ?? []).includes(branch);
    }
    return true;
  }).sort((left, right) => left.id.localeCompare(right.id, "en")).map((edge) => edge.target))];
}

export function validateWorkflowGraph(definition: WorkflowDefinition, options: { active?: boolean; legacy?: boolean; triggerType?: Workflow["triggerType"] } = {}) {
  const errors: string[] = [];
  if (definition.nodes.length > 100 || definition.edges.length > 300) return ["ノードは100件、接続は300件までです。"];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  for (const node of definition.nodes) {
    if (!node.id || nodeIds.has(node.id)) errors.push(`ノードID「${node.id}」が空または重複しています。`);
    nodeIds.add(node.id);
    if (!nonEmptyString(node.data.label)) errors.push(`ノード「${node.id}」の名前を入力してください。`);
    if (!nodeTypes.includes(node.data.nodeType)) errors.push(`ノード「${node.id}」の種類が不正です。`);
    if (!options.active) continue;
    errors.push(...validateWorkflowNodeConfig(node, options.triggerType));
    const config = node.data.config ?? {};
    const prefix = `「${node.data.label}」`;
    if (config.failurePolicy !== undefined && !["continue", "fail"].includes(String(config.failurePolicy))) errors.push(`${prefix}: failurePolicy は continue / fail を指定してください。`);
    if (node.data.nodeType === "condition" && config.operator !== undefined && !operators.includes(String(config.operator))) errors.push(`${prefix}: 条件の演算子が不正です。`);
    if (node.data.nodeType === "status_update" && !nonEmptyString(config.status ?? config.recordStatus)) errors.push(`${prefix}: 更新先ステータスを文字列で指定してください。`);
    if (node.data.nodeType === "trigger") {
      for (const key of ["tableId", "tableCode"]) if (config[key] !== undefined && !nonEmptyString(config[key])) errors.push(`${prefix}: ${key} は空でない文字列で指定してください。`);
    }
    if (node.data.nodeType === "approval" && config.policy !== undefined && !["app", "override"].includes(String(config.policy))) errors.push(`${prefix}: 承認ポリシーが不正です。`);
    if (node.data.nodeType === "notification" && config.recipientIds !== undefined && (!Array.isArray(config.recipientIds) || config.recipientIds.some((recipient) => !nonEmptyString(recipient)))) errors.push(`${prefix}: 通知先ユーザーIDの配列を指定してください。`);
    if (node.data.nodeType === "condition") {
      if (config.fieldCode !== undefined && !nonEmptyString(config.fieldCode)) errors.push(`${prefix}: フィールドコードは空でない文字列で指定してください。`);
      const expected = config.value ?? config.expectedValue ?? config.status;
      if (expected !== undefined && expected !== null && !["string", "number", "boolean"].includes(typeof expected)) errors.push(`${prefix}: 比較値には文字列・数値・真偽値を指定してください。`);
      if (String(config.yesLabel ?? "yes").trim().toLowerCase() === String(config.noLabel ?? "no").trim().toLowerCase()) errors.push(`${prefix}: yes と no の分岐ラベルを別にしてください。`);
      if (["no", "false", "いいえ"].includes(String(config.yesLabel ?? "yes").trim().toLowerCase()) || ["yes", "true", "はい"].includes(String(config.noLabel ?? "no").trim().toLowerCase())) errors.push(`${prefix}: 反対側の分岐に予約されているラベルは指定できません。`);
    }
    if (node.data.nodeType === "api_call") {
      try {
        const url = new URL(String(config.url ?? ""));
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
      } catch { errors.push(`${prefix}: 認証情報を含まないHTTP(S) URLを指定してください。`); }
      if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(String(config.method ?? "POST").toUpperCase())) errors.push(`${prefix}: HTTPメソッドが不正です。`);
    }
    if (node.data.nodeType === "ai_action" && !["summarize", "next_actions", "reply_draft"].includes(String(config.action ?? "summarize"))) errors.push(`${prefix}: AIアクションが不正です。`);
  }
  const triggers = definition.nodes.filter((node) => node.data.nodeType === "trigger");
  if (options.active && (triggers.length !== 1 && !(options.legacy && workflowEntryId(definition)))) errors.push("開始トリガーを1つ設定してください。");
  for (const edge of definition.edges) {
    if (!edge.id || edgeIds.has(edge.id)) errors.push(`接続ID「${edge.id}」が空または重複しています。`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) errors.push(`接続「${edge.id}」の接続先ノードが存在しません。`);
    if (triggers.some((node) => node.id === edge.target)) errors.push(`接続「${edge.id}」は開始トリガーに戻れません。`);
    if (!options.active) continue;
    const source = definition.nodes.find((node) => node.id === edge.source);
    const branch = workflowEdgeBranch(edge);
    if (source?.data.nodeType === "condition" && !["", "yes", "no", "true", "false", "はい", "いいえ", String(source.data.config?.yesLabel ?? "yes").trim().toLowerCase(), String(source.data.config?.noLabel ?? "no").trim().toLowerCase()].includes(branch)) errors.push(`接続「${edge.id}」に yes / no の分岐を指定してください。`);
    if (source?.data.nodeType === "approval" && !["", "approved", "rejected", "returned", "approve", "reject", "return", "yes", "no", "承認", "却下", "差戻し"].includes(branch)) errors.push(`接続「${edge.id}」の承認分岐が不正です。`);
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const edge of definition.edges.filter((item) => item.source === nodeId)) {
      if (visit(edge.target)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }
  if (definition.nodes.some((node) => visit(node.id))) errors.push("循環する接続は実行できません。接続を見直してください。");
  if (options.active && !options.legacy && workflowEntryId(definition)) {
    const reachable = new Set<string>();
    const queue = [workflowEntryId(definition)!];
    while (queue.length) {
      const nodeId = queue.shift()!;
      if (reachable.has(nodeId)) continue;
      reachable.add(nodeId);
      queue.push(...definition.edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target));
    }
    for (const node of definition.nodes) if (!reachable.has(node.id)) errors.push(`「${node.data.label}」が開始トリガーから接続されていません。`);
  }
  return [...new Set(errors)];
}
