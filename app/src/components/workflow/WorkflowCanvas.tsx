"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { TriggerNode } from "./nodes/TriggerNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { ApprovalNode } from "./nodes/ApprovalNode";
import { NotificationNode } from "./nodes/NotificationNode";
import { mockWorkflowNodes, mockWorkflowEdges } from "@/data/mock-workflows";

export function WorkflowCanvas() {
  const nodeTypes = useMemo(
    () => ({
      triggerNode: TriggerNode,
      conditionNode: ConditionNode,
      approvalNode: ApprovalNode,
      notificationNode: NotificationNode,
    }),
    []
  );

  const [nodes, , onNodesChange] = useNodesState(mockWorkflowNodes);
  const [edges, , onEdgesChange] = useEdgesState(mockWorkflowEdges);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
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
