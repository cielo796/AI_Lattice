"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Icon } from "@/components/shared/Icon";
import type { WorkflowNodeData } from "@/types/workflow";

export function TriggerNode({ data }: NodeProps<WorkflowNodeData>) {
  return (
    <div className="bg-surface-container rounded-xl p-4 w-56 shadow-[0_12px_40px_rgba(11,28,48,0.4)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center">
          <Icon name="send" size="sm" className="text-blue-400" />
        </div>
        <span className="text-[10px] font-bold text-blue-400 tracking-widest uppercase">
          Trigger
        </span>
      </div>
      <div className="text-sm font-bold text-white">{data.label}</div>
      {data.description && (
        <div className="text-xs text-on-surface-variant mt-1">{data.description}</div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-outline !w-2 !h-2" />
    </div>
  );
}
