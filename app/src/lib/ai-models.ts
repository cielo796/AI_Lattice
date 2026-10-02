export const DEFAULT_AI_MODEL = "gpt-6-luna";
export const AI_MODEL_CATALOG_VERIFIED_AT = "2026-10-02";
export const AI_MODEL_DOCUMENTATION_URL = "https://developers.openai.com/api/docs/models";

export const AI_MODEL_OPTIONS = [
  { id: "gpt-6-luna", label: "GPT-6 Luna — 高速・低コスト", description: "大量の要約・分類・返信案などの定型処理向け。" },
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol — バランス", description: "複雑なアプリ設計や推論で品質とコストを両立。" },
  { id: "gpt-6-astra", label: "GPT-6 Astra — 高品質", description: "特に難しい推論・設計を優先。料金と応答時間に注意。" },
  { id: "gpt-5-mini", label: "GPT-5 Mini — 旧モデル・互換用", description: "既存の設定を継続する場合の互換選択肢。" },
] as const;

export function isKnownAIModel(value: unknown): value is string {
  return typeof value === "string" && AI_MODEL_OPTIONS.some((model) => model.id === value);
}
