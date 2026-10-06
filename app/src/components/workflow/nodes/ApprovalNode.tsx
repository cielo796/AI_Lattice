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
        "relative w-56 rounded-xl border bg-surface px-4 py-3 shadow-card",
        isAI
          ? "border-tertiary ring-2 ring-tertiary/30 ring-offset-2 ring-offset-surface-container-low"
          : "border-outline-variant"
      )}
    >
      {isAI && (
        <div className="absolute -right-3 -top-3 inline-flex items-center gap-1 rounded-full bg-tertiary px-2 py-0.5 text-[10px] font-semibold text-on-primary shadow-sm">
          <Icon name="auto_awesome" size="sm" filled />
          AI提案
        </div>
      )}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-container">
          <Icon name="how_to_reg" size="sm" className="text-on-surface-variant" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
          承認
        </span>
      </div>
      <div className="text-[13.5px] font-semibold tracking-tight text-on-surface">
        {data.label}
      </div>
      {data.description && (
        <div className="mt-1 text-[12px] text-on-surface-variant">
          {data.description}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-surface !bg-outline-strong"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-surface !bg-outline-strong"
      />
    </div>
  );
}
