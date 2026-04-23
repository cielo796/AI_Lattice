"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { cn } from "@/lib/cn";
import type { AppField } from "@/types/app";
import type { AppRecord } from "@/types/record";

interface RecordCreatePanelProps {
  fields: AppField[];
  mode?: "create" | "edit";
  initialRecord?: AppRecord | null;
  isSubmitting?: boolean;
  tableName?: string;
  onClose?: () => void;
  onSubmit?: (input: { status: string; data: Record<string, unknown> }) => Promise<void>;
}

type DraftValue = string | boolean;

function formatFieldLabel(field: AppField) {
  const labelByCode: Record<string, string> = {
    ticket_id: "チケット ID",
    subject: "件名",
    title: "タイトル",
    description: "説明",
    details: "詳細",
    priority: "優先度",
    status: "ステータス",
    customer: "顧客",
    requester: "依頼者",
    assignee: "担当者",
  };

  return labelByCode[field.code] ?? field.name
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

function formatFieldType(fieldType: AppField["fieldType"]) {
  const labels: Record<AppField["fieldType"], string> = {
    text: "テキスト",
    textarea: "長文テキスト",
    number: "数値",
    date: "日付",
    datetime: "日時",
    boolean: "真偽値",
    select: "選択式",
    user_ref: "ユーザー参照",
    master_ref: "マスター参照",
    file: "ファイル",
    ai_generated: "AI 生成",
    calculated: "計算式",
  };

  return labels[fieldType] ?? fieldType;
}

function getSelectOptions(field: AppField) {
  const options = field.settingsJson?.options;

  if (!Array.isArray(options)) {
    return [];
  }

  return options.filter((option): option is string => typeof option === "string");
}

function getRecordValue(record: AppRecord | null | undefined, fieldCode: string) {
  if (!record || !record.data || typeof record.data !== "object") {
    return undefined;
  }

  return record.data[fieldCode];
}

function getDraftValue(field: AppField, initialRecord?: AppRecord | null): DraftValue {
  const existingValue =
    field.code === "status"
      ? getRecordValue(initialRecord, field.code) ?? initialRecord?.status
      : getRecordValue(initialRecord, field.code);

  if (field.fieldType === "boolean") {
    if (typeof existingValue === "boolean") {
      return existingValue;
    }

    return typeof field.defaultValue === "boolean" ? field.defaultValue : false;
  }

  if (typeof existingValue === "string") {
    return existingValue;
  }

  if (typeof existingValue === "number") {
    return String(existingValue);
  }

  if (typeof field.defaultValue === "string") {
    return field.defaultValue;
  }

  if (typeof field.defaultValue === "number") {
    return String(field.defaultValue);
  }

  return "";
}

function buildInitialDraft(fields: AppField[], initialRecord?: AppRecord | null) {
  return fields.reduce<Record<string, DraftValue>>((draft, field) => {
    draft[field.code] = getDraftValue(field, initialRecord);
    return draft;
  }, {});
}

function getMissingRequiredFields(
  fields: AppField[],
  draft: Record<string, DraftValue>
) {
  return fields
    .filter((field) => {
      if (!field.required || field.fieldType === "boolean") {
        return false;
      }

      const value = draft[field.code];
      return typeof value !== "string" || !value.trim();
    })
    .map((field) => formatFieldLabel(field));
}

function normalizeDraft(
  fields: AppField[],
  draft: Record<string, DraftValue>,
  fallbackStatus: string
) {
  const data: Record<string, unknown> = {};

  for (const field of fields) {
    const value = draft[field.code];

    if (field.fieldType === "boolean") {
      data[field.code] = Boolean(value);
      continue;
    }

    if (typeof value !== "string") {
      continue;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      continue;
    }

    if (field.fieldType === "number") {
      const numericValue = Number(trimmedValue);

      if (Number.isNaN(numericValue)) {
        throw new Error(`${formatFieldLabel(field)}は数値で入力してください。`);
      }

      data[field.code] = numericValue;
      continue;
    }

    data[field.code] = trimmedValue;
  }

  const statusValue =
    typeof data.status === "string" && data.status.trim()
      ? data.status.trim()
      : fallbackStatus;

  return {
    status: statusValue,
    data,
  };
}

function renderFieldInput(
  field: AppField,
  value: DraftValue,
  onChange: (nextValue: DraftValue) => void
) {
  const sharedClassName =
    "w-full rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30";

  if (field.fieldType === "textarea") {
    return (
      <textarea
        rows={4}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className={cn(sharedClassName, "resize-y")}
        placeholder={`${formatFieldLabel(field)}を入力`}
      />
    );
  }

  if (field.fieldType === "boolean") {
    return (
      <label className="flex min-h-[50px] items-center justify-between rounded-lg bg-surface-container-high px-4 py-3 text-sm text-on-surface">
        <span>有効</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
      </label>
    );
  }

  if (field.fieldType === "select") {
    const options = getSelectOptions(field);

    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className={sharedClassName}
      >
        <option value="">選択してください</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.fieldType === "date") {
    return (
      <Input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.fieldType === "datetime") {
    return (
      <Input
        type="datetime-local"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.fieldType === "number") {
    return (
      <Input
        type="number"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`${formatFieldLabel(field)}を入力`}
      />
    );
  }

  return (
    <Input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder={`${formatFieldLabel(field)}を入力`}
    />
  );
}

export function RecordCreatePanel({
  fields,
  mode = "create",
  initialRecord = null,
  isSubmitting = false,
  tableName,
  onClose,
  onSubmit,
}: RecordCreatePanelProps) {
  const [draft, setDraft] = useState<Record<string, DraftValue>>(() =>
    buildInitialDraft(fields, initialRecord)
  );
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!onSubmit) {
      return;
    }

    const missingFields = getMissingRequiredFields(fields, draft);
    if (missingFields.length > 0) {
      setFormError(`必須項目: ${missingFields.join(", ")}`);
      return;
    }

    try {
      setFormError(null);
      await onSubmit(
        normalizeDraft(fields, draft, initialRecord?.status ?? "active")
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : mode === "edit"
            ? "レコードの更新に失敗しました。"
            : "レコードの作成に失敗しました。"
      );
    }
  }

  const title = mode === "edit" ? "レコード編集" : "レコード作成";
  const heading =
    mode === "edit"
      ? `${tableName ?? "レコード"}を更新`
      : `新規${tableName ?? "レコード"}`;
  const submitLabel =
    mode === "edit"
      ? isSubmitting
        ? "保存中..."
        : "変更を保存"
      : isSubmitting
        ? "作成中..."
        : "レコードを作成";

  return (
    <section className="border-b border-outline-variant/30 bg-surface-container px-8 py-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            {title}
          </div>
          <h2 className="font-headline text-2xl font-extrabold text-white">
            {heading}
          </h2>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          キャンセル
        </Button>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)}>
        {fields.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.id}
                className={cn(
                  "space-y-2",
                  field.fieldType === "textarea" ? "lg:col-span-2" : ""
                )}
              >
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold text-on-surface">
                    {formatFieldLabel(field)}
                  </label>
                  {field.required && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      必須
                    </span>
                  )}
                </div>
                {renderFieldInput(field, draft[field.code], (nextValue) => {
                  setDraft((current) => ({
                    ...current,
                    [field.code]: nextValue,
                  }));
                })}
                <div className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                  {formatFieldType(field.fieldType)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
            このテーブルには実行時フィールドがまだありません。レコードは空のデータで保存されます。
          </div>
        )}

        {formError && (
          <div className="mt-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {formError}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={isSubmitting || !onSubmit}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </section>
  );
}
