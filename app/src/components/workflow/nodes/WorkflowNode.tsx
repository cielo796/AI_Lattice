"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Icon } from "@/components/shared/Icon";
import { cn } from "@/lib/cn";
import { workflowBranchOptions, workflowNodeLabels } from "@/lib/workflow-editor";
import type { WorkflowNodeData, WorkflowNodeType } from "@/types/workflow";

const icons: Record<WorkflowNodeType, string> = { trigger: "send", condition: "rule", approval: "how_to_reg", notification: "notifications_active", status_update: "sync", api_call: "api", ai_action: "auto_awesome" };

export function WorkflowNode({ id, data, selected, isConnectable }: NodeProps<WorkflowNodeData>) {
  const branches = workflowBranchOptions({ id, data }).filter((branch) => branch.value);
  return (
    <div className={cn("relative w-56 rounded-xl border bg-surface px-4 py-3 shadow-sm", selected ? "border-primary ring-2 ring-primary/30" : "border-outline-variant")}>
      <div className="mb-2 flex items-center gap-2 text-primary">
        <Icon name={icons[data.nodeType]} size="sm" />
        <span className="text-[11px] font-semibold">{workflowNodeLabels[data.nodeType]}</span>
      </div>
      <div className="text-sm font-semibold text-on-surface">{data.label}</div>
      {data.description && <p className="mt-1 text-xs text-on-surface-variant">{data.description}</p>}
      {branches.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{branches.map((branch) => <span key={branch.value} className="rounded bg-surface-container-high px-2 py-0.5 text-[10px] text-on-surface-variant">{branch.label}</span>)}</div>}
      {data.nodeType !== "trigger" && <Handle type="target" position={Position.Left} isConnectable={isConnectable} aria-label={`${data.label}の入力`} className="!h-3 !w-3 !bg-primary" />}
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} aria-label={`${data.label}の出力`} style={branches.length ? { top: "90%" } : undefined} className="!h-3 !w-3 !bg-primary" />
      {branches.map((branch, index) => <Handle key={branch.value} id={branch.value} type="source" position={Position.Right} isConnectable={isConnectable} aria-label={`${data.label}の${branch.label}分岐`} style={{ top: `${20 + index * 55 / Math.max(1, branches.length - 1)}%` }} className="!h-3 !w-3 !bg-tertiary" />)}
    </div>
  );
}
