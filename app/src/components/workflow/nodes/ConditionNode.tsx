"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Icon } from "@/components/shared/Icon";
import type { WorkflowNodeData } from "@/types/workflow";

export function ConditionNode({ data }: NodeProps<WorkflowNodeData>) {
  return (
    <div className="w-56 rounded-xl border border-outline-variant bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.06)]">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-container">
          <Icon name="rule" size="sm" className="text-[#f1bd6c]" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6e4a14]">
          条件分岐
        </span>
      </div>
      <div className="text-[13.5px] font-semibold tracking-tight text-on-surface">
        {data.label}
      </div>
      <div className="mt-3 flex gap-2">
        <span className="rounded-full bg-success-container px-2 py-0.5 text-[10px] font-semibold text-on-success-container">
          はい
        </span>
        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
          いいえ
        </span>
      </div>
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
