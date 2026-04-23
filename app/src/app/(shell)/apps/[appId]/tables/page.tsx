"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AISidebar } from "@/components/ai/AISidebar";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { Input } from "@/components/shared/Input";
import { TopBar } from "@/components/shared/TopBar";
import { cn } from "@/lib/cn";
import {
  createField,
  createTable,
  deleteApp,
  deleteField,
  deleteTable,
  listFields,
  listTables,
  updateField,
  updateTable,
  type CreateFieldInput,
  type CreateTableInput,
  type UpdateFieldInput,
  type UpdateTableInput,
} from "@/lib/api/apps";
import type { AppField, AppTable, FieldType } from "@/types/app";

type TableFormState = { name: string; code: string; isSystem: boolean };
type FieldFormState = {
  name: string;
  code: string;
  fieldType: FieldType;
  required: boolean;
  uniqueFlag: boolean;
  optionsText: string;
};
type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "ai";

const EMPTY_TABLE_FORM: TableFormState = { name: "", code: "", isSystem: false };
const EMPTY_FIELD_FORM: FieldFormState = {
  name: "",
  code: "",
  fieldType: "text",
  required: false,
  uniqueFlag: false,
  optionsText: "",
};

const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
  "user_ref",
  "master_ref",
  "file",
  "ai_generated",
  "calculated",
];

const FIELD_META: Record<FieldType, { label: string; variant: BadgeVariant }> = {
  text: { label: "テキスト", variant: "default" },
  textarea: { label: "長文テキスト", variant: "default" },
  number: { label: "数値", variant: "info" },
  date: { label: "日付", variant: "info" },
  datetime: { label: "日時", variant: "info" },
  boolean: { label: "真偽値", variant: "default" },
  select: { label: "選択式", variant: "warning" },
  user_ref: { label: "ユーザー参照", variant: "info" },
  master_ref: { label: "マスター参照", variant: "info" },
  file: { label: "ファイル", variant: "default" },
  ai_generated: { label: "AI 生成", variant: "ai" },
  calculated: { label: "計算式", variant: "warning" },
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function sortByOrder<T extends { sortOrder: number; createdAt: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.createdAt.localeCompare(right.createdAt)
  );
}

function getFieldOptions(field: AppField) {
  const options = field.settingsJson?.options;
  return Array.isArray(options)
    ? options.filter((item): item is string => typeof item === "string")
    : [];
}

