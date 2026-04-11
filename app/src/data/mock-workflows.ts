import type { Node, Edge } from "reactflow";
import type { WorkflowNodeData } from "@/types/workflow";

export const mockWorkflowNodes: Node<WorkflowNodeData>[] = [
  {
    id: "wf-node-1",
    type: "triggerNode",
    position: { x: 150, y: 200 },
    data: {
      label: "Record Created",
      description: "Source: Salesforce Opportunities",
      nodeType: "trigger",
    },
  },
  {
    id: "wf-node-2",
    type: "conditionNode",
    position: { x: 500, y: 200 },
    data: {
      label: "If Amount > 30k",
      nodeType: "condition",
    },
  },
  {
    id: "wf-node-3",
    type: "approvalNode",
    position: { x: 850, y: 120 },
    data: {
      label: "Manager Approval",
      description: "Requires manager sign-off for high-value records",
      nodeType: "approval",
      isAIProposed: true,
    },
  },
  {
    id: "wf-node-4",
    type: "notificationNode",
    position: { x: 850, y: 300 },
    data: {
      label: "Send Notification",
      description: "Notify team via Slack",
      nodeType: "notification",
    },
  },
];

export const mockWorkflowEdges: Edge[] = [
  {
    id: "wf-edge-1",
    source: "wf-node-1",
    target: "wf-node-2",
    animated: true,
    style: { stroke: "#475569", strokeWidth: 2, strokeDasharray: "8 4" },
  },
  {
    id: "wf-edge-2",
    source: "wf-node-2",
    target: "wf-node-3",
    label: "True",
    animated: true,
    style: { stroke: "#10b981", strokeWidth: 2 },
  },
  {
    id: "wf-edge-3",
    source: "wf-node-2",
    target: "wf-node-4",
    label: "False",
    style: { stroke: "#475569", strokeWidth: 2, strokeDasharray: "8 4" },
  },
];
