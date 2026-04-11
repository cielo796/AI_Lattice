"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/shared/Icon";
import type { WorkflowNodeData } from "@/types/workflow";

export function ApprovalNode({ data }: NodeProps<WorkflowNodeData>) {
  const isAI = data.isAIProposed;
  return (
    <div
      className={cn(
        "rounded-xl p-4 w-56 shadow-[0_12px_40px_rgba(11,28,48,0.4)] relative",
        isAI
          ? "bg-emerald-950/50 ring-2 ring-primary/50 ring-offset-2 ring-offset-surface"
          : "bg-surface-container"
      )}
    >
      {isAI && (
        <div className="absolute -top-3 -right-3 px-2 py-0.5 bg-primary text-white text-[9px] font-bold rounded-full flex items-center gap-1">
          <Icon name="auto_awesome" size="sm" filled />
          AI PROPOSED
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-primary/20 rounded-lg flex items-center justify-center">
          <Icon name="how_to_reg" size="sm" className="text-primary" />
        </div>
        <span className="text-[10px] font-bold text-primary tracking-widest uppercase">
          Approval
        </span>
      </div>
      <div className="text-sm font-bold text-white">{data.label}</div>
      {data.description && (
        <div className="text-xs text-on-surface-variant mt-1">{data.description}</div>
      )}
      <Handle type="target" position={Position.Left} className="!bg-outline !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-outline !w-2 !h-2" />
    </div>
  );
}
