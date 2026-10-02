import { describe, expect, it } from "vitest";
import { parseWorkflowHeaders, validateWorkflowNodeConfig, validateWorkflowReferences } from "./workflow-config";
import type { WorkflowDefinition, WorkflowEditorContext } from "@/types/workflow";

const context: WorkflowEditorContext = {
  tables: [{ id: "table", code: "requests", name: "申請", fields: [{ code: "title", name: "件名", fieldType: "text" }, { code: "amount", name: "金額", fieldType: "number" }] }],
  users: [{ id: "user", name: "Owner" }], approvalPolicy: { enabled: true, targetTableId: "table" },
  allowedApiOrigins: ["https://example.com"], promptTemplates: [{ key: "summary", name: "要約", operation: "record.summarize" }],
};

function graph(nodeType: WorkflowDefinition["nodes"][number]["data"]["nodeType"], config: Record<string, unknown>): WorkflowDefinition {
  return { nodes: [{ id: "start", data: { label: "Start", nodeType: "trigger", config: { tableId: "table" } } }, { id: "action", data: { label: "Action", nodeType, config } }], edges: [{ id: "edge", source: "start", target: "action" }] };
}

describe("workflow config validation", () => {
  it.each([0, 10081, 1.5, "60", null, true, NaN])("rejects invalid schedule intervals: %s", (scheduleIntervalMinutes) => {
    const trigger = graph("status_update", { status: "done" }).nodes[0];
    trigger.data.config = { scheduleIntervalMinutes };
    expect(validateWorkflowNodeConfig(trigger, "schedule")).toHaveLength(1);
  });

  it.each([1, 60, 10080])("accepts a bounded schedule interval: %s", (scheduleIntervalMinutes) => {
    const trigger = graph("status_update", { status: "done" }).nodes[0];
    trigger.data.config = { scheduleIntervalMinutes };
    expect(validateWorkflowNodeConfig(trigger, "schedule")).toEqual([]);
  });

  it.each([
    ["api_call", { url: "https://example.com", timeoutMs: 99 }],
    ["api_call", { bodyTemplate: "not json" }],
    ["api_call", { method: "GET", bodyTemplate: "{}" }],
    ["api_call", { headers: '{"Authorization":"secret"}' }],
    ["api_call", { headers: { "X-Test": "bad\r\nvalue" } }],
    ["ai_action", { output: "field" }],
    ["ai_action", { model: "model\nname" }],
    ["notification", { roleType: "unknown" }],
    ["condition", { fieldCode: "amount", operator: "equals" }],
    ["condition", { operator: "greater_than", value: "not numeric" }],
  ] as const)("rejects malformed %s config", (nodeType, config) => {
    expect(validateWorkflowNodeConfig(graph(nodeType, config).nodes[1]).length).toBeGreaterThan(0);
  });

  it("accepts validated API templates and parses headers without exposing auth secrets", () => {
    expect(parseWorkflowHeaders('{"X-Record":"{{recordId}}"}')).toEqual({ "X-Record": "{{recordId}}" });
    expect(validateWorkflowNodeConfig(graph("api_call", { headers: '{"X-Record":"{{recordId}}"}', bodyTemplate: '{"id":"{{recordId}}"}', timeoutMs: 1000 }).nodes[1])).toEqual([]);
  });

  it.each([
    ["condition", { fieldCode: "foreign_field" }],
    ["notification", { recipientIds: ["foreign_user"] }],
    ["approval", { policy: "override", approverId: "inactive_user" }],
    ["api_call", { url: "https://not-allowed.example" }],
    ["ai_action", { output: "field", outputFieldCode: "amount" }],
    ["ai_action", { promptTemplateKey: "foreign_prompt" }],
  ] as const)("rejects unavailable %s references", (nodeType, config) => {
    expect(validateWorkflowReferences(graph(nodeType, config), context).length).toBeGreaterThan(0);
  });

  it("validates app policy, target table and tenant-scoped fields", () => {
    expect(validateWorkflowReferences(graph("approval", { policy: "app" }), context)).toEqual([]);
    expect(validateWorkflowReferences(graph("approval", { policy: "app" }), { ...context, approvalPolicy: null })).toHaveLength(1);
    const wrongScope = graph("condition", { fieldCode: "title" });
    wrongScope.nodes[0].data.config = { tableId: "foreign_table" };
    expect(validateWorkflowReferences(wrongScope, context).length).toBeGreaterThan(0);
    expect(validateWorkflowReferences(graph("ai_action", { output: "field", outputFieldCode: "title", promptTemplateKey: "summary" }), context)).toEqual([]);
  });
});
