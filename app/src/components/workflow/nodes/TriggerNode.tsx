"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Icon } from "@/components/shared/Icon";
import type { WorkflowNodeData } from "@/types/workflow";

export function TriggerNode({ data }: NodeProps<WorkflowNodeData>) {
  return (
    <div className="w-56 rounded-xl border border-outline-variant bg-surface px-4 py-3 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-container">
          <Icon name="send" size="sm" className="text-on-surface-variant" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
          トリガー
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
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-surface !bg-outline-strong"
      />
    </div>
  );
}