export default function TableDesignerPage() {
  const params = useParams<{ appId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appId = getParam(params.appId);
  const wasCreated = searchParams.get("created") === "1";

  const [tables, setTables] = useState<AppTable[]>([]);
  const [fields, setFields] = useState<AppField[]>([]);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [tableForm, setTableForm] = useState(EMPTY_TABLE_FORM);
  const [fieldForm, setFieldForm] = useState(EMPTY_FIELD_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [isSavingTable, setIsSavingTable] = useState(false);
  const [isSavingField, setIsSavingField] = useState(false);
  const [isDeletingApp, setIsDeletingApp] = useState(false);

  const activeTable = tables.find((table) => table.id === activeTableId) ?? null;

  useEffect(() => {
    if (!appId) {
      setError("アプリ ID が見つかりません。");
      setIsLoadingTables(false);
      return;
    }

    let cancelled = false;

    async function loadTablesForApp() {
      try {
        setIsLoadingTables(true);
        const nextTables = sortByOrder(await listTables(appId));
        if (cancelled) return;
        setTables(nextTables);
        setActiveTableId((current) =>
          current && nextTables.some((table) => table.id === current)
            ? current
            : (nextTables[0]?.id ?? null)
        );
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setTables([]);
          setActiveTableId(null);
          setError(nextError instanceof Error ? nextError.message : "テーブルの読み込みに失敗しました。");
        }
      } finally {
        if (!cancelled) setIsLoadingTables(false);
      }
    }

    void loadTablesForApp();
    return () => {
      cancelled = true;
    };
  }, [appId]);

  useEffect(() => {
    if (!appId || !activeTableId) {
      setFields([]);
      return;
    }

    const currentTableId = activeTableId;

    let cancelled = false;

    async function loadFieldsForTable() {
      try {
        setIsLoadingFields(true);
        const nextFields = sortByOrder(await listFields(appId, currentTableId));
        if (cancelled) return;
        setFields(nextFields);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setFields([]);
          setError(nextError instanceof Error ? nextError.message : "フィールドの読み込みに失敗しました。");
        }
      } finally {
        if (!cancelled) setIsLoadingFields(false);
      }
    }

    void loadFieldsForTable();
    return () => {
      cancelled = true;
    };
  }, [activeTableId, appId]);

  function resetTableForm() {
    setEditingTableId(null);
    setTableForm(EMPTY_TABLE_FORM);
  }

  function resetFieldForm() {
    setEditingFieldId(null);
    setFieldForm(EMPTY_FIELD_FORM);
  }

  async function onSubmitTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appId) return;
    setIsSavingTable(true);

    try {
      if (editingTableId) {
        const payload: UpdateTableInput = {
          name: tableForm.name.trim() || undefined,
          code: tableForm.code.trim() || undefined,
          isSystem: tableForm.isSystem,
        };
        const updated = await updateTable(appId, editingTableId, payload);
        setTables((current) =>
          sortByOrder(current.map((table) => (table.id === updated.id ? updated : table)))
        );
        setActiveTableId(updated.id);
      } else {
        const payload: CreateTableInput = {
          name: tableForm.name.trim(),
          code: tableForm.code.trim() || undefined,
          isSystem: tableForm.isSystem,
        };
        const created = await createTable(appId, payload);
        setTables((current) => sortByOrder([...current, created]));
        setActiveTableId(created.id);
      }
      setError(null);
      resetTableForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "テーブルの保存に失敗しました。");
    } finally {
      setIsSavingTable(false);
    }
  }

  async function onDeleteTable(table: AppTable) {
    if (!appId || !window.confirm(`テーブル「${table.name}」を削除しますか？`)) return;
    try {
      await deleteTable(appId, table.id);
      const nextTables = tables.filter((item) => item.id !== table.id);
      setTables(nextTables);
      setActiveTableId((current) => (current === table.id ? nextTables[0]?.id ?? null : current));
      if (editingTableId === table.id) resetTableForm();
      resetFieldForm();
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "テーブルの削除に失敗しました。");
    }
  }

  async function onSubmitField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appId || !activeTableId) return;
    setIsSavingField(true);
    const options = fieldForm.optionsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      if (editingFieldId) {
        const payload: UpdateFieldInput = {
          name: fieldForm.name.trim() || undefined,
          code: fieldForm.code.trim() || undefined,
          fieldType: fieldForm.fieldType,
          required: fieldForm.required,
          uniqueFlag: fieldForm.uniqueFlag,
          settingsJson: fieldForm.fieldType === "select" ? { options } : {},
        };
        const updated = await updateField(appId, activeTableId, editingFieldId, payload);
        setFields((current) =>
          sortByOrder(current.map((field) => (field.id === updated.id ? updated : field)))
        );
      } else {
        const payload: CreateFieldInput = {
          name: fieldForm.name.trim(),
          code: fieldForm.code.trim() || undefined,
          fieldType: fieldForm.fieldType,
          required: fieldForm.required,
          uniqueFlag: fieldForm.uniqueFlag,
          settingsJson: fieldForm.fieldType === "select" ? { options } : undefined,
        };
        const created = await createField(appId, activeTableId, payload);
        setFields((current) => sortByOrder([...current, created]));
      }
      setError(null);
      resetFieldForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "フィールドの保存に失敗しました。");
    } finally {
      setIsSavingField(false);
    }
  }

  async function onDeleteField(field: AppField) {
    if (!appId || !activeTableId || !window.confirm(`フィールド「${field.name}」を削除しますか？`)) return;
    try {
      await deleteField(appId, activeTableId, field.id);
      setFields((current) => current.filter((item) => item.id !== field.id));
      if (editingFieldId === field.id) resetFieldForm();
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "フィールドの削除に失敗しました。");
    }
  }

  async function onDeleteApp() {
    if (
      !appId ||
      !window.confirm(
        "このアプリを削除しますか？テーブル、フィールド、レコードも削除されます。"
      )
    ) {
      return;
    }

    try {
      setIsDeletingApp(true);
      await deleteApp(appId);
      setError(null);
      router.push("/home");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "アプリの削除に失敗しました。");
    } finally {
      setIsDeletingApp(false);
    }
  }

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "ビルダー" }, { label: "アプリ" }, { label: "テーブル" }]}
        actions={
          <>
            <Button variant="ghost" size="md">
              <Icon name="visibility" size="sm" />
              プレビュー
            </Button>
            <Button variant="danger" size="md" disabled={isDeletingApp} onClick={() => void onDeleteApp()}>
              <Icon name="delete" size="sm" />
              {isDeletingApp ? "削除中..." : "アプリを削除"}
            </Button>
            <Button variant="primary" size="md">
              <Icon name="rocket_launch" size="sm" />
              公開
            </Button>
          </>
        }
      />

      <main className="flex min-h-[calc(100vh-4rem)] flex-col pt-16 2xl:h-[calc(100vh-4rem)] 2xl:flex-row">
        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <aside className="w-full border-b border-outline-variant/20 bg-surface-container p-4 xl:w-80 xl:overflow-y-auto xl:border-b-0 xl:border-r xl:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">テーブル</div>
              <div className="text-sm text-on-surface-variant">API と連携したメタデータです。</div>
            </div>
            <Badge variant="info">{tables.length}</Badge>
          </div>

          {isLoadingTables && (
            <div className="mb-4 rounded-lg bg-surface-container-high p-4 text-sm text-on-surface-variant">
              テーブルを読み込んでいます...
            </div>
          )}

          <div className="space-y-2">
            {tables.map((table) => (
              <div
                key={table.id}
                className={cn(
                  "rounded-lg border p-3",
                  activeTableId === table.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-transparent bg-surface hover:bg-surface-container-high"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveTableId(table.id);
                    resetFieldForm();
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-on-surface">{table.name}</div>
                      <div className="text-xs text-on-surface-variant">{table.code}</div>
                    </div>
                    {table.isSystem && <Badge variant="warning">システム</Badge>}
                  </div>
                </button>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setEditingTableId(table.id);
                      setTableForm({ name: table.name, code: table.code, isSystem: table.isSystem });
                    }}
                  >
                    編集
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    className="flex-1"
                    onClick={() => void onDeleteTable(table)}
                  >
                    削除
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={(event) => void onSubmitTable(event)} className="mt-6 rounded-xl bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">{editingTableId ? "テーブルを編集" : "新規テーブル"}</h3>
              {editingTableId && (
                <Button type="button" size="sm" variant="ghost" onClick={resetTableForm}>
                  キャンセル
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <Input value={tableForm.name} onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))} placeholder="テーブル名" required />
              <Input value={tableForm.code} onChange={(event) => setTableForm((current) => ({ ...current, code: event.target.value }))} placeholder="table_code" />
              <label className="flex items-center gap-3 rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface">
                <input type="checkbox" checked={tableForm.isSystem} onChange={(event) => setTableForm((current) => ({ ...current, isSystem: event.target.checked }))} className="h-4 w-4" />
                システムテーブル
              </label>
              <Button type="submit" disabled={isSavingTable} className="w-full">
                {isSavingTable ? "保存中..." : editingTableId ? "テーブルを更新" : "テーブルを作成"}
              </Button>
            </div>
          </form>
        </aside>

        <section className="flex-1 overflow-y-auto bg-surface px-4 py-6 md:px-6 xl:p-10">
          {wasCreated && (
            <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
              アプリを作成しました。生成されたスキーマを確認し、必要に応じてテーブルとフィールドを調整してください。
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <div className="max-w-4xl">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-headline text-2xl font-bold text-white md:text-3xl">
                  {activeTable ? activeTable.name : "テーブルを選択"}
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {activeTable ? `${activeTable.code} に保存されているフィールドです。` : "先にテーブルを作成または選択してください。"}
                </p>
              </div>
              {activeTable && <Badge variant="info">{fields.length} フィールド</Badge>}
            </div>

            <form onSubmit={(event) => void onSubmitField(event)} className="mb-8 rounded-xl bg-surface-container p-4 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{editingFieldId ? "フィールドを編集" : "新規フィールド"}</h3>
                {editingFieldId && (
                  <Button type="button" size="sm" variant="ghost" onClick={resetFieldForm}>
                    キャンセル
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    表示名
                  </label>
                  <Input value={fieldForm.name} onChange={(event) => setFieldForm((current) => ({ ...current, name: event.target.value }))} placeholder="件名" required disabled={!activeTable || isSavingField} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    フィールドコード
                  </label>
                  <Input value={fieldForm.code} onChange={(event) => setFieldForm((current) => ({ ...current, code: event.target.value }))} placeholder="field_code" disabled={!activeTable || isSavingField} />
                </div>
                <div className="rounded-lg border border-outline-variant/30 bg-surface-container-high/60 px-3 py-2 text-xs text-on-surface-variant md:col-span-2">
                  表示名は画面に表示される名称です。コードは API とレコード保存に使われます。
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    フィールド型
                  </label>
                  <select value={fieldForm.fieldType} onChange={(event) => setFieldForm((current) => ({ ...current, fieldType: event.target.value as FieldType }))} disabled={!activeTable || isSavingField} className="w-full rounded-lg bg-surface-container-high px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {FIELD_TYPES.map((fieldType) => (
                      <option key={fieldType} value={fieldType}>
                        {FIELD_META[fieldType].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    選択肢
                  </label>
                  <Input value={fieldForm.optionsText} onChange={(event) => setFieldForm((current) => ({ ...current, optionsText: event.target.value }))} placeholder="選択肢 A, 選択肢 B" disabled={!activeTable || isSavingField || fieldForm.fieldType !== "select"} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <label className="flex items-center gap-3 rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface">
                  <input type="checkbox" checked={fieldForm.required} onChange={(event) => setFieldForm((current) => ({ ...current, required: event.target.checked }))} disabled={!activeTable || isSavingField} className="h-4 w-4" />
                  必須
                </label>
                <label className="flex items-center gap-3 rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface">
                  <input type="checkbox" checked={fieldForm.uniqueFlag} onChange={(event) => setFieldForm((current) => ({ ...current, uniqueFlag: event.target.checked }))} disabled={!activeTable || isSavingField} className="h-4 w-4" />
                  一意
                </label>
              </div>
              <div className="mt-6">
                <Button type="submit" disabled={!activeTable || isSavingField}>
                  {isSavingField ? "保存中..." : editingFieldId ? "フィールドを更新" : "フィールドを作成"}
                </Button>
              </div>
            </form>

            <div className="hidden gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant md:grid md:grid-cols-[minmax(0,2fr)_160px_120px]">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <div>表示名</div>
                <div>フィールドコード</div>
              </div>
              <div>種類</div>
              <div>操作</div>
            </div>

            <div className="space-y-2">
              {activeTable && isLoadingFields && (
                <div className="rounded-lg bg-surface-container p-6 text-sm text-on-surface-variant">
                  フィールドを読み込んでいます...
                </div>
              )}

              {fields.map((field) => (
                <div key={field.id} className="grid grid-cols-1 gap-4 rounded-lg bg-surface-container p-4 md:grid-cols-[minmax(0,2fr)_160px_120px] md:items-center">
                  <div className="min-w-0">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant md:hidden">
                      表示名 / フィールドコード
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="min-w-0">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          表示名
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("truncate text-sm", field.fieldType === "ai_generated" ? "font-bold text-primary" : "text-on-surface")}>
                            {field.name}
                          </span>
                          {field.required && <span className="text-xs text-error">*</span>}
                          {field.uniqueFlag && <Badge variant="info">一意</Badge>}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          フィールドコード
                        </div>
                        <div className="truncate font-mono text-xs text-on-surface-variant">
                          {field.code}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant md:hidden">
                      種類
                    </div>
                    <Badge variant={FIELD_META[field.fieldType].variant}>{FIELD_META[field.fieldType].label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingFieldId(field.id);
                        setFieldForm({
                          name: field.name,
                          code: field.code,
                          fieldType: field.fieldType,
                          required: field.required,
                          uniqueFlag: field.uniqueFlag,
                          optionsText: getFieldOptions(field).join(", "),
                        });
                      }}
                    >
                      編集
                    </Button>
                    <Button type="button" size="sm" variant="danger" onClick={() => void onDeleteField(field)}>
                      削除
                    </Button>
                  </div>
                </div>
              ))}

              {!isLoadingFields && activeTable && fields.length === 0 && (
                <div className="rounded-lg border border-dashed border-outline-variant/40 p-6 text-sm text-on-surface-variant">
                  フィールドはまだありません。
                </div>
              )}
            </div>

            <div className="mt-10 flex justify-end">
              <Link href={`/apps/${appId}/workflows`}>
                <Button variant="ghost" size="md">
                  次へ: ワークフロー
                  <Icon name="arrow_forward" size="sm" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
        </div>

        <AISidebar className="border-t border-outline-variant/20 2xl:h-auto 2xl:w-80 2xl:border-l 2xl:border-t-0">
          <div className="text-xs text-on-surface">
            この画面では、既存 API 経由で実際のテーブルメタデータを読み書きします。
          </div>
        </AISidebar>
      </main>
    </>
  );
}
