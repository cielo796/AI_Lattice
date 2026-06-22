"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Icon } from "@/components/shared/Icon";
import { Input } from "@/components/shared/Input";
import { TopBar } from "@/components/shared/TopBar";
import {
  activatePromptTemplateVersion,
  createPromptTemplate,
  createPromptTemplateVersion,
  listPromptTemplates,
} from "@/lib/api/prompt-templates";
import type { PromptTemplate } from "@/types/prompt-template";
import { useToastStore } from "@/stores/toastStore";

const defaultSchema = `{
  "type": "object",
  "additionalProperties": false,
  "properties": {}
}`;

function parseSchema(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON schema は object で入力してください。");
  }

  return parsed as Record<string, unknown>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminPromptTemplatesPage() {
  const pushToast = useToastStore((store) => store.pushToast);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [key, setKey] = useState("record.summarize.default");
  const [name, setName] = useState("Record Summary");
  const [operation, setOperation] = useState("record.summarize");
  const [description, setDescription] = useState("");
  const [modelName, setModelName] = useState("gpt-5-mini");
  const [instructions, setInstructions] = useState("");
  const [schemaText, setSchemaText] = useState(defaultSchema);
  const [versionModelName, setVersionModelName] = useState("gpt-5-mini");
  const [versionInstructions, setVersionInstructions] = useState("");
  const [versionSchemaText, setVersionSchemaText] = useState(defaultSchema);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [selectedTemplateId, templates]
  );

  async function loadTemplates() {
    try {
      setIsLoading(true);
      const nextTemplates = await listPromptTemplates();

      setTemplates(nextTemplates);
      setSelectedTemplateId((current) => current || nextTemplates[0]?.id || "");
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Prompt Template の読み込みに失敗しました。"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      const template = await createPromptTemplate({
        key,
        name,
        operation,
        description,
        modelName,
        instructions,
        responseSchemaJson: parseSchema(schemaText),
        isActive: true,
      });

      setTemplates((current) => [template, ...current]);
      setSelectedTemplateId(template.id);
      pushToast({ title: "Prompt Template を作成しました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "作成に失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateVersion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTemplate) {
      return;
    }

    try {
      setIsSaving(true);
      await createPromptTemplateVersion(selectedTemplate.id, {
        modelName: versionModelName,
        instructions: versionInstructions,
        responseSchemaJson: parseSchema(versionSchemaText),
        isActive: true,
      });
      await loadTemplates();
      pushToast({ title: "新しい active version を作成しました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "version 作成に失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleActivate(templateId: string, versionId: string) {
    try {
      await activatePromptTemplateVersion(templateId, versionId);
      await loadTemplates();
      pushToast({ title: "active version を切り替えました", variant: "success" });
    } catch (nextError) {
      pushToast({
        title: "切り替えに失敗しました",
        description: nextError instanceof Error ? nextError.message : undefined,
        variant: "error",
      });
    }
  }

  return (
    <>
      <TopBar breadcrumbs={[{ label: "管理" }, { label: "Prompt Template" }]} />

      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-16 pt-24 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
              Prompt Template
            </h1>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              active version は Model Gateway で operation ごとに自動解決されます。
            </p>
          </div>
          <Button variant="ghost" onClick={() => void loadTemplates()} disabled={isLoading}>
            <Icon name="refresh" size="sm" />
            更新
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
            <table className="w-full text-left">
              <thead className="bg-surface-container text-[10.5px] font-bold uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Operation</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Versions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-xs text-on-surface-variant">
                      <Icon name="progress_activity" className="mr-1 animate-spin align-middle" size="sm" />
                      読み込み中...
                    </td>
                  </tr>
                ) : templates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-xs text-on-surface-variant">
                      Prompt Template はまだありません。
                    </td>
                  </tr>
                ) : (
                  templates.map((template) => (
                    <tr
                      key={template.id}
                      className="cursor-pointer align-top text-[12.5px] hover:bg-surface-container-low"
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-on-surface">{template.name}</div>
                        <div className="font-mono text-[11px] text-on-surface-variant">
                          {template.key}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-on-surface-variant">
                        {template.operation}
                      </td>
                      <td className="px-4 py-3">
                        {template.activeVersion ? (
                          <Badge variant="success">
                            v{template.activeVersion.version} / {template.activeVersion.modelName}
                          </Badge>
                        ) : (
                          <Badge variant="warning">なし</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {template.versionCount ?? 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <aside className="space-y-5">
            <form
              onSubmit={(event) => void handleCreate(event)}
              className="rounded-xl border border-outline-variant bg-surface p-4"
            >
              <h2 className="mb-3 font-headline text-base font-bold text-on-surface">
                新規作成
              </h2>
              <div className="space-y-3">
                <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="key" />
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="name" />
                <Input value={operation} onChange={(event) => setOperation(event.target.value)} placeholder="operation" />
                <Input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="model" />
                <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="description" />
                <textarea
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder="instructions"
                  className="min-h-28 w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <textarea
                  value={schemaText}
                  onChange={(event) => setSchemaText(event.target.value)}
                  className="min-h-32 w-full rounded-md border border-outline bg-surface px-3 py-2 font-mono text-[12px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Button type="submit" disabled={isSaving || !key || !name || !operation || !instructions}>
                  <Icon name="add" size="sm" />
                  作成
                </Button>
              </div>
            </form>
          </aside>
        </div>

        {selectedTemplate && (
          <section className="rounded-xl border border-outline-variant bg-surface">
            <div className="border-b border-outline-variant px-4 py-3">
              <div className="font-headline text-base font-bold text-on-surface">
                {selectedTemplate.name} versions
              </div>
              <div className="font-mono text-[11px] text-on-surface-variant">
                {selectedTemplate.key}
              </div>
            </div>
            <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-2">
                {selectedTemplate.versions?.map((version) => (
                  <div
                    key={version.id}
                    className="rounded-lg border border-outline-variant p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={version.isActive ? "success" : "default"}>
                          v{version.version}
                        </Badge>
                        <span className="font-mono text-xs text-on-surface-variant">
                          {version.modelName}
                        </span>
                        <span className="text-xs text-on-surface-muted">
                          {formatDate(version.createdAt)}
                        </span>
                      </div>
                      {!version.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleActivate(selectedTemplate.id, version.id)}
                        >
                          <Icon name="check_circle" size="sm" />
                          active
                        </Button>
                      )}
                    </div>
                    <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-surface-container-low p-3 text-[11px] text-on-surface-variant">
                      {version.instructions}
                    </pre>
                  </div>
                ))}
              </div>

              <form onSubmit={(event) => void handleCreateVersion(event)} className="space-y-3">
                <h3 className="font-headline text-sm font-bold text-on-surface">
                  新しい version
                </h3>
                <Input
                  value={versionModelName}
                  onChange={(event) => setVersionModelName(event.target.value)}
                  placeholder="model"
                />
                <textarea
                  value={versionInstructions}
                  onChange={(event) => setVersionInstructions(event.target.value)}
                  placeholder="instructions"
                  className="min-h-32 w-full rounded-md border border-outline bg-surface px-3 py-2 text-[13px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <textarea
                  value={versionSchemaText}
                  onChange={(event) => setVersionSchemaText(event.target.value)}
                  className="min-h-32 w-full rounded-md border border-outline bg-surface px-3 py-2 font-mono text-[12px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Button type="submit" disabled={!versionInstructions.trim() || isSaving}>
                  <Icon name="add" size="sm" />
                  追加して active
                </Button>
              </form>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

