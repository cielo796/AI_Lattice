"use client";

import { useMemo, useState } from "react";
import ReactFlow, { Background, BackgroundVariant, applyNodeChanges, type Edge, type Node, type ReactFlowInstance } from "reactflow";
import "reactflow/dist/style.css";
import { WorkflowNode } from "./nodes/WorkflowNode";
import { WorkflowToolbar } from "./WorkflowToolbar";
import { connectEditorNodes, createEditorNode, workflowNodeLabels, workflowNodeViewType } from "@/lib/workflow-editor";
import type { WorkflowDefinition, WorkflowNodeData, WorkflowNodeType } from "@/types/workflow";

const nodeTypes = Object.fromEntries(Object.keys(workflowNodeLabels).map((nodeType) => [workflowNodeViewType(nodeType as WorkflowNodeType), WorkflowNode]));

interface WorkflowCanvasProps {
  definition: WorkflowDefinition;
  onChange: (definition: WorkflowDefinition) => void;
  selectedNodeId: string;
  selectedEdgeId: string;
  onSelect: (selection: { nodeId?: string; edgeId?: string }) => void;
  readOnly: boolean;
  onError: (error: string | null) => void;
}

export function WorkflowCanvas({ definition, onChange, selectedNodeId, selectedEdgeId, onSelect, readOnly, onError }: WorkflowCanvasProps) {
  const [mode, setMode] = useState<"select" | "pan">("select");
  const [instance, setInstance] = useState<ReactFlowInstance | null>(null);
  const nodes = useMemo(() => definition.nodes.map((node, index) => ({ ...node, type: workflowNodeViewType(node.data.nodeType), position: node.position ?? { x: index * 300 + 100, y: 120 }, selected: node.id === selectedNodeId })) as Node<WorkflowNodeData>[], [definition.nodes, selectedNodeId]);
  const edges = useMemo(() => definition.edges.map((edge) => ({ ...edge, selected: edge.id === selectedEdgeId })) as Edge[], [definition.edges, selectedEdgeId]);

  function addNode(nodeType: WorkflowNodeType) {
    if (readOnly || definition.nodes.length >= 100) return;
    const position = instance?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) ?? { x: 400, y: 200 };
    const node = createEditorNode(nodeType, position);
    onChange({ ...definition, nodes: [...definition.nodes, node] });
    onSelect({ nodeId: node.id });
  }

  return (
    <>
      <WorkflowToolbar mode={mode} onModeChange={setMode} onAdd={addNode} readOnly={readOnly} hasTrigger={nodes.some((node) => node.data.nodeType === "trigger")} onZoom={(direction) => { if (direction === "fit") void instance?.fitView({ padding: 0.25 }); else if (direction === "in") void instance?.zoomIn(); else void instance?.zoomOut(); }} />
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={setInstance}
        onNodesChange={(changes) => {
          if (readOnly) return;
          const edits = changes.filter((change) => change.type === "position" || change.type === "remove");
          if (!edits.length) return;
          const nextNodes = applyNodeChanges(edits, nodes).map((node) => {
            const original = definition.nodes.find((candidate) => candidate.id === node.id)!;
            return { ...original, position: node.position };
          });
          onChange({ ...definition, nodes: nextNodes, edges: definition.edges.filter((edge) => nextNodes.some((node) => node.id === edge.source) && nextNodes.some((node) => node.id === edge.target)) });
        }}
        onEdgesChange={(changes) => {
          if (readOnly) return;
          const removed = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
          if (removed.size) onChange({ ...definition, edges: definition.edges.filter((edge) => !removed.has(edge.id)) });
        }}
        onConnect={(connection) => {
          if (readOnly || !connection.source || !connection.target) return;
          const result = connectEditorNodes(definition, connection.source, connection.target, connection.sourceHandle ?? "");
          onError(result.error);
          if (!result.error) onChange(result.definition);
        }}
        onNodeClick={(_event, node) => onSelect({ nodeId: node.id })}
        onEdgeClick={(_event, edge) => onSelect({ edgeId: edge.id })}
        onPaneClick={() => onSelect({})}
        nodesDraggable={!readOnly && mode === "select"} nodesConnectable={!readOnly}
        panOnDrag={mode === "pan" ? true : [1, 2]} selectionOnDrag={mode === "select"}
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        fitView fitViewOptions={{ padding: 0.25 }} minZoom={0.2} maxZoom={2}
        proOptions={{ hideAttribution: true }} className="bg-surface"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#94a3b8" />
      </ReactFlow>
    </>
  );
}
