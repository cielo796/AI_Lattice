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
    <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 flex-row gap-2 md:left-6 md:top-1/2 md:translate-x-0 md:-translate-y-1/2 md:flex-col">
      {tools.map((tool) => (
        <button
          key={tool.label}
          title={tool.label}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
        >
          <Icon name={tool.icon} size="md" />
        </button>
      ))}
    </div>
  );
}
