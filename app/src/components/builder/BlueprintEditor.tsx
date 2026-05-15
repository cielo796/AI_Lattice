"use client";

import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { Input } from "@/components/shared/Input";
import { cn } from "@/lib/cn";
import type {
  GeneratedAppBlueprint,
  GeneratedBlueprintFieldType,
} from "@/types/ai";

export type DraftBlueprintField = {
  id: string;
  name: string;
  code: string;
  fieldType: GeneratedBlueprintFieldType;
  required: boolean;
  options: string[];
};

export type DraftBlueprintTable = {
  id: string;
  name: string;
  code: string;
  fields: DraftBlueprintField[];
};

export type DraftAppBlueprint = Omit<GeneratedAppBlueprint, "tables"> & {
  tables: DraftBlueprintTable[];
};

interface BlueprintEditorProps {
  blueprint: DraftAppBlueprint;
  activeTableId: string;
  isSaving?: boolean;
  onActiveTableChange: (tableId: string) => void;
  onAppChange: (
    patch: Partial<Pick<DraftAppBlueprint, "name" | "code" | "description">>
  ) => void;
  onAddTable: () => void;
  onDeleteTable: (tableId: string) => void;
  onUpdateTable: (
    tableId: string,
    patch: Partial<Pick<DraftBlueprintTable, "name" | "code">>
  ) => void;
  onAddField: (tableId: string) => void;
  onDeleteField: (tableId: string, fieldId: string) => void;
  onUpdateField: (
    tableId: string,
    fieldId: string,
    patch: Partial<
      Pick<DraftBlueprintField, "name" | "code" | "fieldType" | "required" | "options">
    >
  ) => void;
  onSave: () => void;
}

const FIELD_TYPE_OPTIONS: GeneratedBlueprintFieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
];

const FIELD_TYPE_LABELS: Record<GeneratedBlueprintFieldType, string> = {
  text: "テキスト",
  textarea: "長文テキスト",
  number: "数値",
  date: "日付",
  datetime: "日時",
  boolean: "真偽値",
  select: "選択式",
};

export function BlueprintEditor({
  blueprint,
  activeTableId,
  isSaving = false,
  onActiveTableChange,
  onAppChange,
  onAddTable,
  onDeleteTable,
  onUpdateTable,
  onAddField,
  onDeleteField,
  onUpdateField,
  onSave,
}: BlueprintEditorProps) {
  const activeTable =
    blueprint.tables.find((table) => table.id === activeTableId) ?? blueprint.tables[0];
  const canAddTable = blueprint.tables.length < 3;
  const canAddField = activeTable && activeTable.fields.length < 10;

  return (
    <div className="w-full space-y-6">
      <section className="rounded-xl border border-outline-variant bg-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
              アプリ設計案
            </div>
            <h3 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
              作成前に確認
            </h3>
          </div>
          <Badge variant="ai">編集可能な下書き</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              アプリ名
            </label>
            <Input
              value={blueprint.name}
              onChange={(event) => onAppChange({ name: event.target.value })}
              placeholder="サポートデスク"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              アプリコード
            </label>
            <Input
              value={blueprint.code}
              onChange={(event) => onAppChange({ code: event.target.value })}
              placeholder="support-desk"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
              説明
            </label>
            <textarea
              rows={3}
              value={blueprint.description}
              onChange={(event) => onAppChange({ description: event.target.value })}
              className="w-full resize-y rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface placeholder:text-on-surface-muted hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="このアプリの用途を入力してください。"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-outline-variant bg-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
              テーブル
            </div>
            <div className="text-sm text-on-surface-variant">
              最大 3 テーブル、各 10 フィールドまで作成できます。
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onAddTable}
            disabled={!canAddTable}
          >
            <Icon name="add" size="sm" />
            テーブルを追加
          </Button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {blueprint.tables.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => onActiveTableChange(table.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
                table.id === activeTableId
                  ? "bg-primary-container text-on-primary-container"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
              )}
            >
              {table.name}
            </button>
          ))}
        </div>

        {activeTable ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                  テーブル名
                </label>
                <Input
                  value={activeTable.name}
                  onChange={(event) =>
                    onUpdateTable(activeTable.id, { name: event.target.value })
                  }
                  placeholder="問い合わせ"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                  テーブルコード
                </label>
                <Input
                  value={activeTable.code}
                  onChange={(event) =>
                    onUpdateTable(activeTable.id, { code: event.target.value })
                  }
                  placeholder="tickets"
                />
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => onDeleteTable(activeTable.id)}
                disabled={blueprint.tables.length <= 1}
              >
                <Icon name="delete" size="sm" />
                テーブルを削除
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted">
                フィールド / {activeTable.fields.length}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onAddField(activeTable.id)}
                disabled={!canAddField}
              >
                <Icon name="add" size="sm" />
                フィールドを追加
              </Button>
            </div>

            <div className="space-y-4">
              {activeTable.fields.map((field) => (
                <div key={field.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
                  <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_170px]">
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                        フィールド名
                      </label>
                      <Input
                        value={field.name}
                        onChange={(event) =>
                          onUpdateField(activeTable.id, field.id, {
                            name: event.target.value,
                          })
                        }
                        placeholder="件名"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                        フィールドコード
                      </label>
                      <Input
                        value={field.code}
                        onChange={(event) =>
                          onUpdateField(activeTable.id, field.id, {
                            code: event.target.value,
                          })
                        }
                        placeholder="subject"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                        種類
                      </label>
                      <select
                        value={field.fieldType}
                        onChange={(event) =>
                          onUpdateField(activeTable.id, field.id, {
                            fieldType: event.target.value as GeneratedBlueprintFieldType,
                          })
                        }
                        className="w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13.5px] text-on-surface hover:border-outline-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {FIELD_TYPE_OPTIONS.map((fieldType) => (
                          <option key={fieldType} value={fieldType}>
                            {FIELD_TYPE_LABELS[fieldType]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2.5 rounded-md border border-outline-variant bg-surface px-3 py-1.5 text-[13px] font-medium text-on-surface">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) =>
                          onUpdateField(activeTable.id, field.id, {
                            required: event.target.checked,
                          })
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      必須
                    </label>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteField(activeTable.id, field.id)}
                    >
                      <Icon name="delete" size="sm" />
                      フィールドを削除
                    </Button>
                  </div>

                  {field.fieldType === "select" && (
                    <div className="mt-4 space-y-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-muted">
                        選択肢
                      </label>
                      <Input
                        value={field.options.join(", ")}
                        onChange={(event) =>
                          onUpdateField(activeTable.id, field.id, {
                            options: event.target.value
                              .split(",")
                              .map((option) => option.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="未対応, 対応中, 完了"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">
            続行するにはテーブルを追加してください。
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button type="button" size="lg" onClick={onSave} disabled={isSaving}>
          {isSaving ? "アプリを作成中..." : "アプリを作成"}
          <Icon name="rocket_launch" size="sm" />
        </Button>
      </div>
    </div>
  );
}
