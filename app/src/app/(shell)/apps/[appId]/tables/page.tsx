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
  createForm,
  createField,
  createTable,
  createView,
  deleteApp,
  deleteForm,
  deleteField,
  deleteTable,
  deleteView,
  listFields,
  listForms,
  listTables,
  listViews,
  updateForm,
  updateField,
  updateTable,
  updateView,
  type CreateFormInput,
  type CreateFieldInput,
  type CreateTableInput,
  type CreateViewInput,
  type UpdateFormInput,
  type UpdateFieldInput,
  type UpdateTableInput,
  type UpdateViewInput,
} from "@/lib/api/apps";
import type {
  AppField,
  AppForm,
  AppTable,
  AppView,
  AppViewType,
  FieldType,
} from "@/types/app";

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
type ViewFormState = {
  name: string;
  viewType: AppViewType;
  columnCodes: string[];
  sortFieldCode: string;
  sortDirection: "asc" | "desc";
  filters: ViewFilterFormState[];
};
type ViewFilterFormState = {
  fieldCode: string;
  operator: "equals" | "contains" | "not_empty";
  value: string;
};
type FormFieldFormState = {
  fieldCode: string;
  visible: boolean;
  required: boolean;
  width: "half" | "full";
  helpText: string;
};
type FormFormState = {
  name: string;
  fields: FormFieldFormState[];
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
const EMPTY_VIEW_FORM: ViewFormState = {
  name: "",
  viewType: "list",
  columnCodes: [],
  sortFieldCode: "",
  sortDirection: "desc",
  filters: [],
};
const EMPTY_FORM_FORM: FormFormState = {
  name: "",
  fields: [],
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

const VIEW_META: Record<AppViewType, { label: string; icon: string }> = {
  list: { label: "一覧", icon: "view_list" },
  kanban: { label: "カンバン", icon: "view_kanban" },
  calendar: { label: "カレンダー", icon: "calendar_month" },
  chart: { label: "チャート", icon: "insert_chart" },
  kpi: { label: "KPI", icon: "speed" },
};

const VIEW_FILTER_META: Record<ViewFilterFormState["operator"], string> = {
  equals: "一致",
  contains: "含む",
  not_empty: "空でない",
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

function getViewColumnCodes(view: AppView, fields: AppField[]) {
  const columns = view.settingsJson?.columns;
  const fieldCodes = new Set(fields.map((field) => field.code));

  return Array.isArray(columns)
    ? columns.filter(
        (item): item is string => typeof item === "string" && fieldCodes.has(item)
      )
    : [];
}

function getViewSort(view: AppView) {
  const sort = view.settingsJson?.sort;

  if (!sort || typeof sort !== "object" || Array.isArray(sort)) {
    return { fieldCode: "", direction: "desc" as const };
  }

  const sortSettings = sort as Record<string, unknown>;

  return {
    fieldCode: typeof sortSettings.fieldCode === "string" ? sortSettings.fieldCode : "",
    direction: sortSettings.direction === "asc" ? ("asc" as const) : ("desc" as const),
  };
}

function getViewFilters(view: AppView, fields: AppField[]): ViewFilterFormState[] {
  const filters = view.settingsJson?.filters;
  const fieldCodes = new Set(fields.map((field) => field.code));

  if (!Array.isArray(filters)) {
    return [];
  }

  return filters.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const filter = item as Record<string, unknown>;
    const fieldCode = typeof filter.fieldCode === "string" ? filter.fieldCode : "";

    if (!fieldCodes.has(fieldCode)) {
      return [];
    }

    const operator =
      filter.operator === "equals" || filter.operator === "not_empty"
        ? filter.operator
        : "contains";

    return [
      {
        fieldCode,
        operator,
        value: typeof filter.value === "string" ? filter.value : "",
      },
    ];
  });
}

function buildViewSettings(form: ViewFormState, fields: AppField[]) {
  const fallbackColumns = fields.slice(0, 4).map((field) => field.code);
  const columns = form.columnCodes.length > 0 ? form.columnCodes : fallbackColumns;
  const filters = form.filters
    .filter((filter) => filter.fieldCode)
    .map((filter) => ({
      fieldCode: filter.fieldCode,
      operator: filter.operator,
      ...(filter.operator !== "not_empty" && filter.value.trim()
        ? { value: filter.value.trim() }
        : {}),
    }));

  return {
    columns,
    ...(form.sortFieldCode
      ? {
          sort: {
            fieldCode: form.sortFieldCode,
            direction: form.sortDirection,
          },
        }
      : {}),
    ...(filters.length > 0 ? { filters } : {}),
  };
}

function getDefaultFormField(field: AppField): FormFieldFormState {
  return {
    fieldCode: field.code,
    visible: true,
    required: field.required,
    width: field.fieldType === "textarea" ? "full" : "half",
    helpText: "",
  };
}

function getFormFields(form: AppForm, fields: AppField[]): FormFieldFormState[] {
  const layoutFields = form.layoutJson?.fields;
  const fieldByCode = new Map(fields.map((field) => [field.code, field]));

  if (!Array.isArray(layoutFields)) {
    return fields.map(getDefaultFormField);
  }

  const seenFieldCodes = new Set<string>();
  const normalizedFields = layoutFields.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const layoutField = item as Record<string, unknown>;
    const fieldCode =
      typeof layoutField.fieldCode === "string" ? layoutField.fieldCode : "";
    const field = fieldByCode.get(fieldCode);

    if (!field || seenFieldCodes.has(fieldCode)) {
      return [];
    }

    seenFieldCodes.add(fieldCode);

    return [
      {
        fieldCode,
        visible: field.required ? true : layoutField.visible !== false,
        required: field.required || layoutField.required === true,
        width: layoutField.width === "full" ? ("full" as const) : ("half" as const),
        helpText: typeof layoutField.helpText === "string" ? layoutField.helpText : "",
      },
    ];
  });

  fields.forEach((field) => {
    if (!seenFieldCodes.has(field.code)) {
      normalizedFields.push(getDefaultFormField(field));
    }
  });

  return normalizedFields;
}

