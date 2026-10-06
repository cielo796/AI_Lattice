import type { GeneratedBlueprintLayoutRow } from "@/types/ai";

export type FormRow = GeneratedBlueprintLayoutRow;
export type DropTarget = {
  row: number;
  position: "before" | "after" | "left" | "right" | "slot" | "end" | "self";
  index?: number;
};
export type Rect = { left: number; right: number; top: number; bottom: number };
export type RowGeometry = { rect: Rect; cells: Array<{ rect: Rect; id?: string }> };

export function normalizeBlueprintLayout(value: unknown, codes: string[]): FormRow[] {
  const fallback = () => codes.map((code): FormRow => ({ cols: 1, items: [code] }));
  if (!Array.isArray(value) || !value.length) return fallback();
  const seen = new Set<string>();
  const rows: FormRow[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return fallback();
    const row = candidate as FormRow;
    if ((row.cols !== 1 && row.cols !== 2) || !Array.isArray(row.items) || !row.items.length || row.items.length > row.cols) return fallback();
    for (const code of row.items) {
      if (!codes.includes(code) || seen.has(code)) return fallback();
      seen.add(code);
    }
    rows.push({ cols: row.cols, items: [...row.items] });
  }
  return seen.size === codes.length ? rows : fallback();
}

export function locateField(rows: FormRow[], id: string) {
  const row = rows.findIndex((candidate) => candidate.items.includes(id));
  return row < 0 ? null : { row, index: rows[row].items.indexOf(id) };
}

export function placeField(rows: FormRow[], id: string, target: DropTarget): FormRow[] {
  if (target.position === "self") return rows;
  const destination = rows[target.row];
  if (["left", "right", "slot"].includes(target.position) && (!destination || destination.items.filter((item) => item !== id).length >= 2)) return rows;
  const next = rows.map((row) => ({ ...row, items: row.items.filter((item) => item !== id) }));
  const row = next[target.row];
  if (target.position === "end" || !row) {
    next.push({ cols: 1, items: [id] });
  } else if (target.position === "before" || target.position === "after") {
    next.splice(target.row + (target.position === "after" ? 1 : 0), 0, { cols: 1, items: [id] });
  } else {
    row.cols = 2;
    const index = target.position === "left" ? 0 : target.position === "right" ? row.items.length : Math.min(target.index ?? row.items.length, row.items.length);
    row.items.splice(index, 0, id);
  }
  return next.filter((row) => row.items.length > 0);
}

export function setFieldColumns(rows: FormRow[], id: string, cols: 1 | 2): FormRow[] {
  const location = locateField(rows, id);
  if (!location) return rows;
  const next = rows.map((row) => ({ ...row, items: [...row.items] }));
  const row = next[location.row];
  if (cols === 1 && row.items.length === 2) {
    row.items.splice(location.index, 1);
    row.cols = 1;
    next.splice(location.row + (location.index === 0 ? 0 : 1), 0, { cols: 1, items: [id] });
  } else row.cols = cols;
  return next;
}

export function moveFieldByKeyboard(rows: FormRow[], id: string, key: string): FormRow[] {
  const location = locateField(rows, id);
  if (!location) return rows;
  const row = rows[location.row];
  if (key === "ArrowUp" || key === "ArrowDown") {
    const direction = key === "ArrowUp" ? -1 : 1;
    const target = row.cols === 2 ? location.row : location.row + direction;
    if (target < 0 || target >= rows.length) return rows;
    return placeField(rows, id, { row: target, position: direction < 0 ? "before" : "after" });
  }
  if (row.cols === 2 && row.items.length === 2 && (key === "ArrowLeft" || key === "ArrowRight")) {
    return rows.map((candidate, index) => index === location.row ? { ...candidate, items: [...candidate.items].reverse() } : candidate);
  }
  if (key === "ArrowRight") {
    const following = rows[location.row + 1];
    return following?.items.length === 1
      ? placeField(rows, id, { row: location.row + 1, position: "left" })
      : setFieldColumns(rows, id, 2);
  }
  return rows;
}

export function hitTestDrop(rows: FormRow[], geometry: RowGeometry[], bounds: Rect, x: number, y: number, dragId?: string): DropTarget | null {
  if (x < bounds.left - 24 || x > bounds.right + 24 || y < bounds.top - 24 || y > bounds.bottom + 24) return null;
  for (const [index, measured] of geometry.entries()) {
    const row = rows[index];
    if (!row) continue;
    if (y < measured.rect.top - 4) return { row: index, position: "before" };
    if (y > measured.rect.bottom + 4) continue;
    for (const cell of measured.cells) {
      if (x < cell.rect.left || x > cell.rect.right || y < cell.rect.top - 4 || y > cell.rect.bottom + 4) continue;
      if (!cell.id) return { row: index, position: "slot", index: row.items.length };
      if (cell.id === dragId) return { row: index, position: row.cols === 2 ? "slot" : "self", index: row.items.indexOf(cell.id) };
      const otherCount = row.items.filter((id) => id !== dragId).length;
      if (otherCount === 1 && (row.items.length === 1 || row.items.includes(dragId ?? ""))) {
        const side = (cell.rect.right - cell.rect.left) * 0.24;
        if (x < cell.rect.left + side) return { row: index, position: "left" };
        if (x > cell.rect.right - side) return { row: index, position: "right" };
      }
      return { row: index, position: y < (cell.rect.top + cell.rect.bottom) / 2 ? "before" : "after" };
    }
    return { row: index, position: y < (measured.rect.top + measured.rect.bottom) / 2 ? "before" : "after" };
  }
  return { row: rows.length, position: "end" };
}

export function toBlueprintFormLayout(rows: FormRow[], fields: Array<{ code: string; required: boolean }>) {
  const byCode = new Map(fields.map((field) => [field.code, field]));
  return {
    fields: rows.flatMap((row, rowIndex) => row.items.map((fieldCode) => ({
      fieldCode,
      visible: true,
      required: byCode.get(fieldCode)?.required ?? false,
      // Existing form definitions use "full" and "half", not pixels or percentages; rowIndex preserves empty half-width slots.
      width: row.cols === 1 ? "full" : "half",
      rowIndex,
    }))),
  };
}
