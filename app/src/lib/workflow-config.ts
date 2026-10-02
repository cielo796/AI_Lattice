import type { Workflow, WorkflowDefinition, WorkflowEditorContext } from "@/types/workflow";

const roleTypes = ["system_admin", "tenant_admin", "app_admin", "approver", "user", "viewer"];
const blockedHeaders = ["authorization", "cookie", "host", "connection", "content-length", "transfer-encoding", "idempotency-key", "proxy-authorization"];

export function parseWorkflowHeaders(value: unknown): Record<string, string> {
  const parsed = typeof value === "string" ? JSON.parse(value || "{}") as unknown : value ?? {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("ヘッダーはJSONオブジェクトで指定してください。");
  for (const [name, content] of Object.entries(parsed)) {
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(name) || blockedHeaders.includes(name.toLowerCase()) || typeof content !== "string" || /[\r\n]/.test(content)) {
      throw new Error("ヘッダー名・値が不正です。認証情報や予約ヘッダーは保存できません。");
    }
  }
  return parsed as Record<string, string>;
}

export function validateWorkflowNodeConfig(node: WorkflowDefinition["nodes"][number], triggerType?: Workflow["triggerType"]) {
  const config = node.data.config ?? {};
  const errors: string[] = [];
  const textKeys: Record<string, string[]> = {
    trigger: ["tableId", "tableCode", "triggerType"],
    condition: ["fieldCode", "statusFieldCode", "operator", "yesLabel", "noLabel"],
    approval: ["policy", "approverId", "titleTemplate", "description", "pendingStatus", "approvedStatus", "rejectedStatus", "returnedStatus"],
    notification: ["roleType", "title", "body", "dedupeKey"],
    status_update: ["status", "recordStatus"],
    api_call: ["url", "method", "bodyTemplate"],
    ai_action: ["action", "model", "promptTemplateKey", "output", "outputFieldCode"],
  };
  for (const key of textKeys[node.data.nodeType] ?? []) {
    if (config[key] !== undefined && (typeof config[key] !== "string" || !(config[key] as string).trim())) errors.push(`${key} は空でない文字列を指定してください。`);
  }
  if (config.required !== undefined && typeof config.required !== "boolean") errors.push("required は真偽値を指定してください。");
  if (node.position && (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y))) errors.push("ノード位置が不正です。");
  if (node.data.nodeType === "trigger" && config.triggerType !== undefined && (!["create", "update", "status_change", "schedule", "webhook"].includes(String(config.triggerType)) || (triggerType && config.triggerType !== triggerType))) errors.push("ノードのトリガー種別をワークフローと一致させてください。");
  if (node.data.nodeType === "trigger" && config.scheduleIntervalMinutes !== undefined && (!Number.isInteger(config.scheduleIntervalMinutes) || Number(config.scheduleIntervalMinutes) < 1 || Number(config.scheduleIntervalMinutes) > 10080)) errors.push("スケジュール間隔は1〜10080分の整数で指定してください。");
  if (node.data.nodeType === "notification" && config.roleType !== undefined && !roleTypes.includes(String(config.roleType))) errors.push("通知先ロールが不正です。");
  if (node.data.nodeType === "condition") {
    const configured = ["fieldCode", "statusFieldCode", "operator", "value", "expectedValue", "status"].some((key) => config[key] !== undefined);
    if (configured && !["empty", "not_empty"].includes(String(config.operator)) && config.value === undefined && config.expectedValue === undefined && config.status === undefined) errors.push("比較値を指定してください。");
    if (["greater_than", "less_than"].includes(String(config.operator))) {
      const expected = config.value ?? config.expectedValue ?? config.status;
      if (expected === "" || expected === null || typeof expected === "boolean" || !Number.isFinite(Number(expected))) errors.push("大小比較には数値の比較値を指定してください。");
    }
  }
  if (node.data.nodeType === "api_call") {
    try { parseWorkflowHeaders(config.headers); } catch (error) { errors.push(error instanceof Error ? error.message : "ヘッダーが不正です。"); }
    if (config.bodyTemplate !== undefined) {
      try { JSON.parse(String(config.bodyTemplate)); } catch { errors.push("本文テンプレートはJSONで指定してください。変数は文字列の中に記述してください。"); }
      if (["GET", "HEAD"].includes(String(config.method ?? "POST").toUpperCase())) errors.push("GET / HEAD に本文は指定できません。");
    }
    if (config.timeoutMs !== undefined && (!Number.isInteger(config.timeoutMs) || Number(config.timeoutMs) < 100 || Number(config.timeoutMs) > 30000)) errors.push("タイムアウトは100〜30000ミリ秒の整数で指定してください。");
  }
  if (node.data.nodeType === "ai_action") {
    if (config.model !== undefined && !/^[a-z0-9][a-z0-9._:-]{0,99}$/i.test(String(config.model))) errors.push("モデル名が不正です。");
    if (config.output !== undefined && !["comment", "field"].includes(String(config.output))) errors.push("AI出力先は comment / field を指定してください。");
    if (config.output === "field" && (typeof config.outputFieldCode !== "string" || !config.outputFieldCode.trim())) errors.push("AI出力先フィールドを指定してください。");
  }
  return errors.map((error) => `「${node.data.label}」: ${error}`);
}

