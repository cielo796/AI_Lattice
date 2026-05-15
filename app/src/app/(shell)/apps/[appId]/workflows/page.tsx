"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { Edge, Node } from "reactflow";
import { TopBar } from "@/components/shared/TopBar";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { Badge } from "@/components/shared/Badge";
import { AISidebar } from "@/components/ai/AISidebar";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { WorkflowToolbar } from "@/components/workflow/WorkflowToolbar";
import { AICommandBar } from "@/components/workflow/AICommandBar";
import { cn } from "@/lib/cn";
import {
  createWorkflow,
  deleteWorkflow,
  listWorkflows,
  updateWorkflow,
} from "@/lib/api/workflows";
import type {
  Workflow,
  WorkflowDefinition,
  WorkflowNodeData,
} from "@/types/workflow";

const triggerLabels: Record<Workflow["triggerType"], string> = {
  create: "作成",
  update: "更新",
  schedule: "スケジュール",
  webhook: "Webhook",
  status_change: "ステータス変更",
};

function getAppIdFromParams(params: ReturnType<typeof useParams>) {
  const value = params?.appId;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getApprovalNodeCount(definition: WorkflowDefinition | null) {
  return (
    definition?.nodes.filter((node) => node.data.nodeType === "approval").length ?? 0
  );
}

function toReactFlowNodes(definition: WorkflowDefinition | null) {
  return (definition?.nodes ?? []) as Node<WorkflowNodeData>[];
}

function toReactFlowEdges(definition: WorkflowDefinition | null) {
  return (definition?.edges ?? []) as Edge[];
}

export default function WorkflowEditorPage() {
  const params = useParams();
  const appId = getAppIdFromParams(params);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState("");
  const [draftDefinition, setDraftDefinition] = useState<WorkflowDefinition | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === activeWorkflowId) ?? null,
    [activeWorkflowId, workflows]
  );
  const approvalNodeCount = getApprovalNodeCount(draftDefinition);

  const loadWorkflowList = useCallback(async () => {
    if (!appId) {
      return;
    }

    try {
      setIsLoading(true);
      const nextWorkflows = await listWorkflows(appId);
      setWorkflows(nextWorkflows);
      setActiveWorkflowId((current) => current || nextWorkflows[0]?.id || "");
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "ワークフローの読み込みに失敗しました。"
      );
    } finally {
      setIsLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    void loadWorkflowList();
  }, [loadWorkflowList]);

  useEffect(() => {
    setDraftDefinition(activeWorkflow?.definitionJson ?? null);
  }, [activeWorkflow]);

  const handleCanvasChange = useCallback(
    (definition: { nodes: Node<WorkflowNodeData>[]; edges: Edge[] }) => {
      setDraftDefinition({
        nodes: definition.nodes,
        edges: definition.edges.map((edge) => ({
          ...edge,
          label: typeof edge.label === "string" ? edge.label : undefined,
        })),
      });
    },
    []
  );

  async function handleSave(status = activeWorkflow?.status ?? "draft") {
    if (!appId || !activeWorkflow || !draftDefinition) {
      return;
    }

    try {
      setIsSaving(true);
      const updated = await updateWorkflow(appId, activeWorkflow.id, {
        name: activeWorkflow.name,
        triggerType: activeWorkflow.triggerType,
        status,
        definitionJson: draftDefinition,
      });

      setWorkflows((current) =>
        current.map((workflow) => (workflow.id === updated.id ? updated : workflow))
      );
      setNotice(status === "active" ? "ワークフローを有効化しました。" : "ワークフローを保存しました。");
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "ワークフローの保存に失敗しました。"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateWorkflow() {
    if (!appId || !draftDefinition) {
      return;
    }

    try {
      setIsSaving(true);
      const created = await createWorkflow(appId, {
        name: `承認フロー ${workflows.length + 1}`,
        triggerType: "update",
        status: "draft",
        definitionJson: draftDefinition,
      });

      setWorkflows((current) => [created, ...current]);
      setActiveWorkflowId(created.id);
      setNotice("ワークフローを作成しました。");
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "ワークフローの作成に失敗しました。"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteWorkflow() {
    if (!appId || !activeWorkflow) {
      return;
    }

    if (!window.confirm(`「${activeWorkflow.name}」を削除しますか？`)) {
      return;
    }

    try {
      setIsSaving(true);
      await deleteWorkflow(appId, activeWorkflow.id);
      const nextWorkflows = workflows.filter(
        (workflow) => workflow.id !== activeWorkflow.id
      );
      setWorkflows(nextWorkflows);
      setActiveWorkflowId(nextWorkflows[0]?.id ?? "");
      setNotice("ワークフローを削除しました。");
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "ワークフローの削除に失敗しました。"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "ダッシュボード" },
          { label: "ワークフロー自動化エディタ" },
        ]}
        actions={
          <>
            <Button
              variant="ghost"
              size="md"
              onClick={() => void handleSave("draft")}
              disabled={!activeWorkflow || isSaving}
            >
              <Icon name="save" size="sm" />
              保存
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleSave("active")}
              disabled={!activeWorkflow || isSaving}
            >
              <Icon name="rocket_launch" size="sm" />
              有効化
            </Button>
          </>
        }
      />

      <main className="flex min-h-[calc(100vh-3.5rem)] flex-col pt-14 2xl:h-[calc(100vh-3.5rem)] 2xl:flex-row">
        <aside className="w-full border-b border-outline-variant bg-sidebar p-4 2xl:w-80 2xl:border-b-0 2xl:border-r">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="font-headline text-sm font-bold tracking-tight text-on-surface">ワークフロー</h1>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleCreateWorkflow()}
              disabled={isSaving || !draftDefinition}
            >
              <Icon name="add" size="sm" />
              新規
            </Button>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
              読み込み中...
            </div>
          ) : workflows.length === 0 ? (
            <div className="rounded-lg border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
              ワークフローはまだありません。
            </div>
          ) : (
            <div className="space-y-2">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  data-draggable
                  onClick={() => setActiveWorkflowId(workflow.id)}
                  className={cn(
                    "group w-full rounded-lg border p-3 text-left transition-all",
                    activeWorkflowId === workflow.id
                      ? "border-primary-container bg-primary-container/40"
                      : "border-outline-variant bg-surface hover:border-outline hover:shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-on-surface">
                      {workflow.name}
                    </span>
                    <Badge variant={workflow.status === "active" ? "success" : "warning"}>
                      {workflow.status === "active" ? "有効" : "下書き"}
                    </Badge>
                  </div>
                  <div className="text-xs text-on-surface-variant">
                    {triggerLabels[workflow.triggerType]} / 承認待ち{" "}
                    {workflow.pendingApprovalCount ?? 0}
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeWorkflow && workflows.length > 1 && (
            <div className="mt-4">
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleDeleteWorkflow()}
                disabled={isSaving}
              >
                <Icon name="delete" size="sm" />
                削除
              </Button>
            </div>
          )}
        </aside>

        <section className="relative h-[60vh] md:h-[70vh] 2xl:h-auto 2xl:flex-1">
          <WorkflowToolbar />
          {draftDefinition ? (
            <WorkflowCanvas
              nodes={toReactFlowNodes(draftDefinition)}
              edges={toReactFlowEdges(draftDefinition)}
              onChange={handleCanvasChange}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-container-low text-sm text-on-surface-variant">
              ワークフローを選択してください。
            </div>
          )}
          <AICommandBar />
        </section>

        <AISidebar className="border-t border-outline-variant 2xl:h-auto 2xl:w-80 2xl:border-l 2xl:border-t-0">
          {error && (
            <div className="rounded-lg border border-error-container bg-error-container/40 p-3 text-xs font-medium text-on-error-container">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-lg border border-success-container bg-success-container/40 p-3 text-xs font-medium text-on-success-container">
              {notice}
            </div>
          )}

          {activeWorkflow && (
            <>
              <div className="rounded-xl border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    DB Workflow
                  </div>
                  <Badge variant={activeWorkflow.status === "active" ? "success" : "warning"}>
                    {activeWorkflow.status}
                  </Badge>
                </div>
                <div className="space-y-2.5 text-[13px] text-on-surface-variant">
                  <div className="flex justify-between gap-3">
                    <span>トリガー</span>
                    <span className="font-semibold text-on-surface">
                      {triggerLabels[activeWorkflow.triggerType]}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>承認ノード</span>
                    <span className="font-semibold text-on-surface">{approvalNodeCount}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>承認待ち</span>
                    <span className="font-semibold text-on-surface">
                      {activeWorkflow.pendingApprovalCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-tertiary-container bg-tertiary-container/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-tertiary text-white">
                    <Icon name="approval" size="sm" />
                  </span>
                  <span className="text-[12.5px] font-semibold text-on-tertiary-container">
                    承認実行
                  </span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-on-surface-variant">
                  active workflow に承認ノードがある場合、レコード作成または更新後に
                  pending approval が保存されます。
                </p>
              </div>
            </>
          )}
        </AISidebar>
      </main>
    </>
  );
}
