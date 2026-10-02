import { describe, expect, it } from "vitest";
import { AI_MODEL_OPTIONS, DEFAULT_AI_MODEL, isKnownAIModel } from "@/lib/ai-models";

describe("AI model catalog", () => {
  it("defaults to the efficient current generation with balanced and flagship alternatives", () => {
    expect(DEFAULT_AI_MODEL).toBe("gpt-6-luna");
    expect(AI_MODEL_OPTIONS.map((model) => model.id)).toEqual(["gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra", "gpt-5-mini"]);
    expect(isKnownAIModel(DEFAULT_AI_MODEL)).toBe(true);
  });
  it.each([null, undefined, "", 42, {}, "gpt-invalid", " gpt-6-luna"])("rejects invalid selection %s", (value) => {
    expect(isKnownAIModel(value)).toBe(false);
  });
});
