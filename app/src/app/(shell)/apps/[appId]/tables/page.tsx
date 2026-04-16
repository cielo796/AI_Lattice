"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
  text: { label: "Text", variant: "default" },
  textarea: { label: "Textarea", variant: "default" },
  number: { label: "Number", variant: "info" },
  date: { label: "Date", variant: "info" },
  datetime: { label: "Datetime", variant: "info" },
  boolean: { label: "Boolean", variant: "default" },
  select: { label: "Select", variant: "warning" },
  user_ref: { label: "User ref", variant: "info" },
  master_ref: { label: "Master ref", variant: "info" },
  file: { label: "File", variant: "default" },
  ai_generated: { label: "AI generated", variant: "ai" },
  calculated: { label: "Calculated", variant: "warning" },
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
  const appId = getParam(params.appId);

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

  const activeTable = tables.find((table) => table.id === activeTableId) ?? null;

  useEffect(() => {
    if (!appId) {
      setError("Missing app id.");
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
          setError(nextError instanceof Error ? nextError.message : "Failed to load tables.");
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
          setError(nextError instanceof Error ? nextError.message : "Failed to load fields.");
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
      setError(nextError instanceof Error ? nextError.message : "Failed to save table.");
    } finally {
      setIsSavingTable(false);
    }
  }

  async function onDeleteTable(table: AppTable) {
    if (!appId || !window.confirm(`Delete table "${table.name}"?`)) return;
    try {
      await deleteTable(appId, table.id);
      const nextTables = tables.filter((item) => item.id !== table.id);
      setTables(nextTables);
      setActiveTableId((current) => (current === table.id ? nextTables[0]?.id ?? null : current));
      if (editingTableId === table.id) resetTableForm();
      resetFieldForm();
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete table.");
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
      setError(nextError instanceof Error ? nextError.message : "Failed to save field.");
    } finally {
      setIsSavingField(false);
    }
  }

  async function onDeleteField(field: AppField) {
    if (!appId || !activeTableId || !window.confirm(`Delete field "${field.name}"?`)) return;
    try {
      await deleteField(appId, activeTableId, field.id);
      setFields((current) => current.filter((item) => item.id !== field.id));
      if (editingFieldId === field.id) resetFieldForm();
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete field.");
    }
  }

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Builder" }, { label: "Apps" }, { label: "Tables" }]}
        actions={
          <>
            <Button variant="ghost" size="md">
              <Icon name="visibility" size="sm" />
              Preview
            </Button>
            <Button variant="primary" size="md">
              <Icon name="rocket_launch" size="sm" />
              Publish
            </Button>
          </>
        }
      />

      <main className="flex min-h-[calc(100vh-4rem)] flex-col pt-16 2xl:h-[calc(100vh-4rem)] 2xl:flex-row">
        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <aside className="w-full border-b border-outline-variant/20 bg-surface-container p-4 xl:w-80 xl:overflow-y-auto xl:border-b-0 xl:border-r xl:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Tables</div>
              <div className="text-sm text-on-surface-variant">Real API-backed metadata.</div>
            </div>
            <Badge variant="info">{tables.length}</Badge>
          </div>

          {isLoadingTables && (
            <div className="mb-4 rounded-lg bg-surface-container-high p-4 text-sm text-on-surface-variant">
              Loading tables...
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
                    {table.isSystem && <Badge variant="warning">System</Badge>}
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
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    className="flex-1"
                    onClick={() => void onDeleteTable(table)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={(event) => void onSubmitTable(event)} className="mt-6 rounded-xl bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">{editingTableId ? "Edit table" : "New table"}</h3>
              {editingTableId && (
                <Button type="button" size="sm" variant="ghost" onClick={resetTableForm}>
                  Cancel
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <Input value={tableForm.name} onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))} placeholder="Table name" required />
              <Input value={tableForm.code} onChange={(event) => setTableForm((current) => ({ ...current, code: event.target.value }))} placeholder="table_code" />
              <label className="flex items-center gap-3 rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface">
                <input type="checkbox" checked={tableForm.isSystem} onChange={(event) => setTableForm((current) => ({ ...current, isSystem: event.target.checked }))} className="h-4 w-4" />
                System table
              </label>
              <Button type="submit" disabled={isSavingTable} className="w-full">
                {isSavingTable ? "Saving..." : editingTableId ? "Update table" : "Create table"}
              </Button>
            </div>
          </form>
        </aside>

        <section className="flex-1 overflow-y-auto bg-surface px-4 py-6 md:px-6 xl:p-10">
          {error && (
            <div className="mb-6 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <div className="max-w-4xl">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-headline text-2xl font-bold text-white md:text-3xl">
                  {activeTable ? activeTable.name : "Select a table"}
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {activeTable ? `Fields saved to ${activeTable.code}.` : "Create or select a table first."}
                </p>
              </div>
              {activeTable && <Badge variant="info">{fields.length} fields</Badge>}
            </div>

            <form onSubmit={(event) => void onSubmitField(event)} className="mb-8 rounded-xl bg-surface-container p-4 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{editingFieldId ? "Edit field" : "New field"}</h3>
                {editingFieldId && (
                  <Button type="button" size="sm" variant="ghost" onClick={resetFieldForm}>
                    Cancel
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input value={fieldForm.name} onChange={(event) => setFieldForm((current) => ({ ...current, name: event.target.value }))} placeholder="Field name" required disabled={!activeTable || isSavingField} />
                <Input value={fieldForm.code} onChange={(event) => setFieldForm((current) => ({ ...current, code: event.target.value }))} placeholder="field_code" disabled={!activeTable || isSavingField} />
                <select value={fieldForm.fieldType} onChange={(event) => setFieldForm((current) => ({ ...current, fieldType: event.target.value as FieldType }))} disabled={!activeTable || isSavingField} className="w-full rounded-lg bg-surface-container-high px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {FIELD_TYPES.map((fieldType) => (
                    <option key={fieldType} value={fieldType}>
                      {FIELD_META[fieldType].label}
                    </option>
                  ))}
                </select>
                <Input value={fieldForm.optionsText} onChange={(event) => setFieldForm((current) => ({ ...current, optionsText: event.target.value }))} placeholder="Option A, Option B" disabled={!activeTable || isSavingField || fieldForm.fieldType !== "select"} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <label className="flex items-center gap-3 rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface">
                  <input type="checkbox" checked={fieldForm.required} onChange={(event) => setFieldForm((current) => ({ ...current, required: event.target.checked }))} disabled={!activeTable || isSavingField} className="h-4 w-4" />
                  Required
                </label>
                <label className="flex items-center gap-3 rounded-lg bg-surface-container-high px-3 py-2 text-sm text-on-surface">
                  <input type="checkbox" checked={fieldForm.uniqueFlag} onChange={(event) => setFieldForm((current) => ({ ...current, uniqueFlag: event.target.checked }))} disabled={!activeTable || isSavingField} className="h-4 w-4" />
                  Unique
                </label>
              </div>
              <div className="mt-6">
                <Button type="submit" disabled={!activeTable || isSavingField}>
                  {isSavingField ? "Saving..." : editingFieldId ? "Update field" : "Create field"}
                </Button>
              </div>
            </form>

            <div className="hidden gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant md:grid md:grid-cols-[minmax(0,2fr)_160px_120px]">
              <div>Field</div>
              <div>Type</div>
              <div>Actions</div>
            </div>

            <div className="space-y-2">
              {activeTable && isLoadingFields && (
                <div className="rounded-lg bg-surface-container p-6 text-sm text-on-surface-variant">
                  Loading fields...
                </div>
              )}

              {fields.map((field) => (
                <div key={field.id} className="grid grid-cols-1 gap-4 rounded-lg bg-surface-container p-4 md:grid-cols-[minmax(0,2fr)_160px_120px] md:items-center">
                  <div className="min-w-0">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant md:hidden">
                      Field
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("truncate font-mono text-sm", field.fieldType === "ai_generated" ? "font-bold text-primary" : "text-on-surface")}>
                        {field.name}
                      </span>
                      {field.required && <span className="text-xs text-error">*</span>}
                      {field.uniqueFlag && <Badge variant="info">Unique</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-on-surface-variant">{field.code}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant md:hidden">
                      Type
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
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="danger" onClick={() => void onDeleteField(field)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}

              {!isLoadingFields && activeTable && fields.length === 0 && (
                <div className="rounded-lg border border-dashed border-outline-variant/40 p-6 text-sm text-on-surface-variant">
                  No fields yet.
                </div>
              )}
            </div>

            <div className="mt-10 flex justify-end">
              <Link href={`/apps/${appId}/workflows`}>
                <Button variant="ghost" size="md">
                  Next: workflows
                  <Icon name="arrow_forward" size="sm" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
        </div>

        <AISidebar className="border-t border-outline-variant/20 2xl:h-auto 2xl:w-80 2xl:border-l 2xl:border-t-0">
          <div className="text-xs text-on-surface">
            This screen now reads and writes real table metadata through the existing API.
          </div>
        </AISidebar>
      </main>
    </>
  );
}
