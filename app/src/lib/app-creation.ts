import { normalizeBlueprintLayout, type FormRow } from "@/lib/blueprint-layout";
import type { GeneratedAppBlueprint, GeneratedBlueprintField, GeneratedBlueprintFieldType, GeneratedBlueprintSuggestion } from "@/types/ai";

export const FIELD_TYPES: Array<{ type: GeneratedBlueprintFieldType; label: string; description: string; icon: string; prefix: string }> = [
  { type: "text", label: "テキスト", description: "1行の文字", icon: "text_fields", prefix: "text" },
  { type: "textarea", label: "長文", description: "複数行のメモ", icon: "notes", prefix: "note" },
  { type: "number", label: "数値", description: "数量・金額", icon: "tag", prefix: "number" },
  { type: "date", label: "日付", description: "年月日", icon: "calendar_today", prefix: "date" },
  { type: "datetime", label: "日時", description: "年月日と時刻", icon: "schedule", prefix: "datetime" },
  { type: "boolean", label: "真偽値", description: "はい／いいえ", icon: "toggle_on", prefix: "flag" },
  { type: "select", label: "選択式", description: "決まった選択肢", icon: "list", prefix: "choice" },
];

export type DraftField = GeneratedBlueprintField & { id: string; codeAuto: boolean; source: "ai" | "user"; edited?: boolean; options: string[] };
export type AppDraft = {
  name: string; code: string; codeAuto: boolean; description: string; aiInsight: string;
  table: { name: string; code: string; codeAuto: boolean };
  fields: Record<string, DraftField>;
  layout: FormRow[];
  suggestions: GeneratedBlueprintSuggestion[];
};

export function orderedFields(draft: AppDraft) {
  return draft.layout.flatMap((row) => row.items.map((id) => draft.fields[id]));
}

export function draftFromBlueprint(blueprint: GeneratedAppBlueprint): AppDraft {
  const table = blueprint.tables[0];
  const fields = table.fields.map((field): DraftField => ({ ...field, id: crypto.randomUUID(), codeAuto: true, source: "ai", options: field.options ?? [] }));
  const idByCode = new Map(fields.map((field) => [field.code, field.id]));
  return {
    name: blueprint.name, code: blueprint.code, codeAuto: true, description: blueprint.description, aiInsight: blueprint.aiInsight,
    table: { name: table.name, code: table.code, codeAuto: true },
    fields: Object.fromEntries(fields.map((field) => [field.id, field])),
    layout: normalizeBlueprintLayout(blueprint.layout, table.fields.map((field) => field.code)).map((row) => ({ ...row, items: row.items.map((code) => idByCode.get(code)!) })),
    suggestions: blueprint.suggestions ?? [],
  };
}

export function blueprintFromDraft(draft: AppDraft): GeneratedAppBlueprint {
  return {
    name: draft.name, code: draft.code, description: draft.description, aiInsight: draft.aiInsight,
    tables: [{ name: draft.table.name, code: draft.table.code, fields: orderedFields(draft).map((field) => ({ name: field.name, code: field.code, fieldType: field.fieldType, required: field.required, ...(field.reason ? { reason: field.reason } : {}), ...(field.fieldType === "select" ? { options: field.options.join(",").split(",").map((option) => option.trim()).filter(Boolean) } : {}) })) }],
    layout: draft.layout.map((row) => ({ ...row, items: row.items.map((id) => draft.fields[id].code) })),
    suggestions: draft.suggestions,
  };
}

export function draftFromAdjustedBlueprint(current: AppDraft, blueprint: GeneratedAppBlueprint, changedCodes: string[]): AppDraft {
  const incoming = draftFromBlueprint(blueprint);
  const previous = new Map(orderedFields(current).map((field) => [field.code, field]));
  const stableIds = new Map<string, string>();
  const fields = Object.values(incoming.fields).map((field) => {
    const original = previous.get(field.code);
    const id = original?.id ?? field.id;
    stableIds.set(field.id, id);
    return { ...field, id, codeAuto: original?.codeAuto ?? true, source: original?.source ?? field.source, edited: original?.edited || changedCodes.includes(field.code) };
  });
  return { ...incoming, codeAuto: current.code === incoming.code ? current.codeAuto : true, table: { ...incoming.table, codeAuto: current.table.code === incoming.table.code ? current.table.codeAuto : true }, fields: Object.fromEntries(fields.map((field) => [field.id, field])), layout: incoming.layout.map((row) => ({ ...row, items: row.items.map((id) => stableIds.get(id)!) })) };
}

export function automaticCode(name: string, fallback: string, separator: "_" | "-" = "_") {
  const code = name.toLowerCase().replace(/[^a-z0-9]+/g, separator).replace(/^[_-]+|[_-]+$/g, "");
  return /^[a-z]/.test(code) ? code : fallback;
}

export function uniqueFieldCode(base: string, fields: DraftField[], exceptId?: string) {
  const existing = new Set(fields.filter((field) => field.id !== exceptId).map((field) => field.code));
  let code = base;
  let suffix = 2;
  while (existing.has(code)) code = `${base}_${suffix++}`;
  return code;
}

export function newDraftField(draft: AppDraft, type: GeneratedBlueprintFieldType, suggestion?: GeneratedBlueprintSuggestion): DraftField {
  const definition = FIELD_TYPES.find((field) => field.type === type)!;
  return {
    id: crypto.randomUUID(), name: suggestion?.name ?? `新しい${definition.label}`,
    code: uniqueFieldCode(suggestion?.code ?? `${definition.prefix}_1`, orderedFields(draft)), codeAuto: true,
    fieldType: type, required: false, options: type === "select" ? ["選択肢A", "選択肢B"] : [],
    reason: suggestion?.reason, source: suggestion ? "ai" : "user", edited: true,
  };
}

