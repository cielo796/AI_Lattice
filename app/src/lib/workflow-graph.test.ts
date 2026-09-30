import { describe, expect, it } from "vitest";
import { validateWorkflowGraph, workflowEntryId, workflowNextNodeIds } from "./workflow-graph";
import type { WorkflowDefinition } from "@/types/workflow";

const graph: WorkflowDefinition = {
  nodes: [
    { id: "no", data: { label: "No", nodeType: "notification" } },
    { id: "approval", data: { label: "Approve", nodeType: "approval" } },
    { id: "trigger", data: { label: "Start", nodeType: "trigger" } },
    { id: "condition", data: { label: "If", nodeType: "condition", config: { operator: "greater_than", value: 10 } } },
  ],
  edges: [
    { id: "start", source: "trigger", target: "condition" },
    { id: "yes", source: "condition", target: "approval", label: "yes" },
    { id: "no", source: "condition", target: "no", label: "no" },
  ],
};

describe("workflow graph", () => {
  it("starts at the trigger regardless of node order and selects both condition outcomes", () => {
    expect(validateWorkflowGraph(graph, { active: true })).toEqual([]);
    expect(workflowEntryId(graph)).toBe("trigger");
    expect(workflowNextNodeIds(graph, "condition", "yes")).toEqual(["approval"]);
    expect(workflowNextNodeIds(graph, "condition", "no")).toEqual(["no"]);
  });

  it.each(["approved", "rejected", "returned"])("follows only the %s approval branch and shared continuations", (outcome) => {
    const definition = { ...graph, edges: [
      ...graph.edges,
      ...["approved", "rejected", "returned"].map((label) => ({ id: label, source: "approval", target: label, label })),
      { id: "shared", source: "approval", target: "shared" },
    ] };
    expect(workflowNextNodeIds(definition, "approval", outcome)).toEqual([outcome, "shared"]);
  });

  it.each([
    (definition: WorkflowDefinition) => definition.nodes.push(definition.nodes[0]),
    (definition: WorkflowDefinition) => definition.edges.push(definition.edges[0]),
    (definition: WorkflowDefinition) => definition.edges.push({ id: "missing", source: "trigger", target: "missing" }),
    (definition: WorkflowDefinition) => definition.edges.push({ id: "cycle", source: "approval", target: "condition" }),
    (definition: WorkflowDefinition) => definition.nodes.push({ id: "orphan", data: { label: "Orphan", nodeType: "notification" } }),
    (definition: WorkflowDefinition) => definition.nodes.push({ id: "second", data: { label: "Second", nodeType: "trigger" } }),
    (definition: WorkflowDefinition) => { definition.nodes[3].data.config = { operator: "unknown" }; },
    (definition: WorkflowDefinition) => { definition.nodes[0].data = { label: "Empty status", nodeType: "status_update" }; },
    (definition: WorkflowDefinition) => { definition.nodes[0].data = { label: "Numeric status", nodeType: "status_update", config: { status: 1 } }; },
    (definition: WorkflowDefinition) => { definition.nodes[3].data.config = { value: { invalid: true } }; },
    (definition: WorkflowDefinition) => { definition.nodes[3].data.config = { yesLabel: "same", noLabel: "same" }; },
    (definition: WorkflowDefinition) => { definition.nodes[0].data.config = { recipientIds: "not-an-array" }; },
    (definition: WorkflowDefinition) => { definition.nodes[1].data.config = { policy: "invalid" }; },
    (definition: WorkflowDefinition) => { definition.nodes[0].data = { label: "Bad API", nodeType: "api_call", config: { url: "file:///etc/passwd" } }; },
  ])("rejects an invalid active graph", (mutate) => {
    const definition = structuredClone(graph);
    mutate(definition);
    expect(validateWorkflowGraph(definition, { active: true }).length).toBeGreaterThan(0);
  });

  it("allows disconnected drafts and infers a single legacy entry, never array order", () => {
    expect(validateWorkflowGraph({ nodes: [graph.nodes[0]], edges: [] })).toEqual([]);
    expect(workflowEntryId({ nodes: [graph.nodes[0]], edges: [] })).toBe("no");
    expect(validateWorkflowGraph({ nodes: [graph.nodes[0]], edges: [] }, { active: true, legacy: true })).toEqual([]);
  });
});
