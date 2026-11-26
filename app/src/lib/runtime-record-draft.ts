export type DraftValue = string | string[] | boolean;

export function isRecordDraftDirty(
  initialDraft: Record<string, DraftValue>,
  draft: Record<string, DraftValue>
): boolean {
  if (Object.keys(initialDraft).length !== Object.keys(draft).length) {
    return true;
  }

  return Object.entries(initialDraft).some(([code, initialValue]) => {
    const value = draft[code];
    if (Array.isArray(initialValue) && Array.isArray(value)) {
      const initialSelection = new Set(initialValue);
      const selection = new Set(value);
      return initialSelection.size !== selection.size || value.some((id) => !initialSelection.has(id));
    }
    return initialValue !== value;
  });
}
