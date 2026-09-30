import { describe, expect, it } from "vitest";
import { connectEditorNodes, createWorkflowTemplate, duplicateEditorNode, removeEditorNode } from "./workflow-editor";
import { validateWorkflowGraph } from "./workflow-graph";

describe("workflow editor operations", () => {
  it("creates independent blank and app-policy approval templates", () => {
    const blank = createWorkflowTemplate("blank");
    const approval = createWorkflowTemplate("approval");
    expect(blank.nodes).toHaveLength(1);
    expect(approval.nodes).toHaveLength(3);
    expect(approval.nodes[1].data.config?.policy).toBe("app");
    expect(validateWorkflowGraph(approval, { active: true })).toEqual([]);
    expect(blank.nodes[0].id).not.toBe(approval.nodes[0].id);
  });

  it("duplicates config without sharing it or duplicating the entry trigger", () => {
    const graph = createWorkflowTemplate("approval");
    expect(duplicateEditorNode(graph, graph.nodes[0].id)).toBe(graph);
    const duplicated = duplicateEditorNode(graph, graph.nodes[1].id);
    expect(duplicated.nodes).toHaveLength(4);
    duplicated.nodes[3].data.config!.policy = "override";
    expect(graph.nodes[1].data.config?.policy).toBe("app");
    expect(duplicated.edges).toEqual(graph.edges);
  });

  it("deletes incident edges while preserving metadata", () => {
    const graph = { ...createWorkflowTemplate("approval"), metadata: { version: 2 } };
    const result = removeEditorNode(graph, graph.nodes[1].id);
    expect(result.edges).toEqual([]);
    expect(result.metadata).toEqual(graph.metadata);
  });

  it("rejects duplicate, missing, backward and cyclic connections", () => {
    const graph = createWorkflowTemplate("approval");
    expect(connectEditorNodes(graph, graph.nodes[0].id, graph.nodes[1].id).error).toBeTruthy();
    expect(connectEditorNodes(graph, graph.nodes[0].id, "missing").error).toBeTruthy();
    expect(connectEditorNodes(graph, graph.nodes[2].id, graph.nodes[0].id).error).toBeTruthy();
    expect(connectEditorNodes(graph, graph.nodes[2].id, graph.nodes[1].id).error).toBeTruthy();
    expect(connectEditorNodes(graph, graph.nodes[1].id, graph.nodes[2].id, "rejected").error).toBeNull();
  });
});
