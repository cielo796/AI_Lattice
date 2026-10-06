import { automaticCode, FIELD_TYPES } from "@/lib/app-creation";
import { placeField, type FormRow } from "@/lib/blueprint-layout";
import { formRowsFromFields, getFormFields } from "@/lib/form-layout";
import type { App, AppField, AppForm, AppTable, AppView, FieldType } from "@/types/app";

export type TableDesignSnapshot = {
  revision: string;
  app: App;
  tables: AppTable[];
  fields: AppField[];
  forms: AppForm[];
  views: AppView[];
};

export type DesignField = {
  id: string;
  persistedId?: string;
  name: string;
  code: string;
  codeAuto: boolean;
  fieldType: FieldType;
  required: boolean;
  options: string[];
  visible: boolean;
  formRequired: boolean;
  helpText: string;
};

export type TableDesignDraft = {
  appName: string;
  tableId?: string;
  tableName: string;
  tableCode: string;
  tableCodeAuto: boolean;
  formId?: string;
  formName: string;
  fields: DesignField[];
  rows: FormRow[];
};

export type SaveTableDesignInput = {
  revision: string;
  appName: string;
  table: { id?: string; name: string; code: string };
  fields: Array<{ id?: string; name: string; code: string; fieldType: FieldType; required: boolean; options?: string[] }>;
  form: { id?: string; name: string; layoutJson: Record<string, unknown> };
};

export function tableDesignDraft(snapshot: TableDesignSnapshot, tableId = snapshot.tables[0]?.id, formId?: string): TableDesignDraft {
  const table = snapshot.tables.find((candidate) => candidate.id === tableId);
  const fields = snapshot.fields.filter((field) => field.tableId === table?.id);
  const form = formId === "new" ? undefined : snapshot.forms.find((candidate) => candidate.tableId === table?.id && (!formId || candidate.id === formId));
  const configurations = form ? getFormFields(form, fields) : fields.map((field) => ({ fieldCode: field.code, visible: true, required: field.required, width: "full" as const, helpText: "" }));
  const byCode = new Map(fields.map((field) => [field.code, field.id]));
  return {
    appName: snapshot.app.name,
    tableId: table?.id,
    tableName: table?.name ?? "新しいテーブル",
    tableCode: table?.code ?? "items",
    tableCodeAuto: !table,
    formId: form?.id,
    formName: form?.name ?? "標準フォーム",
    fields: fields.map((field) => {
      const configuration = configurations.find((candidate) => candidate.fieldCode === field.code)!;
      return { id: field.id, persistedId: field.id, name: field.name, code: field.code, codeAuto: false, fieldType: field.fieldType, required: field.required, options: Array.isArray(field.settingsJson?.options) ? field.settingsJson.options.filter((option): option is string => typeof option === "string") : [], visible: configuration.visible, formRequired: configuration.required, helpText: configuration.helpText };
    }),
    rows: formRowsFromFields(configurations).map((row) => ({ ...row, items: row.items.map((code) => byCode.get(code)!) })),
  };
}

export function designFieldCode(base: string, fields: DesignField[], exceptId?: string) {
  const codes = new Set(fields.filter((field) => field.id !== exceptId).map((field) => field.code));
  let code = base;
  let suffix = 2;
  while (codes.has(code)) code = `${base}_${suffix++}`;
  return code;
}

export function newDesignField(draft: TableDesignDraft, type: FieldType): DesignField {
  const definition = FIELD_TYPES.find((candidate) => candidate.type === type);
  return { id: crypto.randomUUID(), name: `新しい${definition?.label ?? "項目"}`, code: designFieldCode(`${definition?.prefix ?? "field"}_1`, draft.fields), codeAuto: true, fieldType: type, required: false, options: type === "select" ? ["選択肢A", "選択肢B"] : [], visible: true, formRequired: false, helpText: "" };
}

export function patchDesignField(draft: TableDesignDraft, id: string, patch: Partial<DesignField>): TableDesignDraft {
  return { ...draft, fields: draft.fields.map((field) => {
    if (field.id !== id) return field;
    const next = { ...field, ...patch };
    if (field.persistedId) { next.code = field.code; next.fieldType = field.fieldType; }
    else if (patch.code !== undefined) next.codeAuto = false;
    else if (patch.name !== undefined && field.codeAuto) next.code = designFieldCode(automaticCode(patch.name, field.code), draft.fields, id);
    if (next.required) { next.visible = true; next.formRequired = true; }
    return next;
  }), rows: patch.required && !draft.rows.some((row) => row.items.includes(id)) ? placeField(draft.rows, id, { row: draft.rows.length, position: "end" }) : draft.rows };
}

export function tableDesignErrors(draft: TableDesignDraft): string[] {
  const errors: string[] = [];
  if (!draft.appName.trim()) errors.push("アプリ名を入力してください。");
  if (!draft.tableName.trim()) errors.push("テーブル名を入力してください。");
  if (!draft.tableId && !/^[a-z][a-z0-9-]*$/.test(draft.tableCode)) errors.push("テーブルコードは英小文字・数字・ハイフンで入力してください。");
  if (!draft.formName.trim()) errors.push("フォーム名を入力してください。");
  if (!draft.fields.length || !draft.rows.length) errors.push("部品を追加して、少なくとも1項目をフォームに配置してください。");
  const codes = new Set<string>();
  for (const field of draft.fields) {
    if (!field.name.trim()) errors.push("項目の表示名を入力してください。");
    if (!field.persistedId && !/^[a-z][a-z0-9_]*$/.test(field.code)) errors.push(`${field.name}：フィールドコードは英小文字・数字・アンダースコアで入力してください。`);
    if (codes.has(field.code)) errors.push(`${field.name}：フィールドコードが重複しています。`);
    codes.add(field.code);
    if (field.fieldType === "select" && !field.persistedId && !field.options.length) errors.push(`${field.name}：選択肢を追加してください。`);
  }
  return [...new Set(errors)];
}

export function serializeTableDesign(draft: TableDesignDraft, revision: string): SaveTableDesignInput {
  const byId = new Map(draft.fields.map((field) => [field.id, field]));
  const visible = new Set(draft.rows.flatMap((row) => row.items));
  return {
    revision, appName: draft.appName.trim(),
    table: { id: draft.tableId, name: draft.tableName.trim(), code: draft.tableCode },
    fields: draft.fields.map((field) => ({ id: field.persistedId, name: field.name.trim(), code: field.code, fieldType: field.fieldType, required: field.required, ...(field.fieldType === "select" ? { options: field.options } : {}) })),
    form: { id: draft.formId, name: draft.formName.trim(), layoutJson: { fields: [
      ...draft.rows.flatMap((row, rowIndex) => row.items.map((id) => { const field = byId.get(id)!; return { fieldCode: field.code, visible: true, required: field.required || field.formRequired, width: row.cols === 2 ? "half" : "full", rowIndex, ...(field.helpText.trim() ? { helpText: field.helpText.trim() } : {}) }; })),
      ...draft.fields.filter((field) => !visible.has(field.id)).map((field) => ({ fieldCode: field.code, visible: false, required: false, width: "full", ...(field.helpText.trim() ? { helpText: field.helpText.trim() } : {}) })),
    ] } },
  };
}
