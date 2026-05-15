"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BlueprintEditor,
  type DraftAppBlueprint,
  type DraftBlueprintField,
  type DraftBlueprintTable,
} from "@/components/builder/BlueprintEditor";
import { GeneratedAssetsList } from "@/components/builder/GeneratedAssetsList";
import { PromptInput } from "@/components/builder/PromptInput";
import { Icon } from "@/components/shared/Icon";
import { Button } from "@/components/shared/Button";
import { createAppFromBlueprint, generateAppBlueprint } from "@/lib/api/apps";
import type {
  GeneratedAppBlueprint,
  GeneratedBlueprintField,
  GeneratedBlueprintFieldType,
} from "@/types/ai";
import { TopBar } from "@/components/shared/TopBar";

const examples = [
  "顧客問い合わせの一次対応と SLA 管理を行うサポートデスク",
  "マネージャーと経理向けの経費承認アプリ",
  "社内向けの備品・在庫リクエスト受付アプリ",
];

function createLocalId() {
  return crypto.randomUUID();
}

function withDraftIds(blueprint: GeneratedAppBlueprint): DraftAppBlueprint {
  return {
    ...blueprint,
    tables: blueprint.tables.map((table) => ({
      ...table,
      id: createLocalId(),
      fields: table.fields.map((field) => ({
        id: createLocalId(),
        name: field.name,
        code: field.code,
        fieldType: field.fieldType,
        required: field.required,
        options: field.options ?? [],
      })),
    })),
  };
}

function toGeneratedField(field: DraftBlueprintField): GeneratedBlueprintField {
  return {
    name: field.name,
    code: field.code,
    fieldType: field.fieldType,
    required: field.required,
    ...(field.fieldType === "select" ? { options: field.options } : {}),
  };
}

function toGeneratedBlueprint(blueprint: DraftAppBlueprint): GeneratedAppBlueprint {
  return {
    name: blueprint.name,
    code: blueprint.code,
    description: blueprint.description,
    aiInsight: blueprint.aiInsight,
    tables: blueprint.tables.map((table) => ({
      name: table.name,
      code: table.code,
      fields: table.fields.map(toGeneratedField),
    })),
  };
}

function nextTableName(tables: DraftBlueprintTable[]) {
  return `テーブル ${tables.length + 1}`;
}

function nextTableCode(tables: DraftBlueprintTable[]) {
  return `table-${tables.length + 1}`;
}

function nextFieldName(fields: DraftBlueprintField[]) {
  return `field_${fields.length + 1}`;
}

function nextFieldCode(fields: DraftBlueprintField[]) {
  return `field_${fields.length + 1}`;
}

function createDraftField(
  fields: DraftBlueprintField[],
  fieldType: GeneratedBlueprintFieldType = "text"
): DraftBlueprintField {
  return {
    id: createLocalId(),
    name: nextFieldName(fields),
    code: nextFieldCode(fields),
    fieldType,
    required: false,
    options: fieldType === "select" ? ["選択肢 1", "選択肢 2"] : [],
  };
}

function createDraftTable(tables: DraftBlueprintTable[]): DraftBlueprintTable {
  return {
    id: createLocalId(),
    name: nextTableName(tables),
    code: nextTableCode(tables),
    fields: [createDraftField([], "text")],
  };
}

