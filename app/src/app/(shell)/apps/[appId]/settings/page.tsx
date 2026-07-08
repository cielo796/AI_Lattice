"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Icon } from "@/components/shared/Icon";
import { Input } from "@/components/shared/Input";
import { TopBar } from "@/components/shared/TopBar";
import {
  deleteApp,
  generateApprovalStatusViews,
  getApp,
  getAppApprovalSetting,
  listAppApprovalUserCandidates,
  listAppVersions,
  listTables,
  publishApp,
  saveAppApprovalSetting,
  updateApp,
  type SaveAppApprovalApproverInput,
} from "@/lib/api/apps";
import { useToastStore } from "@/stores/toastStore";
import type {
  App,
  AppApprovalSetting,
  AppApprovalUserCandidate,
  AppTable,
  AppVersionSummary,
  ApprovalMode,
} from "@/types/app";

const STATUS_LABELS: Record<App["status"], string> = {
  draft: "下書き",
  published: "公開中",
  archived: "アーカイブ",
};

const STATUS_VARIANTS: Record<App["status"], "default" | "success" | "warning"> = {
  draft: "warning",
  published: "success",
  archived: "default",
};

const APPROVAL_MODE_LABELS: Record<ApprovalMode, string> = {
  any: "1名の承認で完了",
  all: "全員の承認で完了",
  sequential: "設定順に承認",
  quorum: "指定人数の承認で完了",
};

const ROLE_TYPE_LABELS = {
  system_admin: "システム管理者",
  tenant_admin: "テナント管理者",
  app_admin: "アプリ管理者",
  approver: "承認者",
  user: "一般ユーザー",
  viewer: "閲覧者",
} as const;

const CONTROL_CLASS =
  "w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type RoleType = keyof typeof ROLE_TYPE_LABELS;
type ApprovalApproverSource = "users" | "role";

const DEFAULT_APPROVAL_STATUSES = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
  returned: "差戻し",
} as const;

const LEGACY_APPROVAL_STATUSES = {
  pending: "pending_approval",
  approved: "approved",
  rejected: "rejected",
  returned: "returned",
} as const;

const DEFAULT_APPROVAL_TITLE_TEMPLATE = "{{recordTitle}} の承認依頼";
const DEFAULT_APPROVAL_BODY_TEMPLATE =
  "{{tableName}}「{{recordTitle}}」の内容を確認し、承認・却下・差戻しを判断してください。";
const DEFAULT_APPROVAL_RESULT_FIELD_CODE = "approval_result";
const DEFAULT_NEEDS_REVISION_FIELD_CODE = "needs_revision";

function normalizeDefaultStatus(
  value: string,
  legacyValue: string,
  defaultValue: string
) {
  const trimmed = value.trim();
  return !trimmed || trimmed === legacyValue ? defaultValue : trimmed;
}

function normalizeDefaultText(value: string | undefined, defaultValue: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : defaultValue;
}

function getActionPatch(
  actions: AppApprovalSetting["postApprovalActionsJson"] | undefined,
  status: "approved" | "rejected" | "returned"
) {
  return actions?.[status]?.find((action) => action.dataPatch)?.dataPatch;
}

function normalizeApprovalResultValue(
  value: unknown,
  status: "approved" | "rejected" | "returned"
) {
  const defaultValues = {
    approved: DEFAULT_APPROVAL_STATUSES.approved,
    rejected: DEFAULT_APPROVAL_STATUSES.rejected,
    returned: DEFAULT_APPROVAL_STATUSES.returned,
  } as const;
  const legacyValues = {
    approved: LEGACY_APPROVAL_STATUSES.approved,
    rejected: LEGACY_APPROVAL_STATUSES.rejected,
    returned: LEGACY_APPROVAL_STATUSES.returned,
  } as const;
  const text = value === undefined || value === null ? "" : String(value).trim();

  if (!text || text === legacyValues[status]) {
    return defaultValues[status];
  }

  return text;
}

