import { formatFieldValue } from "@/lib/runtime-records";
import type { FieldType } from "@/types/app";

const numberFormatter = new Intl.NumberFormat("ja-JP", { maximumSignificantDigits: 21 });

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