export default function NewAIAppPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [blueprint, setBlueprint] = useState<DraftAppBlueprint | null>(null);
  const [activeTableId, setActiveTableId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(nextPrompt = prompt) {
    if (!nextPrompt.trim()) {
      setError("アプリの概要を入力してください。");
      return;
    }

    try {
      setIsGenerating(true);
      const generatedBlueprint = await generateAppBlueprint(nextPrompt);
      const draft = withDraftIds(generatedBlueprint);
      setBlueprint(draft);
      setActiveTableId(draft.tables[0]?.id ?? "");
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "アプリ設計案の生成に失敗しました。"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!blueprint) {
      return;
    }

    try {
      setIsSaving(true);
      const createdApp = await createAppFromBlueprint(toGeneratedBlueprint(blueprint));
      setError(null);
      router.push(`/apps/${createdApp.id}/tables?created=1`);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "アプリの作成に失敗しました。"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <TopBar
        title="新規アプリ"
        breadcrumbs={[{ label: "AI ビルダー" }, { label: "新規アプリ" }]}
      />

      <main className="pt-14 pb-16">
        <section className="mx-auto max-w-5xl px-6 pb-10 pt-16">
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-tertiary-container px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-on-tertiary-container">
              <Icon name="auto_awesome" size="sm" filled />
              AI Builder
            </div>
            <h2 className="mb-3 font-headline text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
              作成したい社内アプリを説明してください
            </h2>
            <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">
              AI がアプリ、テーブル、フィールドの設計案を作成します。
              内容を確認・編集してからビルダーに保存できます。
            </p>
          </div>

          <div className="space-y-4">
            <PromptInput
              value={prompt}
              onChange={(value) => {
                setPrompt(value);
                setError(null);
              }}
              onSubmit={() => void handleGenerate()}
              examples={examples}
              onExampleClick={(example) => {
                setPrompt(example);
                setError(null);
                void handleGenerate(example);
              }}
            />

            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
              >
                <Icon name="auto_awesome" size="sm" filled />
                {isGenerating ? "生成中..." : "設計案を生成"}
              </Button>
            </div>
          </div>
        </section>

        {error && (
          <section className="mx-auto max-w-5xl px-6 pb-6">
            <div className="rounded-lg border border-error-container bg-error-container/40 px-4 py-3 text-sm font-medium text-on-error-container">
              {error}
            </div>
          </section>
        )}

        {!blueprint && !isGenerating && (
          <section className="px-8 pt-6 text-center text-sm text-on-surface-variant">
            プロンプトを入力すると、編集可能なアプリ設計案を生成できます。
          </section>
        )}

        {isGenerating && (
          <section className="mx-auto max-w-5xl px-6">
            <div className="rounded-2xl border border-tertiary-container bg-tertiary-container/30 p-10 text-center">
              <div className="mb-3 flex justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tertiary text-white shadow-[0_4px_12px_rgba(141,108,220,0.4)]">
                  <Icon name="auto_awesome" size="lg" filled />
                </span>
              </div>
              <div className="font-headline text-lg font-bold tracking-tight text-on-surface">
                アプリ設計案を生成しています...
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">
                アプリ、テーブル、フィールド構成の初期案を作成しています。
              </p>
            </div>
          </section>
        )}

        {blueprint && (
          <section className="px-6 md:px-8">
            <div className="flex min-h-[700px] flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface md:flex-row">
              <aside className="w-full border-b border-outline-variant bg-sidebar p-6 md:w-80 md:border-b-0 md:border-r">
                <GeneratedAssetsList
                  aiInsight={blueprint.aiInsight}
                  tables={blueprint.tables.map((table) => ({
                    id: table.id,
                    name: table.name,
                    fieldCount: table.fields.length,
                  }))}
                  activeTableId={activeTableId}
                  onSelectTable={setActiveTableId}
                />
              </aside>

              <div className="flex-1 bg-surface p-6 md:p-8">
                <BlueprintEditor
                  blueprint={blueprint}
                  activeTableId={activeTableId}
                  isSaving={isSaving}
                  onActiveTableChange={setActiveTableId}
                  onAppChange={(patch) =>
                    setBlueprint((current) =>
                      current ? { ...current, ...patch } : current
                    )
                  }
                  onAddTable={() =>
                    setBlueprint((current) => {
                      if (!current || current.tables.length >= 3) {
                        return current;
                      }

                      const nextTable = createDraftTable(current.tables);

                      setActiveTableId(nextTable.id);

                      return {
                        ...current,
                        tables: [...current.tables, nextTable],
                      };
                    })
                  }
                  onDeleteTable={(tableId) =>
                    setBlueprint((current) => {
                      if (!current || current.tables.length <= 1) {
                        return current;
                      }

                      const nextTables = current.tables.filter(
                        (table) => table.id !== tableId
                      );

                      if (activeTableId === tableId) {
                        setActiveTableId(nextTables[0]?.id ?? "");
                      }

                      return {
                        ...current,
                        tables: nextTables,
                      };
                    })
                  }
                  onUpdateTable={(tableId, patch) =>
                    setBlueprint((current) =>
                      current
                        ? {
                            ...current,
                            tables: current.tables.map((table) =>
                              table.id === tableId ? { ...table, ...patch } : table
                            ),
                          }
                        : current
                    )
                  }
                  onAddField={(tableId) =>
                    setBlueprint((current) => {
                      if (!current) {
                        return current;
                      }

                      return {
                        ...current,
                        tables: current.tables.map((table) =>
                          table.id === tableId && table.fields.length < 10
                            ? {
                                ...table,
                                fields: [...table.fields, createDraftField(table.fields)],
                              }
                            : table
                        ),
                      };
                    })
                  }
                  onDeleteField={(tableId, fieldId) =>
                    setBlueprint((current) => {
                      if (!current) {
                        return current;
                      }

                      return {
                        ...current,
                        tables: current.tables.map((table) => {
                          if (table.id !== tableId || table.fields.length <= 1) {
                            return table;
                          }

                          return {
                            ...table,
                            fields: table.fields.filter((field) => field.id !== fieldId),
                          };
                        }),
                      };
                    })
                  }
                  onUpdateField={(tableId, fieldId, patch) =>
                    setBlueprint((current) => {
                      if (!current) {
                        return current;
                      }

                      return {
                        ...current,
                        tables: current.tables.map((table) => {
                          if (table.id !== tableId) {
                            return table;
                          }

                          return {
                            ...table,
                            fields: table.fields.map((field) => {
                              if (field.id !== fieldId) {
                                return field;
                              }

                              const nextField = { ...field, ...patch };

                              if (patch.fieldType && patch.fieldType !== "select") {
                                nextField.options = [];
                              }

                              if (
                                patch.fieldType === "select" &&
                                nextField.options.length === 0
                              ) {
                                nextField.options = ["選択肢 1", "選択肢 2"];
                              }

                              return nextField;
                            }),
                          };
                        }),
                      };
                    })
                  }
                  onSave={() => void handleSave()}
                />
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
