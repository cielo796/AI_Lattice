"use client";

import { Icon } from "@/components/shared/Icon";

const tools = [
  { icon: "near_me", label: "選択" },
  { icon: "add_box", label: "ノード追加" },
  { icon: "pan_tool", label: "パン" },
  { icon: "zoom_in", label: "ズーム" },
];

export function WorkflowToolbar() {
  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
      {tools.map((tool) => (
        <button
          key={tool.label}
          title={tool.label}
          className="w-10 h-10 bg-surface-container rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
        >
          <Icon name={tool.icon} size="md" />
        </button>
      ))}
    </div>
  );
}