export function fieldCodeError(field: DraftField, fields: DraftField[]) {
  if (!/^[a-z][a-z0-9_]*$/.test(field.code)) return "英小文字で始め、英小文字・数字・アンダースコアで入力してください。";
  if (fields.some((candidate) => candidate.id !== field.id && candidate.code === field.code)) return "同じフィールドコードが既にあります。";
  return "";
}

export function draftCodeError(code: string) {
  return /^[a-z][a-z0-9-]*$/.test(code) ? "" : "英小文字で始め、英小文字・数字・ハイフンで入力してください。";
}

export function draftErrors(draft: AppDraft) {
  const fields = orderedFields(draft);
  return [
    ...(!draft.name.trim() || !draft.table.name.trim() || !draft.description.trim() ? ["アプリ名・テーブル名・説明を入力してください。"] : []),
    ...(draftCodeError(draft.code) || draftCodeError(draft.table.code) ? ["アプリ／テーブルコードは英小文字で始め、英小文字・数字・ハイフンで入力してください。"] : []),
    ...(fields.length < 1 || fields.length > 10 ? ["フィールドは1〜10個にしてください。"] : []),
    ...fields.flatMap((field) => [!field.name.trim() ? "表示名を入力してください。" : "", fieldCodeError(field, fields), field.fieldType === "select" && field.options.length === 0 ? "選択式には選択肢を追加してください。" : ""].filter(Boolean)),
  ];
}

export function splitChoices(value: string, existing: string[]) {
  const choices = [...existing];
  const duplicates: string[] = [];
  for (const option of value.split(/[,、，\r\n]/).map((item) => item.trim()).filter(Boolean)) {
    if (choices.includes(option)) duplicates.push(option);
    else choices.push(option);
  }
  return { choices, duplicates };
}

export function blueprintDiff(before: GeneratedAppBlueprint, after: GeneratedAppBlueprint) {
  const previous = new Map(before.tables[0].fields.map((field) => [field.code, field]));
  const next = new Map(after.tables[0].fields.map((field) => [field.code, field]));
  const changes: Array<{ kind: "追加" | "変更" | "削除"; name: string; code?: string; detail: string }> = [];
  for (const [code, field] of next) {
    const original = previous.get(code);
    if (!original) changes.push({ kind: "追加", name: field.name, code, detail: `${FIELD_TYPES.find((type) => type.type === field.fieldType)?.label}・${field.required ? "必須" : "任意"}` });
    else {
      const detail = [
        original.name !== field.name ? `表示名：${original.name} → ${field.name}` : "",
        original.fieldType !== field.fieldType ? `型：${original.fieldType} → ${field.fieldType}` : "",
        original.required !== field.required ? `必須：${original.required ? "必須" : "任意"} → ${field.required ? "必須" : "任意"}` : "",
        JSON.stringify(original.options ?? []) !== JSON.stringify(field.options ?? []) ? `選択肢：${(original.options ?? []).join("、")} → ${(field.options ?? []).join("、")}` : "",
        original.reason !== field.reason ? `AIの理由：${field.reason ?? "なし"}` : "",
      ].filter(Boolean).join("・");
      if (detail) changes.push({ kind: "変更", name: field.name, code, detail });
    }
  }
  for (const [code, field] of previous) if (!next.has(code)) changes.push({ kind: "削除", name: field.name, code, detail: "この項目を削除します" });
  if (before.name !== after.name || before.code !== after.code || before.description !== after.description || before.tables[0].name !== after.tables[0].name || before.tables[0].code !== after.tables[0].code) changes.push({ kind: "変更", name: "アプリ／テーブル", detail: `${after.name}・${after.tables[0].name}・${after.description}` });
  if (JSON.stringify(before.layout) !== JSON.stringify(after.layout)) changes.push({ kind: "変更", name: "フォームの配置", detail: "項目の順番・全幅／2列の配置を変更します" });
  if (before.aiInsight !== after.aiInsight) changes.push({ kind: "変更", name: "AIの設計説明", detail: after.aiInsight });
  if (JSON.stringify(before.suggestions ?? []) !== JSON.stringify(after.suggestions ?? [])) changes.push({ kind: "変更", name: "AIのおすすめ", detail: after.suggestions?.length ? after.suggestions.map((suggestion) => `${suggestion.name}（${FIELD_TYPES.find((type) => type.type === suggestion.fieldType)?.label}）${suggestion.reason ? `：${suggestion.reason}` : ""}`).join("・") : "追加候補はありません" });
  return changes;
}

export function preserveEditedDraft(current: AppDraft, incoming: AppDraft) {
  const result = { ...incoming, name: current.name, code: current.code, codeAuto: current.codeAuto, description: current.description, table: current.table, fields: { ...incoming.fields } };
  for (const field of orderedFields(current).filter((candidate) => candidate.edited)) {
    const match = Object.values(result.fields).find((candidate) => candidate.code === field.code);
    if (match) result.fields[match.id] = { ...field, id: match.id };
    else {
      if (Object.keys(result.fields).length >= 10) throw new Error("編集を残すと10個を超えます。項目を減らすか全体を作り直してください。");
      result.fields[field.id] = field;
    }
  }
  const idByCode = new Map(Object.values(result.fields).map((field) => [field.code, field.id]));
  result.layout = current.layout.map((row) => ({ ...row, items: row.items.map((id) => idByCode.get(current.fields[id].code)).filter((id): id is string => Boolean(id)) })).filter((row) => row.items.length > 0);
  const included = new Set(result.layout.flatMap((row) => row.items));
  for (const field of Object.values(result.fields)) if (!included.has(field.id)) result.layout.push({ cols: 1, items: [field.id] });
  return result;
}