function alignFormFields(
  formFields: FormFieldFormState[],
  fields: AppField[]
): FormFieldFormState[] {
  const fieldByCode = new Map(fields.map((field) => [field.code, field]));
  const seenFieldCodes = new Set<string>();
  const normalizedFields = formFields.flatMap((formField) => {
    const field = fieldByCode.get(formField.fieldCode);

    if (!field || seenFieldCodes.has(formField.fieldCode)) {
      return [];
    }

    seenFieldCodes.add(formField.fieldCode);

    return [
      {
        ...formField,
        visible: field.required ? true : formField.visible,
        required: field.required || formField.required,
      },
    ];
  });

  fields.forEach((field) => {
    if (!seenFieldCodes.has(field.code)) {
      normalizedFields.push(getDefaultFormField(field));
    }
  });

  return normalizedFields;
}

function buildFormLayout(form: FormFormState) {
  return {
    fields: form.fields.map((field) => ({
      fieldCode: field.fieldCode,
      visible: field.visible,
      required: field.required,
      width: field.width,
      ...(field.helpText.trim() ? { helpText: field.helpText.trim() } : {}),
    })),
  };
}

export default function TableDesignerPage() {
  const params = useParams<{ appId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appId = getParam(params.appId);
  const wasCreated = searchParams.get("created") === "1";

  const [tables, setTables] = useState<AppTable[]>([]);
  const [fields, setFields] = useState<AppField[]>([]);
  const [views, setViews] = useState<AppView[]>([]);
  const [forms, setForms] = useState<AppForm[]>([]);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [tableForm, setTableForm] = useState(EMPTY_TABLE_FORM);
  const [fieldForm, setFieldForm] = useState(EMPTY_FIELD_FORM);
  const [viewForm, setViewForm] = useState(EMPTY_VIEW_FORM);
  const [formForm, setFormForm] = useState(EMPTY_FORM_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [isLoadingViews, setIsLoadingViews] = useState(false);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [isSavingTable, setIsSavingTable] = useState(false);
  const [isSavingField, setIsSavingField] = useState(false);
  const [isSavingView, setIsSavingView] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);
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
    if (!appId || !activeTableId) {
      setViews([]);
      return;
    }

    const currentTableId = activeTableId;
    let cancelled = false;

    async function loadViewsForTable() {
      try {
        setIsLoadingViews(true);
        const nextViews = sortByOrder(await listViews(appId, currentTableId));
        if (cancelled) return;
        setViews(nextViews);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setViews([]);
          setError(nextError instanceof Error ? nextError.message : "ビューの読み込みに失敗しました。");
        }
      } finally {
        if (!cancelled) setIsLoadingViews(false);
      }
    }

    void loadViewsForTable();
    return () => {
      cancelled = true;
    };
  }, [activeTableId, appId]);

  useEffect(() => {
    if (!appId || !activeTableId) {
      setForms([]);
      return;
    }

    const currentTableId = activeTableId;
    let cancelled = false;

    async function loadFormsForTable() {
      try {
        setIsLoadingForms(true);
        const nextForms = sortByOrder(await listForms(appId, currentTableId));
        if (cancelled) return;
        setForms(nextForms);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setForms([]);
          setError(nextError instanceof Error ? nextError.message : "フォームの読み込みに失敗しました。");
        }
      } finally {
        if (!cancelled) setIsLoadingForms(false);
      }
    }

    void loadFormsForTable();
    return () => {
      cancelled = true;
    };
  }, [activeTableId, appId]);

  useEffect(() => {
    setFormForm((current) => ({
      ...current,
      fields: alignFormFields(current.fields, fields),
    }));
  }, [fields]);

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

  function resetViewForm() {
    setEditingViewId(null);
    setViewForm(EMPTY_VIEW_FORM);
  }

  function resetFormForm() {
    setEditingFormId(null);
    setFormForm({
      ...EMPTY_FORM_FORM,
      fields: fields.map(getDefaultFormField),
    });
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
      resetViewForm();
      resetFormForm();
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
      setViews((current) =>
        current.map((view) => {
          const columns = getViewColumnCodes(
            view,
            fields.filter((item) => item.id !== field.id)
          );
          const sort = getViewSort(view);
          const settingsJson = {
            ...view.settingsJson,
            columns,
            ...(sort.fieldCode === field.code ? { sort: undefined } : {}),
          };

          return {
            ...view,
            settingsJson,
          };
        })
      );
      setForms((current) =>
        current.map((form) => ({
          ...form,
          layoutJson: {
            ...form.layoutJson,
            fields: getFormFields(
              form,
              fields.filter((item) => item.id !== field.id)
            ),
          },
        }))
      );
      if (editingFieldId === field.id) resetFieldForm();
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "フィールドの削除に失敗しました。");
    }
  }

  async function onSubmitView(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appId || !activeTableId) return;
    setIsSavingView(true);

    try {
      const payload: CreateViewInput | UpdateViewInput = {
        name: viewForm.name.trim(),
        viewType: viewForm.viewType,
        settingsJson: buildViewSettings(viewForm, fields),
      };

      if (editingViewId) {
        const updated = await updateView(appId, activeTableId, editingViewId, payload);
        setViews((current) =>
          sortByOrder(current.map((view) => (view.id === updated.id ? updated : view)))
        );
      } else {
        const created = await createView(appId, activeTableId, payload as CreateViewInput);
        setViews((current) => sortByOrder([...current, created]));
      }

      setError(null);
      resetViewForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "ビューの保存に失敗しました。");
    } finally {
      setIsSavingView(false);
    }
  }

  async function onDeleteView(view: AppView) {
    if (!appId || !activeTableId || !window.confirm(`ビュー「${view.name}」を削除しますか？`)) return;

    try {
      await deleteView(appId, activeTableId, view.id);
      setViews((current) => current.filter((item) => item.id !== view.id));
      if (editingViewId === view.id) resetViewForm();
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "ビューの削除に失敗しました。");
    }
  }

  async function onSubmitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appId || !activeTableId) return;
    setIsSavingForm(true);

    try {
      const payload: CreateFormInput | UpdateFormInput = {
        name: formForm.name.trim(),
        layoutJson: buildFormLayout(formForm),
      };

      if (editingFormId) {
        const updated = await updateForm(appId, activeTableId, editingFormId, payload);
        setForms((current) =>
          sortByOrder(current.map((form) => (form.id === updated.id ? updated : form)))
        );
      } else {
        const created = await createForm(appId, activeTableId, payload as CreateFormInput);
        setForms((current) => sortByOrder([...current, created]));
      }

      setError(null);
      resetFormForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "フォームの保存に失敗しました。");
    } finally {
      setIsSavingForm(false);
    }
  }

  async function onDeleteForm(form: AppForm) {
    if (!appId || !activeTableId || !window.confirm(`フォーム「${form.name}」を削除しますか？`)) return;

    try {
      await deleteForm(appId, activeTableId, form.id);
      setForms((current) => current.filter((item) => item.id !== form.id));
      if (editingFormId === form.id) resetFormForm();
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "フォームの削除に失敗しました。");
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
                    resetViewForm();
                    resetFormForm();
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

            <section className="mb-8 rounded-xl border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-6">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-headline text-lg font-bold tracking-tight text-on-surface">
                    ビュー
                  </h3>
                  <p className="mt-1 text-[13px] text-on-surface-variant">
                    Runtime の一覧に表示する列と並び順を定義します。
                  </p>
                </div>
                <Badge variant="info">{views.length} ビュー</Badge>
              </div>

              {activeTable && isLoadingViews && (
                <div className="mb-4 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  ビューを読み込んでいます...
                </div>
              )}

              <div className="mb-5 grid gap-2 md:grid-cols-2">
                {views.map((view) => {
                  const columns = getViewColumnCodes(view, fields);
                  const sort = getViewSort(view);
                  const filters = getViewFilters(view, fields);

                  return (
                    <div
                      key={view.id}
                      className="rounded-lg border border-outline-variant bg-surface-container-low p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon name={VIEW_META[view.viewType].icon} size="sm" />
                            <span className="truncate text-sm font-semibold text-on-surface">
                              {view.name}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-on-surface-variant">
                            {VIEW_META[view.viewType].label} / {columns.length || fields.length} 列
                            {sort.fieldCode ? ` / ${sort.fieldCode} ${sort.direction}` : ""}
                            {filters.length > 0 ? ` / ${filters.length} フィルタ` : ""}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingViewId(view.id);
                              setViewForm({
                                name: view.name,
                                viewType: view.viewType,
                                columnCodes: columns,
                                sortFieldCode: sort.fieldCode,
                                sortDirection: sort.direction,
                                filters,
                              });
                            }}
                          >
                            編集
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => void onDeleteView(view)}
                          >
                            削除
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isLoadingViews && activeTable && views.length === 0 && (
                <div className="mb-5 rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  ビューはまだありません。まず「すべて」などの一覧ビューを作成してください。
                </div>
              )}

              <form onSubmit={(event) => void onSubmitView(event)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      ビュー名
                    </label>
                    <Input
                      value={viewForm.name}
                      onChange={(event) =>
                        setViewForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="すべて"
                      required
                      disabled={!activeTable || isSavingView}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      種別
                    </label>
                    <select
                      value={viewForm.viewType}
                      onChange={(event) =>
                        setViewForm((current) => ({
                          ...current,
                          viewType: event.target.value as AppViewType,
                        }))
                      }
                      disabled={!activeTable || isSavingView}
                      className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {Object.entries(VIEW_META).map(([viewType, meta]) => (
                        <option key={viewType} value={viewType}>
                          {meta.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-2">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                        ソート
                      </label>
                      <select
                        value={viewForm.sortFieldCode}
                        onChange={(event) =>
                          setViewForm((current) => ({
                            ...current,
                            sortFieldCode: event.target.value,
                          }))
                        }
                        disabled={!activeTable || isSavingView}
                        className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">更新順</option>
                        {fields.map((field) => (
                          <option key={field.id} value={field.code}>
                            {field.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                        順序
                      </label>
                      <select
                        value={viewForm.sortDirection}
                        onChange={(event) =>
                          setViewForm((current) => ({
                            ...current,
                            sortDirection: event.target.value as "asc" | "desc",
                          }))
                        }
                        disabled={!activeTable || isSavingView || !viewForm.sortFieldCode}
                        className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="desc">降順</option>
                        <option value="asc">昇順</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                    表示列
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {fields.map((field) => (
                      <label
                        key={field.id}
                        className="flex items-center gap-2.5 rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-[13px] font-medium text-on-surface"
                      >
                        <input
                          type="checkbox"
                          checked={viewForm.columnCodes.includes(field.code)}
                          onChange={(event) =>
                            setViewForm((current) => ({
                              ...current,
                              columnCodes: event.target.checked
                                ? [...current.columnCodes, field.code]
                                : current.columnCodes.filter((code) => code !== field.code),
                            }))
                          }
                          disabled={!activeTable || isSavingView}
                          className="h-4 w-4"
                        />
                        <span className="min-w-0 truncate">{field.name}</span>
                        <span className="ml-auto truncate font-mono text-[11px] text-on-surface-variant">
                          {field.code}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      フィルタ
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!activeTable || isSavingView || fields.length === 0}
                      onClick={() =>
                        setViewForm((current) => ({
                          ...current,
                          filters: [
                            ...current.filters,
                            {
                              fieldCode: fields[0]?.code ?? "",
                              operator: "contains",
                              value: "",
                            },
                          ],
                        }))
                      }
                    >
                      追加
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {viewForm.filters.map((filter, filterIndex) => (
                      <div
                        key={`${filter.fieldCode}-${filterIndex}`}
                        className="grid gap-2 rounded-md border border-outline-variant bg-surface-container-low p-2 md:grid-cols-[minmax(0,1fr)_112px_minmax(0,1fr)_72px]"
                      >
                        <select
                          value={filter.fieldCode}
                          onChange={(event) =>
                            setViewForm((current) => ({
                              ...current,
                              filters: current.filters.map((item, index) =>
                                index === filterIndex
                                  ? { ...item, fieldCode: event.target.value }
                                  : item
                              ),
                            }))
                          }
                          disabled={!activeTable || isSavingView}
                          className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {fields.map((field) => (
                            <option key={field.id} value={field.code}>
                              {field.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={filter.operator}
                          onChange={(event) =>
                            setViewForm((current) => ({
                              ...current,
                              filters: current.filters.map((item, index) =>
                                index === filterIndex
                                  ? {
                                      ...item,
                                      operator: event.target
                                        .value as ViewFilterFormState["operator"],
                                    }
                                  : item
                              ),
                            }))
                          }
                          disabled={!activeTable || isSavingView}
                          className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {Object.entries(VIEW_FILTER_META).map(([operator, label]) => (
                            <option key={operator} value={operator}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <Input
                          value={filter.value}
                          onChange={(event) =>
                            setViewForm((current) => ({
                              ...current,
                              filters: current.filters.map((item, index) =>
                                index === filterIndex
                                  ? { ...item, value: event.target.value }
                                  : item
                              ),
                            }))
                          }
                          placeholder="値"
                          disabled={
                            !activeTable ||
                            isSavingView ||
                            filter.operator === "not_empty"
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={!activeTable || isSavingView}
                          onClick={() =>
                            setViewForm((current) => ({
                              ...current,
                              filters: current.filters.filter(
                                (_item, index) => index !== filterIndex
                              ),
                            }))
                          }
                        >
                          削除
                        </Button>
                      </div>
                    ))}
                    {viewForm.filters.length === 0 && (
                      <div className="rounded-md border border-dashed border-outline-variant bg-surface-container-low px-3 py-2 text-[12.5px] text-on-surface-variant">
                        条件なしで表示します。
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!activeTable || isSavingView || fields.length === 0}>
                    {isSavingView ? "保存中..." : editingViewId ? "ビューを更新" : "ビューを作成"}
                  </Button>
                  {editingViewId && (
                    <Button type="button" variant="ghost" onClick={resetViewForm}>
                      キャンセル
                    </Button>
                  )}
                </div>
              </form>
            </section>

            <section className="mb-8 rounded-xl border border-outline-variant bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-6">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-headline text-lg font-bold tracking-tight text-on-surface">
                    フォーム
                  </h3>
                  <p className="mt-1 text-[13px] text-on-surface-variant">
                    Runtime の作成/編集フォームに表示する項目と入力補助を定義します。
                  </p>
                </div>
                <Badge variant="info">{forms.length} フォーム</Badge>
              </div>

              {activeTable && isLoadingForms && (
                <div className="mb-4 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  フォームを読み込んでいます...
                </div>
              )}

              <div className="mb-5 grid gap-2 md:grid-cols-2">
                {forms.map((form) => {
                  const formFields = getFormFields(form, fields);
                  const visibleCount = formFields.filter((field) => field.visible).length;
                  const requiredCount = formFields.filter((field) => field.required).length;

                  return (
                    <div
                      key={form.id}
                      className="rounded-lg border border-outline-variant bg-surface-container-low p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon name="dynamic_form" size="sm" />
                            <span className="truncate text-sm font-semibold text-on-surface">
                              {form.name}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-on-surface-variant">
                            {visibleCount} 表示 / {requiredCount} 必須
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingFormId(form.id);
                              setFormForm({
                                name: form.name,
                                fields: formFields,
                              });
                            }}
                          >
                            編集
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => void onDeleteForm(form)}
                          >
                            削除
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isLoadingForms && activeTable && forms.length === 0 && (
                <div className="mb-5 rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
                  フォームはまだありません。標準フォームから作成できます。
                </div>
              )}

              <form onSubmit={(event) => void onSubmitForm(event)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                      フォーム名
                    </label>
                    <Input
                      value={formForm.name}
                      onChange={(event) =>
                        setFormForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="標準フォーム"
                      required
                      disabled={!activeTable || isSavingForm}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!activeTable || isSavingForm || fields.length === 0}
                    onClick={() =>
                      setFormForm((current) => ({
                        ...current,
                        fields: fields.map(getDefaultFormField),
                      }))
                    }
                  >
                    標準に戻す
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="hidden gap-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted md:grid md:grid-cols-[minmax(0,1.2fr)_88px_88px_112px_minmax(0,1.3fr)]">
                    <div>フィールド</div>
                    <div>表示</div>
                    <div>必須</div>
                    <div>幅</div>
                    <div>ヘルプ</div>
                  </div>
                  {formForm.fields.map((formField, formFieldIndex) => {
                    const field = fields.find((item) => item.code === formField.fieldCode);
                    if (!field) return null;

                    return (
                      <div
                        key={formField.fieldCode}
                        className="grid gap-3 rounded-md border border-outline-variant bg-surface-container-low p-3 md:grid-cols-[minmax(0,1.2fr)_88px_88px_112px_minmax(0,1.3fr)] md:items-center"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-on-surface">
                            {field.name}
                          </div>
                          <div className="truncate font-mono text-[11px] text-on-surface-variant">
                            {field.code}
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
                          <input
                            type="checkbox"
                            checked={formField.visible}
                            disabled={!activeTable || isSavingForm || field.required}
                            onChange={(event) =>
                              setFormForm((current) => ({
                                ...current,
                                fields: current.fields.map((item, index) =>
                                  index === formFieldIndex
                                    ? {
                                        ...item,
                                        visible: event.target.checked,
                                        required: event.target.checked
                                          ? item.required
                                          : false,
                                      }
                                    : item
                                ),
                              }))
                            }
                            className="h-4 w-4"
                          />
                          表示
                        </label>
                        <label className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
                          <input
                            type="checkbox"
                            checked={formField.required}
                            disabled={
                              !activeTable ||
                              isSavingForm ||
                              field.required ||
                              !formField.visible
                            }
                            onChange={(event) =>
                              setFormForm((current) => ({
                                ...current,
                                fields: current.fields.map((item, index) =>
                                  index === formFieldIndex
                                    ? { ...item, required: event.target.checked }
                                    : item
                                ),
                              }))
                            }
                            className="h-4 w-4"
                          />
                          必須
                        </label>
                        <select
                          value={formField.width}
                          onChange={(event) =>
                            setFormForm((current) => ({
                              ...current,
                              fields: current.fields.map((item, index) =>
                                index === formFieldIndex
                                  ? {
                                      ...item,
                                      width: event.target.value as FormFieldFormState["width"],
                                    }
                                  : item
                              ),
                            }))
                          }
                          disabled={!activeTable || isSavingForm || !formField.visible}
                          className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="half">1/2</option>
                          <option value="full">全幅</option>
                        </select>
                        <Input
                          value={formField.helpText}
                          onChange={(event) =>
                            setFormForm((current) => ({
                              ...current,
                              fields: current.fields.map((item, index) =>
                                index === formFieldIndex
                                  ? { ...item, helpText: event.target.value }
                                  : item
                              ),
                            }))
                          }
                          placeholder="入力時の補足"
                          disabled={!activeTable || isSavingForm || !formField.visible}
                        />
                      </div>
                    );
                  })}
                  {fields.length === 0 && (
                    <div className="rounded-md border border-dashed border-outline-variant bg-surface-container-low px-3 py-2 text-[12.5px] text-on-surface-variant">
                      先にフィールドを追加してください。
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!activeTable || isSavingForm || fields.length === 0}>
                    {isSavingForm ? "保存中..." : editingFormId ? "フォームを更新" : "フォームを作成"}
                  </Button>
                  {editingFormId && (
                    <Button type="button" variant="ghost" onClick={resetFormForm}>
                      キャンセル
                    </Button>
                  )}
                </div>
              </form>
            </section>

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
