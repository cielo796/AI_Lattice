import type { AppField, AppForm } from "@/types/app";
import type { FormRow } from "@/lib/blueprint-layout";

export type FormLayoutField = {
  fieldCode: string;
  visible: boolean;
  required: boolean;
  width: "half" | "full";
  helpText: string;
  rowIndex?: number;
};

export function isFormRowIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function getDefaultFormField(field: AppField): FormLayoutField {
  return { fieldCode: field.code, visible: true, required: field.required, width: field.fieldType === "textarea" ? "full" : "half", helpText: "" };
}

export function alignFormFields(configurations: FormLayoutField[], fields: AppField[]): FormLayoutField[] {
  const byCode = new Map(fields.map((field) => [field.code, field]));
  const seen = new Set<string>();
  const aligned = configurations.flatMap((configuration) => {
    const field = byCode.get(configuration.fieldCode);
    if (!field || seen.has(field.code)) return [];
    seen.add(field.code);
    return [{ ...configuration, visible: field.required || configuration.visible, required: field.required || configuration.required }];
  });
  for (const field of fields) if (!seen.has(field.code)) aligned.push(getDefaultFormField(field));
  return aligned;
}

export function getFormFields(form: Pick<AppForm, "layoutJson">, fields: AppField[]): FormLayoutField[] {
  const source = form.layoutJson?.fields;
  if (!Array.isArray(source)) return fields.map(getDefaultFormField);
  const configurations = source.flatMap((item): FormLayoutField[] => {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.fieldCode !== "string") return [];
    return [{ fieldCode: item.fieldCode, visible: item.visible !== false, required: item.required === true, width: item.width === "full" ? "full" : "half", helpText: typeof item.helpText === "string" ? item.helpText : "", ...(isFormRowIndex(item.rowIndex) ? { rowIndex: item.rowIndex } : {}) }];
  });
  return alignFormFields(configurations, fields);
}

export function formRowsFromFields(configurations: FormLayoutField[]): FormRow[] {
  const visible = configurations.filter((field) => field.visible);
  const positioned = visible.some((field) => isFormRowIndex(field.rowIndex));
  const ordered = positioned ? [...visible].sort((left, right) => (left.rowIndex ?? Infinity) - (right.rowIndex ?? Infinity)) : visible;
  const rows: FormRow[] = [];
  let previousIndex: number | undefined;
  for (const field of ordered) {
    const previous = rows[rows.length - 1];
    const sameRow = positioned ? isFormRowIndex(field.rowIndex) && field.rowIndex === previousIndex : true;
    if (field.width === "half" && previous?.cols === 2 && previous.items.length === 1 && sameRow) previous.items.push(field.fieldCode);
    else rows.push({ cols: field.width === "full" ? 1 : 2, items: [field.fieldCode] });
    previousIndex = field.rowIndex;
  }
  return rows;
}

export function applyFormRows(rows: FormRow[], configurations: FormLayoutField[]): FormLayoutField[] {
  const byCode = new Map(configurations.map((field) => [field.fieldCode, field]));
  const used = new Set<string>();
  const positioned = rows.flatMap((row, rowIndex) => row.items.flatMap((code): FormLayoutField[] => {
    const configuration = byCode.get(code);
    if (!configuration || used.has(code)) return [];
    used.add(code);
    return [{ ...configuration, visible: true, width: row.cols === 1 ? "full" : "half", rowIndex }];
  }));
  const remaining = configurations.filter((field) => !used.has(field.fieldCode)).map((field) => {
    const configuration = { ...field, visible: false, required: false };
    delete configuration.rowIndex;
    return configuration;
  });
  return [...positioned, ...remaining];
}

export function buildFormLayout(form: { fields: FormLayoutField[] }) {
  return { fields: form.fields.map((field) => ({ fieldCode: field.fieldCode, visible: field.visible, required: field.required, width: field.width, ...(isFormRowIndex(field.rowIndex) ? { rowIndex: field.rowIndex } : {}), ...(field.helpText.trim() ? { helpText: field.helpText.trim() } : {}) })) };
}
