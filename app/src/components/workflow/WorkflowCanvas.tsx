"use client";

import { useCallback } from "react";
import ReactFlow, {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";

import { TriggerNode } from "./nodes/TriggerNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { ApprovalNode } from "./nodes/ApprovalNode";
import { NotificationNode } from "./nodes/NotificationNode";
import { mockWorkflowNodes, mockWorkflowEdges } from "@/data/mock-workflows";
import type { WorkflowNodeData } from "@/types/workflow";

interface WorkflowCanvasProps {
  nodes?: Node<WorkflowNodeData>[];
  edges?: Edge[];
  onChange?: (definition: {
    nodes: Node<WorkflowNodeData>[];
    edges: Edge[];
  }) => void;
}

const NODE_TYPES: NodeTypes = {
  triggerNode: TriggerNode,
  conditionNode: ConditionNode,
  approvalNode: ApprovalNode,
  notificationNode: NotificationNode,
};

export function WorkflowCanvas({
  nodes = mockWorkflowNodes,
  edges = mockWorkflowEdges,
  onChange,
}: WorkflowCanvasProps) {
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onChange?.({
        nodes: applyNodeChanges(changes, nodes),
        edges,
      });
    },
    [edges, nodes, onChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onChange?.({
        nodes,
        edges: applyEdgeChanges(changes, edges),
      });
    },
    [edges, nodes, onChange]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      proOptions={{ hideAttribution: true }}
      className="bg-surface"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="#334155"
      />
    </ReactFlow>
  );
}
