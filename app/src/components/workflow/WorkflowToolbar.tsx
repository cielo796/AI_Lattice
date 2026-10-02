"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/Icon";
import { workflowNodeLabels } from "@/lib/workflow-editor";
import type { WorkflowNodeType } from "@/types/workflow";

interface WorkflowToolbarProps {
  mode: "select" | "pan";
  onModeChange: (mode: "select" | "pan") => void;
  onAdd: (nodeType: WorkflowNodeType) => void;
  onZoom: (direction: "in" | "out" | "fit") => void;
  readOnly: boolean;
  hasTrigger: boolean;
}

export function WorkflowToolbar({ mode, onModeChange, onAdd, onZoom, readOnly, hasTrigger }: WorkflowToolbarProps) {
  const [showPalette, setShowPalette] = useState(false);
  const buttonClass = "flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40";
  return (
    <div className="absolute left-4 top-4 z-10 rounded-xl border border-outline-variant bg-surface p-1 shadow-md">
      <div className="flex gap-1">
        <button type="button" title="選択" aria-label="選択モード" aria-pressed={mode === "select"} onClick={() => onModeChange("select")} className={buttonClass}><Icon name="near_me" /></button>
        <button type="button" title="ノード追加" aria-label="ノード追加" aria-expanded={showPalette} disabled={readOnly} onClick={() => setShowPalette(!showPalette)} className={buttonClass}><Icon name="add_box" /></button>
        <button type="button" title="パン" aria-label="パンモード" aria-pressed={mode === "pan"} onClick={() => onModeChange("pan")} className={buttonClass}><Icon name="pan_tool" /></button>
        <button type="button" title="拡大" aria-label="拡大" onClick={() => onZoom("in")} className={buttonClass}><Icon name="zoom_in" /></button>
        <button type="button" title="縮小" aria-label="縮小" onClick={() => onZoom("out")} className={buttonClass}><Icon name="zoom_out" /></button>
        <button type="button" title="全体表示" aria-label="全体表示" onClick={() => onZoom("fit")} className={buttonClass}><Icon name="fit_screen" /></button>
      </div>
      {showPalette && !readOnly && <div className="mt-1 grid grid-cols-2 gap-1 border-t border-outline-variant pt-2" aria-label="ノード種類">
        {(Object.keys(workflowNodeLabels) as WorkflowNodeType[]).map((nodeType) => <button key={nodeType} type="button" disabled={nodeType === "trigger" && hasTrigger} className="rounded px-2 py-2 text-left text-xs text-on-surface hover:bg-surface-container-high disabled:opacity-40" onClick={() => { onAdd(nodeType); setShowPalette(false); }}>追加: {workflowNodeLabels[nodeType]}</button>)}
      </div>}
    </div>
  );
}
