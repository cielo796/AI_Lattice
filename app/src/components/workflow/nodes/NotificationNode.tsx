"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { Icon } from "@/components/shared/Icon";
import type { WorkflowNodeData } from "@/types/workflow";

export function NotificationNode({ data }: NodeProps<WorkflowNodeData>) {
  return (
    <div className="bg-surface-container rounded-xl p-4 w-56 shadow-[0_12px_40px_rgba(11,28,48,0.4)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-amber-500/20 rounded-lg flex items-center justify-center">
          <Icon name="notifications_active" size="sm" className="text-amber-400" />
        </div>
        <span className="text-[10px] font-bold text-amber-400 tracking-widest uppercase">
          Notification
        </span>
      </div>
      <div className="text-sm font-bold text-white">{data.label}</div>
      {data.description && (
        <div className="text-xs text-on-surface-variant mt-1">{data.description}</div>
      )}
      <Handle type="target" position={Position.Left} className="!bg-outline !w-2 !h-2" />
    </div>
  );
}