function getApprovalResultFieldCode(
  actions: AppApprovalSetting["postApprovalActionsJson"] | undefined
) {
  const patches = [
    getActionPatch(actions, "approved"),
    getActionPatch(actions, "rejected"),
    getActionPatch(actions, "returned"),
  ].filter((patch): patch is Record<string, unknown> => Boolean(patch));

  for (const patch of patches) {
    const fieldCode = Object.keys(patch).find(
      (key) => key !== DEFAULT_NEEDS_REVISION_FIELD_CODE
    );
    if (fieldCode) {
      return fieldCode;
    }
  }

  return DEFAULT_APPROVAL_RESULT_FIELD_CODE;
}

function getApprovalResultValue(
  actions: AppApprovalSetting["postApprovalActionsJson"] | undefined,
  status: "approved" | "rejected" | "returned",
  fieldCode: string
) {
  const patch = getActionPatch(actions, status);
  return normalizeApprovalResultValue(
    patch?.[fieldCode] ?? patch?.[DEFAULT_APPROVAL_RESULT_FIELD_CODE],
    status
  );
}

function getReturnedNeedsRevision(
  actions: AppApprovalSetting["postApprovalActionsJson"] | undefined
) {
  const patch = getActionPatch(actions, "returned");
  if (!patch || patch[DEFAULT_NEEDS_REVISION_FIELD_CODE] === undefined) {
    return true;
  }

  return patch[DEFAULT_NEEDS_REVISION_FIELD_CODE] === true;
}

