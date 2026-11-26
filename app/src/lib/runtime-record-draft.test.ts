import { describe, expect, it } from "vitest";
import { isRecordDraftDirty } from "@/lib/runtime-record-draft";

describe("isRecordDraftDirty", () => {
  const initialDraft = { subject: "Existing request", enabled: false, contacts: ["b", "a"] };

  it("is clean when every field has its initial value", () => {
    expect(isRecordDraftDirty(initialDraft, initialDraft)).toBe(false);
    expect(isRecordDraftDirty(initialDraft, { ...initialDraft, contacts: ["a", "b"] })).toBe(false);
    expect(isRecordDraftDirty({ contacts: [] }, { contacts: [] })).toBe(false);
  });

  it("detects changes to text, toggles, and selected references", () => {
    expect(isRecordDraftDirty(initialDraft, { ...initialDraft, subject: "" })).toBe(true);
    expect(isRecordDraftDirty(initialDraft, { ...initialDraft, enabled: true })).toBe(true);
    expect(isRecordDraftDirty(initialDraft, { ...initialDraft, contacts: ["b", "c"] })).toBe(true);
    expect(isRecordDraftDirty(initialDraft, { ...initialDraft, contacts: [] })).toBe(true);
    expect(isRecordDraftDirty({ contacts: [] }, { contacts: ["a"] })).toBe(true);
  });

  it("detects added and removed fields", () => {
    expect(isRecordDraftDirty({}, { subject: "" })).toBe(true);
    expect(isRecordDraftDirty({ subject: "" }, {})).toBe(true);
    expect(isRecordDraftDirty({ subject: "" }, { name: "" })).toBe(true);
  });
});
