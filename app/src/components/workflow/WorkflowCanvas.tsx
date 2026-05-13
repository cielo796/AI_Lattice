"use client";

import { useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  type Edge,
  type Node,
  useNodesState,
  useEdgesState,
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

export function WorkflowCanvas({
  nodes = mockWorkflowNodes,
  edges = mockWorkflowEdges,
  onChange,
}: WorkflowCanvasProps) {
  const nodeTypes = useMemo(
    () => ({
      triggerNode: TriggerNode,
      conditionNode: ConditionNode,
      approvalNode: ApprovalNode,
      notificationNode: NotificationNode,
    }),
    []
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setFlowNodes(nodes);
    setFlowEdges(edges);
  }, [edges, nodes, setFlowEdges, setFlowNodes]);

  useEffect(() => {
    onChange?.({ nodes: flowNodes, edges: flowEdges });
  }, [flowEdges, flowNodes, onChange]);

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
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