function buildDecisionPatch(
  fieldCode: string,
  value: string,
  fallbackValue: string,
  includeNeedsRevision = false
) {
  return {
    [fieldCode || DEFAULT_APPROVAL_RESULT_FIELD_CODE]:
      normalizeDefaultText(value, fallbackValue),
    ...(includeNeedsRevision ? { [DEFAULT_NEEDS_REVISION_FIELD_CODE]: true } : {}),
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AppSettingsPage() {
  const params = useParams<{ appId: string }>();
  const router = useRouter();
  const appId = Array.isArray(params.appId)
    ? params.appId[0] ?? ""
    : params.appId ?? "";
  const pushToast = useToastStore((store) => store.pushToast);

  const [app, setApp] = useState<App | null>(null);
  const [versions, setVersions] = useState<AppVersionSummary[]>([]);
  const [tables, setTables] = useState<AppTable[]>([]);
  const [approvalUserCandidates, setApprovalUserCandidates] = useState<AppApprovalUserCandidate[]>([]);
  const [approvalSetting, setApprovalSetting] = useState<AppApprovalSetting | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("apps");
  const [approvalEnabled, setApprovalEnabled] = useState(false);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>("any");
  const [approvalTargetTableId, setApprovalTargetTableId] = useState("");
  const [approvalPendingStatus, setApprovalPendingStatus] = useState<string>(
    DEFAULT_APPROVAL_STATUSES.pending
  );
  const [approvalApprovedStatus, setApprovalApprovedStatus] = useState<string>(
    DEFAULT_APPROVAL_STATUSES.approved
  );
  const [approvalRejectedStatus, setApprovalRejectedStatus] = useState<string>(
    DEFAULT_APPROVAL_STATUSES.rejected
  );
  const [approvalReturnedStatus, setApprovalReturnedStatus] = useState<string>(
    DEFAULT_APPROVAL_STATUSES.returned
  );
  const [approvalQuorumCount, setApprovalQuorumCount] = useState(1);
  const [approvalApproverSource, setApprovalApproverSource] =
    useState<ApprovalApproverSource>("users");
  const [selectedApprovalUserIds, setSelectedApprovalUserIds] = useState<string[]>([]);
  const [approvalUserSelectId, setApprovalUserSelectId] = useState("");
  const [approvalRoleType, setApprovalRoleType] = useState<RoleType | "">("");
  const [approvalTitleTemplate, setApprovalTitleTemplate] = useState(
    DEFAULT_APPROVAL_TITLE_TEMPLATE
  );
  const [approvalBodyTemplate, setApprovalBodyTemplate] = useState(
    DEFAULT_APPROVAL_BODY_TEMPLATE
  );
  const [approvalResultFieldCode, setApprovalResultFieldCode] = useState(
    DEFAULT_APPROVAL_RESULT_FIELD_CODE
  );
  const [approvedResultValue, setApprovedResultValue] = useState<string>(
    DEFAULT_APPROVAL_STATUSES.approved
  );
  const [rejectedResultValue, setRejectedResultValue] = useState<string>(
    DEFAULT_APPROVAL_STATUSES.rejected
  );
  const [returnedResultValue, setReturnedResultValue] = useState<string>(
    DEFAULT_APPROVAL_STATUSES.returned
  );
  const [setNeedsRevisionOnReturn, setSetNeedsRevisionOnReturn] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingApproval, setIsSavingApproval] = useState(false);
  const [isGeneratingApprovalViews, setIsGeneratingApprovalViews] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function hydrateApprovalSetting(setting: AppApprovalSetting) {
    const userApprovers = setting.approvers
      .filter((approver) => approver.approverType === "user" && approver.userId)
      .map((approver) => approver.userId)
      .filter((userId): userId is string => Boolean(userId));
    const roleApprover = setting.approvers.find(
      (approver) => approver.approverType === "role" && approver.roleType
    );

    setApprovalSetting(setting);
    setApprovalEnabled(setting.enabled);
    setApprovalMode(setting.approvalMode);
    setApprovalTargetTableId(setting.targetTableId ?? "");
    setApprovalPendingStatus(
      normalizeDefaultStatus(
        setting.pendingStatus,
        LEGACY_APPROVAL_STATUSES.pending,
        DEFAULT_APPROVAL_STATUSES.pending
      )
    );
    setApprovalApprovedStatus(
      normalizeDefaultStatus(
        setting.approvedStatus,
        LEGACY_APPROVAL_STATUSES.approved,
        DEFAULT_APPROVAL_STATUSES.approved
      )
    );
    setApprovalRejectedStatus(
      normalizeDefaultStatus(
        setting.rejectedStatus,
        LEGACY_APPROVAL_STATUSES.rejected,
        DEFAULT_APPROVAL_STATUSES.rejected
      )
    );
    setApprovalReturnedStatus(
      normalizeDefaultStatus(
        setting.returnedStatus,
        LEGACY_APPROVAL_STATUSES.returned,
        DEFAULT_APPROVAL_STATUSES.returned
      )
    );
    setApprovalQuorumCount(setting.quorumCount ?? 1);
    const approverSource: ApprovalApproverSource =
      roleApprover && userApprovers.length === 0 ? "role" : "users";

    setApprovalApproverSource(approverSource);
    setSelectedApprovalUserIds(approverSource === "users" ? userApprovers : []);
    setApprovalUserSelectId("");
    setApprovalRoleType(approverSource === "role" ? roleApprover?.roleType ?? "" : "");
    setApprovalTitleTemplate(
      normalizeDefaultText(
        setting.requestTitleTemplate,
        DEFAULT_APPROVAL_TITLE_TEMPLATE
      )
    );
    setApprovalBodyTemplate(
      normalizeDefaultText(
        setting.requestBodyTemplate,
        DEFAULT_APPROVAL_BODY_TEMPLATE
      )
    );
    const resultFieldCode = getApprovalResultFieldCode(setting.postApprovalActionsJson);
    setApprovalResultFieldCode(resultFieldCode);
    setApprovedResultValue(
      getApprovalResultValue(setting.postApprovalActionsJson, "approved", resultFieldCode)
    );
    setRejectedResultValue(
      getApprovalResultValue(setting.postApprovalActionsJson, "rejected", resultFieldCode)
    );
    setReturnedResultValue(
      getApprovalResultValue(setting.postApprovalActionsJson, "returned", resultFieldCode)
    );
    setSetNeedsRevisionOnReturn(
      getReturnedNeedsRevision(setting.postApprovalActionsJson)
    );
  }

  useEffect(() => {
    if (!appId) {
      setError("アプリIDが見つかりません。");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSettings() {
      try {
        setIsLoading(true);
        const [nextApp, nextVersions, nextTables, nextApprovalSetting, nextApprovalUserCandidates] = await Promise.all([
          getApp(appId),
          listAppVersions(appId),
          listTables(appId),
          getAppApprovalSetting(appId),
          listAppApprovalUserCandidates(appId).catch(() => []),
        ]);

        if (cancelled) {
          return;
        }

        setApp(nextApp);
        setVersions(nextVersions);
        setTables(nextTables);
        setApprovalUserCandidates(nextApprovalUserCandidates);
        setName(nextApp.name);
        setDescription(nextApp.description ?? "");
        setIcon(nextApp.icon || "apps");
        hydrateApprovalSetting(nextApprovalSetting);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "アプリ設定の読み込みに失敗しました。"
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [appId]);

  async function handleSave() {
    if (!app) {
      return;
    }

    try {
      setIsSaving(true);
      const nextApp = await updateApp(app.id, {
        name,
        description,
        icon,
      });
      setApp(nextApp);
      pushToast({ title: "アプリ設定を保存しました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "アプリ設定の保存に失敗しました",
        description:
          nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleAddApprovalUser() {
    if (!approvalUserSelectId) {
      return;
    }

    setApprovalApproverSource("users");
    setApprovalRoleType("");
    setSelectedApprovalUserIds((current) =>
      current.includes(approvalUserSelectId)
        ? current
        : [...current, approvalUserSelectId]
    );
    setApprovalUserSelectId("");
  }

  function handleRemoveApprovalUser(userId: string) {
    setSelectedApprovalUserIds((current) =>
      current.filter((currentUserId) => currentUserId !== userId)
    );
  }

  function handleApproverSourceChange(source: ApprovalApproverSource) {
    setApprovalApproverSource(source);
    setApprovalUserSelectId("");

    if (source === "users") {
      setApprovalRoleType("");
      return;
    }

    setSelectedApprovalUserIds([]);
  }

  async function handleSaveApprovalSetting() {
    if (!app) {
      return;
    }

    try {
      setIsSavingApproval(true);
      const resultFieldCode =
        approvalResultFieldCode.trim() || DEFAULT_APPROVAL_RESULT_FIELD_CODE;
      const approvers: SaveAppApprovalApproverInput[] = [];

      if (approvalApproverSource === "users") {
        approvers.push(
          ...selectedApprovalUserIds.map((userId, index) => ({
            approverType: "user" as const,
            userId,
            sortOrder: index,
            required: true,
            active: true,
          }))
        );
      } else if (approvalRoleType) {
        approvers.push({
          approverType: "role",
          roleType: approvalRoleType,
          sortOrder: 0,
          required: true,
          active: true,
        });
      }

      const nextSetting = await saveAppApprovalSetting(app.id, {
        enabled: approvalEnabled,
        approvalMode,
        targetTableId: approvalTargetTableId || tables[0]?.id,
        pendingStatus: approvalPendingStatus,
        approvedStatus: approvalApprovedStatus,
        rejectedStatus: approvalRejectedStatus,
        returnedStatus: approvalReturnedStatus,
        quorumCount: approvalQuorumCount,
        requestTitleTemplate: approvalTitleTemplate,
        requestBodyTemplate: approvalBodyTemplate,
        postApprovalActionsJson: {
          approved: [
            {
              status: approvalApprovedStatus,
              dataPatch: buildDecisionPatch(
                resultFieldCode,
                approvedResultValue,
                DEFAULT_APPROVAL_STATUSES.approved
              ),
            },
          ],
          rejected: [
            {
              status: approvalRejectedStatus,
              dataPatch: buildDecisionPatch(
                resultFieldCode,
                rejectedResultValue,
                DEFAULT_APPROVAL_STATUSES.rejected
              ),
            },
          ],
          returned: [
            {
              status: approvalReturnedStatus,
              dataPatch: buildDecisionPatch(
                resultFieldCode,
                returnedResultValue,
                DEFAULT_APPROVAL_STATUSES.returned,
                setNeedsRevisionOnReturn
              ),
            },
          ],
        },
        approvers,
      });
      hydrateApprovalSetting(nextSetting);
      pushToast({ title: "承認設定を保存しました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "承認設定の保存に失敗しました",
        description:
          nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSavingApproval(false);
    }
  }

  async function handleGenerateApprovalViews() {
    if (!app) {
      return;
    }

    try {
      setIsGeneratingApprovalViews(true);
      await generateApprovalStatusViews(app.id);
      pushToast({
        title: "承認ステータス別Viewを作成しました",
        variant: "success",
      });
    } catch (nextError) {
      pushToast({
        title: "承認ステータス別Viewの作成に失敗しました",
        description:
          nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsGeneratingApprovalViews(false);
    }
  }

  async function handlePublish() {
    if (!app) {
      return;
    }

    try {
      setIsPublishing(true);
      const version = await publishApp(app.id);
      setVersions((current) => [version, ...current]);
      setApp((current) =>
        current ? { ...current, status: "published" } : current
      );
      pushToast({
        title: `バージョン v${version.versionNo} を公開しました`,
        variant: "success",
      });
    } catch (nextError) {
      pushToast({
        title: "アプリの公開に失敗しました",
        description:
          nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleArchiveToggle() {
    if (!app) {
      return;
    }

    const nextStatus = app.status === "archived" ? "draft" : "archived";

    try {
      setIsArchiving(true);
      const nextApp = await updateApp(app.id, { status: nextStatus });
      setApp(nextApp);
      pushToast({
        title:
          nextStatus === "archived"
            ? "アプリをアーカイブしました"
            : "アプリを下書きに戻しました",
        variant: "success",
      });
    } catch (nextError) {
      pushToast({
        title: "ステータスの変更に失敗しました",
        description:
          nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleDelete() {
    if (!app) {
      return;
    }

    const confirmed = window.confirm(
      `「${app.name}」を削除しますか？テーブル・レコード・ワークフローもすべて削除されます。この操作は取り消せません。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteApp(app.id);
      pushToast({ title: "アプリを削除しました", variant: "success" });
      router.push("/home");
    } catch (nextError) {
      pushToast({
        title: "アプリの削除に失敗しました",
        description:
          nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
      setIsDeleting(false);
    }
  }

  const hasConfiguredApprovalApprover =
    approvalApproverSource === "role"
      ? Boolean(approvalRoleType)
      : selectedApprovalUserIds.length > 0;

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "アプリ", href: "/home" },
          { label: app?.name ?? "アプリ設定" },
          { label: "設定" },
        ]}
      />

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 pt-24 md:px-8">
        {error && (
          <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        {isLoading ? (
          <Card className="animate-pulse">
            <div className="h-5 w-40 rounded bg-surface-container-high" />
            <div className="mt-4 h-9 rounded bg-surface-container" />
            <div className="mt-3 h-9 rounded bg-surface-container" />
          </Card>
        ) : app ? (
          <>
            <Card data-guide="app-settings-basic">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container">
                    <Icon name={icon || "apps"} className="text-on-primary-container" />
                  </div>
                  <div>
                    <h2 className="font-headline text-base font-bold text-on-surface">
                      基本設定
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      アプリ名や説明を変更します。コード: {app.code}
                    </p>
                  </div>
                </div>
                <Badge variant={STATUS_VARIANTS[app.status]}>
                  {STATUS_LABELS[app.status]}
                </Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                    アプリ名
                  </label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="アプリ名"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                    説明
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    placeholder="このアプリの目的や対象業務を記載します"
                    className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                    アイコン（Material Symbols名）
                  </label>
                  <Input
                    value={icon}
                    onChange={(event) => setIcon(event.target.value)}
                    placeholder="apps"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleSave()}
                    disabled={isSaving || !name.trim()}
                  >
                    <Icon name="save" size="sm" />
                    {isSaving ? "保存中..." : "設定を保存"}
                  </Button>
                </div>
              </div>
            </Card>

            <Card data-guide="app-settings-approval">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-headline text-base font-bold text-on-surface">
                    承認設定
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    申請時に承認者へ通知し、判断結果に応じてレコードステータスを更新します。
                  </p>
                </div>
                <Badge variant={approvalEnabled ? "success" : "default"}>
                  {approvalEnabled ? "有効" : "無効"}
                </Badge>
              </div>

              <div className="space-y-5">
                <label
                  className="flex items-center gap-2 text-sm font-semibold text-on-surface"
                  data-guide="app-settings-approval-toggle"
                >
                  <input
                    type="checkbox"
                    checked={approvalEnabled}
                    onChange={(event) => setApprovalEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-outline text-primary focus:ring-primary"
                  />
                  このアプリで承認申請を受け付ける
                </label>

                <div className="grid gap-4 md:grid-cols-2" data-guide="app-settings-approval-target">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                      対象テーブル
                    </label>
                    <select
                      value={approvalTargetTableId}
                      onChange={(event) => setApprovalTargetTableId(event.target.value)}
                      className={CONTROL_CLASS}
                    >
                      {tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                      承認方式
                    </label>
                    <select
                      value={approvalMode}
                      onChange={(event) =>
                        setApprovalMode(event.target.value as ApprovalMode)
                      }
                      className={CONTROL_CLASS}
                    >
                      {Object.entries(APPROVAL_MODE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {approvalMode === "quorum" && (
                  <div className="max-w-xs">
                    <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                      定足数
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={approvalQuorumCount}
                      onChange={(event) =>
                        setApprovalQuorumCount(
                          Math.max(1, Number(event.target.value) || 1)
                        )
                      }
                    />
                  </div>
                )}

                <div className="space-y-3" data-guide="app-settings-approval-approvers">
                  <div>
                    <div className="mb-1.5 text-xs font-semibold text-on-surface-variant">
                      承認者の指定方法
                    </div>
                    <div className="inline-flex rounded-lg border border-outline-variant bg-surface-container-low p-1">
                      <button
                        type="button"
                        onClick={() => handleApproverSourceChange("users")}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                          approvalApproverSource === "users"
                            ? "bg-surface text-primary shadow-sm"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        個別ユーザー
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproverSourceChange("role")}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                          approvalApproverSource === "role"
                            ? "bg-surface text-primary shadow-sm"
                            : "text-on-surface-variant hover:text-on-surface"
                        }`}
                      >
                        ロール
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      個別ユーザーとロールはどちらか一方だけ設定できます。
                    </p>
                  </div>

                  {approvalApproverSource === "users" ? (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                        承認者ユーザー
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={approvalUserSelectId}
                          onChange={(event) => setApprovalUserSelectId(event.target.value)}
                          className={CONTROL_CLASS}
                          disabled={approvalUserCandidates.length === 0}
                        >
                          <option value="">
                            {approvalUserCandidates.length === 0
                              ? "承認者にできるユーザーがありません"
                              : "承認者に追加するユーザーを選択"}
                          </option>
                          {approvalUserCandidates
                            .filter((candidate) => !selectedApprovalUserIds.includes(candidate.id))
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}（{candidate.email}）
                              </option>
                            ))}
                        </select>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleAddApprovalUser}
                          disabled={!approvalUserSelectId}
                          className="shrink-0"
                        >
                          <Icon name="add" size="sm" />
                          承認者に追加
                        </Button>
                      </div>
                      <div className="mt-2 min-h-10 rounded-lg border border-outline-variant bg-surface-container-low p-2">
                        {selectedApprovalUserIds.length === 0 ? (
                          <div className="px-1 py-1 text-xs text-on-surface-variant">
                            {approvalUserSelectId
                              ? "選択中のユーザーはまだ承認者に追加されていません。"
                              : "ユーザーを選択して「承認者に追加」を押してください。"}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {selectedApprovalUserIds.map((userId) => {
                              const candidate = approvalUserCandidates.find(
                                (item) => item.id === userId
                              );

                              return (
                                <span
                                  key={userId}
                                  className="inline-flex max-w-full items-center gap-2 rounded-md border border-outline bg-surface px-2 py-1 text-xs text-on-surface"
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate font-semibold">
                                      {candidate?.name ?? userId}
                                    </span>
                                    <span className="block truncate text-[10px] text-on-surface-variant">
                                      {candidate?.email ?? userId}
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveApprovalUser(userId)}
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                                    aria-label={`${candidate?.name ?? userId} を承認者から外す`}
                                  >
                                    <Icon name="close" size="sm" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                        ロール承認者
                      </label>
                      <select
                        value={approvalRoleType}
                        onChange={(event) =>
                          setApprovalRoleType(event.target.value as RoleType | "")
                        }
                        className={CONTROL_CLASS}
                      >
                        <option value="">ロールを選択</option>
                        {Object.entries(ROLE_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-on-surface-variant">
                        選択したロールに所属するユーザーを承認者として展開します。
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-4" data-guide="app-settings-approval-statuses">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                      申請中
                    </label>
                    <Input
                      value={approvalPendingStatus}
                      onChange={(event) => setApprovalPendingStatus(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                      承認完了
                    </label>
                    <Input
                      value={approvalApprovedStatus}
                      onChange={(event) => setApprovalApprovedStatus(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                      却下
                    </label>
                    <Input
                      value={approvalRejectedStatus}
                      onChange={(event) => setApprovalRejectedStatus(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                      差戻し
                    </label>
                    <Input
                      value={approvalReturnedStatus}
                      onChange={(event) => setApprovalReturnedStatus(event.target.value)}
                    />
                  </div>
                </div>

                <div data-guide="app-settings-approval-templates">
                  <div className="mb-2">
                    <div className="text-xs font-semibold text-on-surface-variant">
                      承認依頼メッセージ
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
                      承認者の画面と通知に表示される件名と本文です。
                      <code className="mx-1 rounded bg-surface-container px-1 py-0.5">
                        {"{{recordTitle}}"}
                      </code>
                      はレコード名、
                      <code className="mx-1 rounded bg-surface-container px-1 py-0.5">
                        {"{{tableName}}"}
                      </code>
                      はテーブル名に置き換わります。
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                    <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                      承認依頼の件名
                    </label>
                    <Input
                      value={approvalTitleTemplate}
                      onChange={(event) => setApprovalTitleTemplate(event.target.value)}
                      placeholder={DEFAULT_APPROVAL_TITLE_TEMPLATE}
                    />
                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      承認一覧と通知に表示される件名です。
                    </p>
                    </div>
                    <div>
                    <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
                      承認依頼の本文
                    </label>
                    <textarea
                      value={approvalBodyTemplate}
                      onChange={(event) => setApprovalBodyTemplate(event.target.value)}
                      rows={2}
                      placeholder={DEFAULT_APPROVAL_BODY_TEMPLATE}
                      className={CONTROL_CLASS}
                    />
                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      承認者が依頼を開いたときに読む本文です。
                    </p>
                    </div>
                  </div>
                </div>

                <div data-guide="app-settings-approval-actions">
                  <div className="mb-2">
                    <div className="text-xs font-semibold text-on-surface-variant">
                      承認後のレコード変更
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
                      承認結果をレコードに自動保存します。保存先フィールドと、判定ごとに入れる値を指定してください。
                    </p>
                  </div>

                  <div className="mb-4 max-w-sm">
                    <label className="mb-1.5 block text-[11px] font-semibold text-on-surface-variant">
                      保存先フィールドコード
                    </label>
                    <Input
                      value={approvalResultFieldCode}
                      onChange={(event) => setApprovalResultFieldCode(event.target.value)}
                      placeholder={DEFAULT_APPROVAL_RESULT_FIELD_CODE}
                    />
                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      例: approval_result。対象テーブルに同じフィールドコードの項目があれば、そこへ保存されます。
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold text-on-surface-variant">
                        承認時に保存する値
                      </label>
                      <Input
                        value={approvedResultValue}
                        onChange={(event) => setApprovedResultValue(event.target.value)}
                        placeholder={DEFAULT_APPROVAL_STATUSES.approved}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold text-on-surface-variant">
                        却下時に保存する値
                      </label>
                      <Input
                        value={rejectedResultValue}
                        onChange={(event) => setRejectedResultValue(event.target.value)}
                        placeholder={DEFAULT_APPROVAL_STATUSES.rejected}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold text-on-surface-variant">
                        差戻し時に保存する値
                      </label>
                      <Input
                        value={returnedResultValue}
                        onChange={(event) => setReturnedResultValue(event.target.value)}
                        placeholder={DEFAULT_APPROVAL_STATUSES.returned}
                      />
                    </div>
                  </div>

                  <label className="mt-3 flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface">
                    <input
                      type="checkbox"
                      checked={setNeedsRevisionOnReturn}
                      onChange={(event) =>
                        setSetNeedsRevisionOnReturn(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-outline text-primary focus:ring-primary"
                    />
                    差戻し時に「修正が必要」フラグも保存する
                  </label>
                  <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
                    フラグをONにすると、差戻し時に
                    <code className="mx-1 rounded bg-surface-container px-1 py-0.5">
                      {DEFAULT_NEEDS_REVISION_FIELD_CODE}
                    </code>
                    へ true を保存します。
                  </p>
                </div>

                {approvalSetting && approvalSetting.approvers.length > 0 && (
                  <div className="rounded-lg bg-surface-container px-3 py-2 text-[11px] text-on-surface-variant">
                    現在の承認者:{" "}
                    {approvalSetting.approvers
                      .filter((approver) => approver.active)
                      .map(
                        (approver) =>
                          approver.userName ??
                          approver.userId ??
                          approver.roleName ??
                          (approver.roleType
                            ? ROLE_TYPE_LABELS[approver.roleType]
                            : "未設定")
                      )
                      .join("、")}
                  </div>
                )}

                {approvalEnabled && !hasConfiguredApprovalApprover && (
                    <div className="rounded-lg bg-warning-container px-3 py-2 text-xs font-medium text-on-warning-container">
                      承認を有効にするには、指定方法に合わせて承認者ユーザーまたはロールを設定してください。
                    </div>
                  )}

                <div className="flex flex-wrap justify-end gap-2" data-guide="app-settings-approval-save">
                  <Button
                    variant="secondary"
                    onClick={() => void handleGenerateApprovalViews()}
                    disabled={isGeneratingApprovalViews || !approvalTargetTableId}
                  >
                    <Icon name="view_list" size="sm" />
                    {isGeneratingApprovalViews
                      ? "View作成中..."
                      : "ステータスViewを作成"}
                  </Button>
                  <Button
                    onClick={() => void handleSaveApprovalSetting()}
                    disabled={
                      isSavingApproval ||
                      !approvalPendingStatus.trim() ||
                      !approvalApprovedStatus.trim() ||
                      !approvalRejectedStatus.trim() ||
                      !approvalReturnedStatus.trim() ||
                      (approvalEnabled && !hasConfiguredApprovalApprover)
                    }
                  >
                    <Icon name="save" size="sm" />
                    {isSavingApproval ? "保存中..." : "承認設定を保存"}
                  </Button>
                </div>
              </div>
            </Card>

            <Card data-guide="app-settings-publish">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-headline text-base font-bold text-on-surface">
                    公開とバージョン管理
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    現在の定義をスナップショットとして保存し、アプリを公開します。
                  </p>
                </div>
                <Button
                  onClick={() => void handlePublish()}
                  disabled={isPublishing || app.status === "archived"}
                >
                  <Icon name="rocket_launch" size="sm" />
                  {isPublishing ? "公開中..." : "公開する"}
                </Button>
              </div>

              {versions.length === 0 ? (
                <div className="rounded-lg bg-surface-container p-4 text-center text-xs text-on-surface-variant">
                  まだ公開バージョンはありません。「公開する」で最初のバージョンを作成します。
                </div>
              ) : (
                <ul className="divide-y divide-outline-variant/60">
                  {versions.map((version, index) => (
                    <li
                      key={version.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-xs font-bold text-on-surface">
                          v{version.versionNo}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
                            {formatDateTime(version.publishedAt)}
                            {index === 0 && (
                              <Badge variant="success">最新</Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-on-surface-variant">
                            {version.publishedByName ?? "不明なユーザー"} ·
                            テーブル {version.tableCount} · ビュー {version.viewCount} ·
                            ワークフロー {version.workflowCount}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-1 font-headline text-base font-bold text-on-surface">
                アーカイブ
              </h2>
              <p className="mb-4 text-xs text-on-surface-variant">
                アーカイブすると、このアプリは一覧で非アクティブ扱いになります。いつでも元に戻せます。
              </p>
              <Button
                variant="secondary"
                onClick={() => void handleArchiveToggle()}
                disabled={isArchiving}
              >
                <Icon
                  name={app.status === "archived" ? "unarchive" : "archive"}
                  size="sm"
                />
                {isArchiving
                  ? "更新中..."
                  : app.status === "archived"
                    ? "下書きに戻す"
                    : "アーカイブする"}
              </Button>
            </Card>

            <Card className="border-error/30">
              <h2 className="mb-1 font-headline text-base font-bold text-error">
                危険な操作
              </h2>
              <p className="mb-4 text-xs text-on-surface-variant">
                アプリを完全に削除します。テーブル・レコード・ワークフロー・添付ファイルがすべて削除され、元に戻せません。
              </p>
              <Button
                variant="danger"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
              >
                <Icon name="delete_forever" size="sm" />
                {isDeleting ? "削除中..." : "アプリを削除"}
              </Button>
            </Card>
          </>
        ) : null}
      </main>
    </>
  );
}
