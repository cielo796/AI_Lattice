"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Icon } from "@/components/shared/Icon";
import type { WorkflowNodeData } from "@/types/workflow";

export function ConditionNode({ data }: NodeProps<WorkflowNodeData>) {
  return (
    <div className="bg-surface-container rounded-xl p-4 w-56 shadow-[0_12px_40px_rgba(11,28,48,0.4)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-purple-500/20 rounded-lg flex items-center justify-center">
          <Icon name="rule" size="sm" className="text-purple-400" />
        </div>
        <span className="text-[10px] font-bold text-purple-400 tracking-widest uppercase">
          条件分岐
        </span>
      </div>
      <div className="text-sm font-bold text-white">{data.label}</div>
      <div className="flex gap-2 mt-3">
        <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          はい
        </span>
        <span className="text-[10px] text-on-surface-variant bg-surface-container-highest/40 px-2 py-0.5 rounded-full">
          いいえ
        </span>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-outline !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-outline !w-2 !h-2" />
    </div>
  );
}
