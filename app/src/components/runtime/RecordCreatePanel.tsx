"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { cn } from "@/lib/cn";
import type { AppField } from "@/types/app";

interface RecordCreatePanelProps {
  fields: AppField[];
  isSubmitting?: boolean;
  tableName?: string;
  onClose?: () => void;
  onSubmit?: (input: { status: string; data: Record<string, unknown> }) => Promise<void>;
}

type DraftValue = string | boolean;

function formatFieldLabel(field: AppField) {
  return field.name
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

function getSelectOptions(field: AppField) {
  const options = field.settingsJson?.options;

  if (!Array.isArray(options)) {
    return [];
  }

  return options.filter((option): option is string => typeof option === "string");
}

function getDraftValue(field: AppField): DraftValue {
  if (field.fieldType === "boolean") {
    return typeof field.defaultValue === "boolean" ? field.defaultValue : false;
  }

  if (typeof field.defaultValue === "string") {
    return field.defaultValue;
  }

  if (typeof field.defaultValue === "number") {
    return String(field.defaultValue);
  }

  return "";
}

function buildInitialDraft(fields: AppField[]) {
  return fields.reduce<Record<string, DraftValue>>((draft, field) => {
    draft[field.code] = getDraftValue(field);
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

function normalizeDraft(fields: AppField[], draft: Record<string, DraftValue>) {
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
        throw new Error(`${formatFieldLabel(field)} must be a number.`);
      }

      data[field.code] = numericValue;
      continue;
    }

    data[field.code] = trimmedValue;
  }

  const statusValue =
    typeof data.status === "string" && data.status.trim()
      ? data.status.trim()
      : "active";

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
        placeholder={`Enter ${formatFieldLabel(field).toLowerCase()}`}
      />
    );
  }

  if (field.fieldType === "boolean") {
    return (
      <label className="flex min-h-[50px] items-center justify-between rounded-lg bg-surface-container-high px-4 py-3 text-sm text-on-surface">
        <span>Enabled</span>
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
        <option value="">Select an option</option>
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
        placeholder={`Enter ${formatFieldLabel(field).toLowerCase()}`}
      />
    );
  }

  return (
    <Input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder={`Enter ${formatFieldLabel(field).toLowerCase()}`}
    />
  );
}

export function RecordCreatePanel({
  fields,
  isSubmitting = false,
  tableName,
  onClose,
  onSubmit,
}: RecordCreatePanelProps) {
  const [draft, setDraft] = useState<Record<string, DraftValue>>(() =>
    buildInitialDraft(fields)
  );
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!onSubmit) {
      return;
    }

    const missingFields = getMissingRequiredFields(fields, draft);
    if (missingFields.length > 0) {
      setFormError(`Required fields: ${missingFields.join(", ")}`);
      return;
    }

    try {
      setFormError(null);
      await onSubmit(normalizeDraft(fields, draft));
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to create the record."
      );
    }
  }

  return (
    <section className="border-b border-outline-variant/30 bg-surface-container px-8 py-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            Create record
          </div>
          <h2 className="font-headline text-2xl font-extrabold text-white">
            New {tableName ?? "record"}
          </h2>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
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
                      Required
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
                  {field.fieldType}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
            This table has no runtime fields yet. The record will be created with
            an empty payload.
          </div>
        )}

        {formError && (
          <div className="mt-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {formError}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !onSubmit}>
            {isSubmitting ? "Creating..." : "Create record"}
          </Button>
        </div>
      </form>
    </section>
  );
}