export function validateWorkflowReferences(definition: WorkflowDefinition, context: WorkflowEditorContext) {
  const errors: string[] = [];
  const trigger = definition.nodes.find((node) => node.data.nodeType === "trigger")?.data.config;
  const tables = context.tables.filter((table) => (!trigger?.tableId || table.id === trigger.tableId) && (!trigger?.tableCode || table.code === trigger.tableCode));
  if ((trigger?.tableId || trigger?.tableCode) && !tables.length) errors.push("トリガーの対象テーブルがこのアプリに存在しません。");
  for (const node of definition.nodes) {
    const config = node.data.config ?? {};
    const addError = (message: string) => errors.push(`「${node.data.label}」: ${message}`);
    if (node.data.nodeType === "condition") {
      const fieldCode = config.fieldCode ?? config.statusFieldCode ?? "status";
      if (fieldCode !== "status" && (!tables.length || tables.some((table) => !table.fields.some((field) => field.code === fieldCode)))) addError("比較フィールドが対象テーブルに存在しません。必要ならトリガーでテーブルを限定してください。");
    }
    if (node.data.nodeType === "notification" && Array.isArray(config.recipientIds)) {
      for (const recipientId of config.recipientIds) if (!context.users.some((user) => user.id === recipientId)) addError("通知先ユーザーがこの組織に存在しないか停止しています。");
    }
    if (node.data.nodeType === "approval") {
      if (config.policy === "app" && !context.approvalPolicy?.enabled) addError("アプリ承認設定を有効にしてください。");
      if (config.policy === "app" && context.approvalPolicy?.targetTableId && (tables.length !== 1 || tables[0].id !== context.approvalPolicy.targetTableId)) addError("トリガーの対象テーブルをアプリ承認設定と一致させてください。");
      if (config.approverId !== undefined && !context.users.some((user) => user.id === config.approverId)) addError("承認者がこの組織に存在しないか停止しています。");
    }
    if (node.data.nodeType === "api_call") {
      try { if (!context.allowedApiOrigins.includes(new URL(String(config.url)).origin)) addError("API送信先はサーバーの許可リストにありません。"); } catch { }
    }
    if (node.data.nodeType === "ai_action") {
      if (config.output === "field" && (!tables.length || tables.some((table) => !table.fields.some((field) => field.code === config.outputFieldCode && ["text", "textarea", "ai_generated"].includes(field.fieldType))))) addError("AI出力先には対象テーブルの文字列フィールドを指定してください。");
      if (config.promptTemplateKey !== undefined && !context.promptTemplates.some((template) => template.key === config.promptTemplateKey && template.operation === `record.${config.action ?? "summarize"}`)) addError("このAIアクション用の有効なPrompt Templateを指定してください。");
    }
  }
  return [...new Set(errors)];
}
