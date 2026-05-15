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
  getReferenceDisplayFieldCode,
  getReferenceLookupFieldCodes,
  getReferenceTableId,
  isMultiReferenceField,
  shouldShowBackReference,
} from "@/lib/runtime-records";
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
  referenceTableId: string;
  displayFieldCode: string;
  lookupFieldCodes: string[];
  multiple: boolean;
  showBackReference: boolean;
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
  referenceTableId: "",
  displayFieldCode: "",
  lookupFieldCodes: [],
  multiple: false,
  showBackReference: false,
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
  master_ref: { label: "他テーブル参照", variant: "info" },
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
  const [referenceTableFields, setReferenceTableFields] = useState<AppField[]>([]);
  const [isLoadingReferenceTableFields, setIsLoadingReferenceTableFields] =
    useState(false);

  const activeTable = tables.find((table) => table.id === activeTableId) ?? null;
  const referenceTableOptions = tables.filter((table) => table.id !== activeTableId);
  const activeReferenceTable =
    tables.find((table) => table.id === fieldForm.referenceTableId) ?? null;

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

  useEffect(() => {
    if (!appId || fieldForm.fieldType !== "master_ref" || !fieldForm.referenceTableId) {
      setReferenceTableFields([]);
      setIsLoadingReferenceTableFields(false);
      return;
    }

    let cancelled = false;

    async function loadReferenceFields() {
      try {
        setIsLoadingReferenceTableFields(true);
        const nextFields = sortByOrder(
          await listFields(appId, fieldForm.referenceTableId)
        );

        if (cancelled) {
          return;
        }

        setReferenceTableFields(nextFields);
        setFieldForm((current) => {
          const availableCodes = new Set(nextFields.map((field) => field.code));
          const nextDisplayFieldCode = availableCodes.has(current.displayFieldCode)
            ? current.displayFieldCode
            : "";
          const nextLookupFieldCodes = current.lookupFieldCodes.filter((lookupFieldCode) =>
            availableCodes.has(lookupFieldCode)
          );

          if (
            nextDisplayFieldCode === current.displayFieldCode &&
            nextLookupFieldCodes.length === current.lookupFieldCodes.length
          ) {
            return current;
          }

          return {
            ...current,
            displayFieldCode: nextDisplayFieldCode,
            lookupFieldCodes: nextLookupFieldCodes,
          };
        });
      } catch (nextError) {
        if (!cancelled) {
          setReferenceTableFields([]);
          setError(
            nextError instanceof Error
              ? nextError.message
              : "参照先フィールドの読み込みに失敗しました。"
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingReferenceTableFields(false);
        }
      }
    }

    void loadReferenceFields();
    return () => {
      cancelled = true;
    };
  }, [appId, fieldForm.fieldType, fieldForm.referenceTableId]);

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
    const referenceTable = tables.find((table) => table.id === fieldForm.referenceTableId);

    if (fieldForm.fieldType === "master_ref" && !referenceTable) {
      setError("参照先テーブルを選択してください。");
      setIsSavingField(false);
      return;
    }

    try {
      if (editingFieldId) {
        const payload: UpdateFieldInput = {
          name: fieldForm.name.trim() || undefined,
          code: fieldForm.code.trim() || undefined,
          fieldType: fieldForm.fieldType,
          required: fieldForm.required,
          uniqueFlag: fieldForm.uniqueFlag,
          settingsJson:
            fieldForm.fieldType === "select"
              ? { options }
              : fieldForm.fieldType === "master_ref" && referenceTable
                ? {
                    referenceTableId: referenceTable.id,
                    referenceTableCode: referenceTable.code,
                    displayFieldCode: fieldForm.displayFieldCode || undefined,
                    lookupFieldCodes:
                      fieldForm.lookupFieldCodes.length > 0
                        ? fieldForm.lookupFieldCodes
                        : undefined,
                    multiple: fieldForm.multiple,
                    showBackReference: fieldForm.showBackReference,
                  }
                : {},
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
          settingsJson:
            fieldForm.fieldType === "select"
              ? { options }
              : fieldForm.fieldType === "master_ref" && referenceTable
                ? {
                    referenceTableId: referenceTable.id,
                    referenceTableCode: referenceTable.code,
                    displayFieldCode: fieldForm.displayFieldCode || undefined,
                    lookupFieldCodes:
                      fieldForm.lookupFieldCodes.length > 0
                        ? fieldForm.lookupFieldCodes
                        : undefined,
                    multiple: fieldForm.multiple,
                    showBackReference: fieldForm.showBackReference,
                  }
                : undefined,
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

      <main className="flex min-h-[calc(100vh-3.5rem)] flex-col pt-14 2xl:h-[calc(100vh-3.5rem)] 2xl:flex-row">
        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <aside className="w-full border-b border-outline-variant bg-sidebar p-4 xl:w-80 xl:overflow-y-auto xl:border-b-0 xl:border-r xl:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">テーブル</div>
              <div className="text-sm text-on-surface-variant">API と連携したメタデータです。</div>
            </div>
            <Badge variant="info">{tables.length}</Badge>
          </div>

          {isLoadingTables && (
            <div className="mb-4 rounded-lg border border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
              テーブルを読み込んでいます...
            </div>
          )}

          <div className="space-y-2">
            {tables.map((table) => (
              <div
                key={table.id}
                data-draggable
                className={cn(
                  "group rounded-lg border p-3 transition-colors",
                  activeTableId === table.id
                    ? "border-primary-container bg-primary-container/40"
                    : "border-outline-variant bg-surface hover:border-outline hover:bg-surface-container-low"
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

          <form onSubmit={(event) => void onSubmitTable(event)} className="mt-6 rounded-xl border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight text-on-surface">{editingTableId ? "テーブルを編集" : "新規テーブル"}</h3>
              {editingTableId && (
                <Button type="button" size="sm" variant="ghost" onClick={resetTableForm}>
                  キャンセル
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <Input value={tableForm.name} onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))} placeholder="テーブル名" required />
              <Input value={tableForm.code} onChange={(event) => setTableForm((current) => ({ ...current, code: event.target.value }))} placeholder="table_code" />
              <label className="flex items-center gap-2.5 rounded-md border border-outline-variant bg-surface-container-low px-3 py-1.5 text-[13px] font-medium text-on-surface">
                <input type="checkbox" checked={tableForm.isSystem} onChange={(event) => setTableForm((current) => ({ ...current, isSystem: event.target.checked }))} className="h-4 w-4" />
                システムテーブル
              </label>
              <Button type="submit" disabled={isSavingTable} className="w-full">
                {isSavingTable ? "保存中..." : editingTableId ? "テーブルを更新" : "テーブルを作成"}
              </Button>
            </div>
          </form>
        </aside>

        <section className="flex-1 overflow-y-auto bg-surface-container-low px-4 py-6 md:px-6 xl:p-10">
          {wasCreated && (
            <div className="mb-6 rounded-lg border border-success-container bg-success-container/40 px-4 py-3 text-sm font-medium text-on-success-container">
              アプリを作成しました。生成されたスキーマを確認し、必要に応じてテーブルとフィールドを調整してください。
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-error-container bg-error-container/40 px-4 py-3 text-sm font-medium text-on-error-container">
              {error}
            </div>
          )}

          <div className="max-w-4xl">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
                  {activeTable ? activeTable.name : "テーブルを選択"}
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {activeTable ? `${activeTable.code} に保存されているフィールドです。` : "先にテーブルを作成または選択してください。"}
                </p>
              </div>
              {activeTable && <Badge variant="info">{fields.length} フィールド</Badge>}
            </div>

            <form onSubmit={(event) => void onSubmitField(event)} className="mb-8 rounded-xl border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-headline text-lg font-bold tracking-tight text-on-surface">{editingFieldId ? "フィールドを編集" : "新規フィールド"}</h3>
                {editingFieldId && (
                  <Button type="button" size="sm" variant="ghost" onClick={resetFieldForm}>
                    キャンセル
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    表示名
                  </label>
                  <Input value={fieldForm.name} onChange={(event) => setFieldForm((current) => ({ ...current, name: event.target.value }))} placeholder="件名" required disabled={!activeTable || isSavingField} />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    フィールドコード
                  </label>
                  <Input value={fieldForm.code} onChange={(event) => setFieldForm((current) => ({ ...current, code: event.target.value }))} placeholder="field_code" disabled={!activeTable || isSavingField} />
                </div>
                <div className="rounded-md border border-info-container bg-info-container/40 px-3 py-2 text-[12px] leading-relaxed text-on-info-container md:col-span-2">
                  表示名は画面に表示される名称です。コードは API とレコード保存に使われます。
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    フィールド型
                  </label>
                  <select
                    value={fieldForm.fieldType}
                    onChange={(event) =>
                      setFieldForm((current) => ({
                        ...current,
                        fieldType: event.target.value as FieldType,
                        optionsText:
                          event.target.value === "select" ? current.optionsText : "",
                        referenceTableId:
                          event.target.value === "master_ref"
                            ? current.referenceTableId
                            : "",
                        displayFieldCode:
                          event.target.value === "master_ref"
                            ? current.displayFieldCode
                            : "",
                        lookupFieldCodes:
                          event.target.value === "master_ref"
                            ? current.lookupFieldCodes
                            : [],
                        multiple:
                          event.target.value === "master_ref"
                            ? current.multiple
                            : false,
                        showBackReference:
                          event.target.value === "master_ref"
                            ? current.showBackReference
                            : false,
                      }))
                    }
                    disabled={!activeTable || isSavingField}
                    className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {FIELD_TYPES.map((fieldType) => (
                      <option key={fieldType} value={fieldType}>
                        {FIELD_META[fieldType].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    {fieldForm.fieldType === "master_ref" ? "参照先テーブル" : "選択肢"}
                  </label>
                  {fieldForm.fieldType === "master_ref" ? (
                    <select
                      value={fieldForm.referenceTableId}
                      onChange={(event) =>
                        setFieldForm((current) => ({
                          ...current,
                          referenceTableId: event.target.value,
                          displayFieldCode: "",
                          lookupFieldCodes: [],
                        }))
                      }
                      disabled={
                        !activeTable || isSavingField || referenceTableOptions.length === 0
                      }
                      className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">
                        {referenceTableOptions.length > 0
                          ? "参照先テーブルを選択"
                          : "参照可能なテーブルがありません"}
                      </option>
                      {referenceTableOptions.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name} ({table.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={fieldForm.optionsText}
                      onChange={(event) =>
                        setFieldForm((current) => ({
                          ...current,
                          optionsText: event.target.value,
                        }))
                      }
                      placeholder="選択肢 A, 選択肢 B"
                      disabled={
                        !activeTable || isSavingField || fieldForm.fieldType !== "select"
                      }
                    />
                  )}
                </div>
                {fieldForm.fieldType === "master_ref" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                        表示フィールド
                      </label>
                      <select
                        value={fieldForm.displayFieldCode}
                        onChange={(event) =>
                          setFieldForm((current) => ({
                            ...current,
                            displayFieldCode: event.target.value,
                            lookupFieldCodes: current.lookupFieldCodes.filter(
                              (lookupFieldCode) => lookupFieldCode !== event.target.value
                            ),
                          }))
                        }
                        disabled={
                          !activeTable ||
                          isSavingField ||
                          !activeReferenceTable ||
                          isLoadingReferenceTableFields
                        }
                        className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">
                          {activeReferenceTable
                            ? "自動判定を使う"
                            : "参照先テーブルを選択してください"}
                        </option>
                        {referenceTableFields.map((field) => (
                          <option key={field.id} value={field.code}>
                            {field.name} ({field.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                        Lookup フィールド
                      </label>
                      <select
                        multiple
                        value={fieldForm.lookupFieldCodes}
                        onChange={(event) =>
                          setFieldForm((current) => ({
                            ...current,
                            lookupFieldCodes: Array.from(
                              event.target.selectedOptions,
                              (option) => option.value
                            ),
                          }))
                        }
                        disabled={
                          !activeTable ||
                          isSavingField ||
                          !activeReferenceTable ||
                          isLoadingReferenceTableFields
                        }
                        className="min-h-[124px] w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {referenceTableFields
                          .filter((field) => field.code !== fieldForm.displayFieldCode)
                          .map((field) => (
                            <option key={field.id} value={field.code}>
                              {field.name} ({field.code})
                            </option>
                          ))}
                      </select>
                      <div className="text-[11px] text-on-surface-variant">
                        参照先レコードから詳細に展開する項目です。
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <label className="flex items-center gap-2.5 rounded-md border border-outline-variant bg-surface-container-low px-3 py-1.5 text-[13px] font-medium text-on-surface">
                  <input type="checkbox" checked={fieldForm.required} onChange={(event) => setFieldForm((current) => ({ ...current, required: event.target.checked }))} disabled={!activeTable || isSavingField} className="h-4 w-4" />
                  必須
                </label>
                <label className="flex items-center gap-2.5 rounded-md border border-outline-variant bg-surface-container-low px-3 py-1.5 text-[13px] font-medium text-on-surface">
                  <input type="checkbox" checked={fieldForm.uniqueFlag} onChange={(event) => setFieldForm((current) => ({ ...current, uniqueFlag: event.target.checked }))} disabled={!activeTable || isSavingField} className="h-4 w-4" />
                  一意
                </label>
                {fieldForm.fieldType === "master_ref" && (
                  <>
                    <label className="flex items-center gap-2.5 rounded-md border border-outline-variant bg-surface-container-low px-3 py-1.5 text-[13px] font-medium text-on-surface">
                      <input
                        type="checkbox"
                        checked={fieldForm.multiple}
                        onChange={(event) =>
                          setFieldForm((current) => ({
                            ...current,
                            multiple: event.target.checked,
                          }))
                        }
                        disabled={!activeTable || isSavingField}
                        className="h-4 w-4"
                      />
                      複数参照
                    </label>
                    <label className="flex items-center gap-2.5 rounded-md border border-outline-variant bg-surface-container-low px-3 py-1.5 text-[13px] font-medium text-on-surface">
                      <input
                        type="checkbox"
                        checked={fieldForm.showBackReference}
                        onChange={(event) =>
                          setFieldForm((current) => ({
                            ...current,
                            showBackReference: event.target.checked,
                          }))
                        }
                        disabled={!activeTable || isSavingField}
                        className="h-4 w-4"
                      />
                      逆参照を表示
                    </label>
                  </>
                )}
              </div>
              <div className="mt-6">
                <Button type="submit" disabled={!activeTable || isSavingField}>
                  {isSavingField ? "保存中..." : editingFieldId ? "フィールドを更新" : "フィールドを作成"}
                </Button>
              </div>
            </form>

            <div className="hidden gap-4 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted md:grid md:grid-cols-[minmax(0,2fr)_160px_120px]">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <div>表示名</div>
                <div>フィールドコード</div>
              </div>
              <div>種類</div>
              <div>操作</div>
            </div>

            <div className="space-y-2">
              {activeTable && isLoadingFields && (
                <div className="rounded-lg border border-outline-variant bg-surface p-6 text-sm text-on-surface-variant">
                  フィールドを読み込んでいます...
                </div>
              )}

              {fields.map((field) => (
                <div
                  key={field.id}
                  data-draggable
                  className="group grid grid-cols-1 gap-4 rounded-lg border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_2px_4px_rgba(15,23,42,0.06)] md:grid-cols-[minmax(0,2fr)_160px_120px] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted md:hidden">
                      表示名 / フィールドコード
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="min-w-0">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                          表示名
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="drag-handle material-symbols-outlined text-[16px] text-on-surface-muted">
                            drag_indicator
                          </span>
                          <span className={cn("truncate text-[13.5px] font-medium", field.fieldType === "ai_generated" ? "font-semibold text-tertiary" : "text-on-surface")}>
                            {field.name}
                          </span>
                          {field.required && <span className="text-xs text-error">*</span>}
                          {field.uniqueFlag && <Badge variant="info">一意</Badge>}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                          フィールドコード
                        </div>
                        <div className="truncate font-mono text-xs text-on-surface-variant">
                          {field.code}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted md:hidden">
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
                          referenceTableId: getReferenceTableId(field),
                          displayFieldCode: getReferenceDisplayFieldCode(field),
                          lookupFieldCodes: getReferenceLookupFieldCodes(field),
                          multiple: isMultiReferenceField(field),
                          showBackReference: shouldShowBackReference(field),
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
                <div className="rounded-xl border-2 border-dashed border-outline-variant bg-surface px-6 py-10 text-center">
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-primary">
                    <Icon name="view_column" />
                  </div>
                  <p className="text-[13.5px] font-medium text-on-surface">フィールドはまだありません</p>
                  <p className="mt-1 text-[12.5px] text-on-surface-variant">上のフォームから追加できます。</p>
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

        <AISidebar className="border-t border-outline-variant 2xl:h-auto 2xl:w-80 2xl:border-l 2xl:border-t-0">
          <div className="text-xs text-on-surface">
            この画面では、既存 API 経由で実際のテーブルメタデータを読み書きします。
          </div>
        </AISidebar>
      </main>
    </>
  );
}
