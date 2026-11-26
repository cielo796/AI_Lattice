import { formatFieldValue, RECORD_TITLE_FIELD_CODES } from "@/lib/runtime-records";
import type { AppField, FieldType } from "@/types/app";

const numberFormatter = new Intl.NumberFormat("ja-JP", { maximumSignificantDigits: 21 });

export function getRecordTableColumns<Field extends Pick<AppField, "code">>(
  fields: readonly Field[],
  visibleColumnCodes: readonly string[]
): Field[] {
  const fieldsByCode = new Map(fields.map((field) => [field.code, field]));
  const titleFieldCode = RECORD_TITLE_FIELD_CODES.find((code) => fieldsByCode.has(code));
  const columnCodes = Array.from(new Set(visibleColumnCodes)).filter((code) => code !== titleFieldCode);
  return columnCodes.map((code) => fieldsByCode.get(code)).filter((field) => field !== undefined);
}

export function getRuntimeFieldText(value: unknown, fieldType?: FieldType): string {
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return "";
  }

  if (fieldType === "number" && (typeof value === "number" || typeof value === "string")) {
    const number = typeof value === "string" && !value.trim() ? NaN : Number(value);
    if (Number.isFinite(number)) {
      return numberFormatter.format(number);
    }
  }

  const text = formatFieldValue(value);
  return text?.trim() ? text : "";
}

export function spansDetailColumns(text: string, fieldType?: FieldType): boolean {
  return fieldType === "textarea" || /[\r\n]/.test(text) || Array.from(text).length > 40;
}
