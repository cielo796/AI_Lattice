import { describe, expect, it } from "vitest";
import {
  getNextRowIndex,
  isRowNavigationKey,
} from "@/lib/runtime-keyboard";

describe("isRowNavigationKey", () => {
  it.each(["ArrowUp", "ArrowDown", "Home", "End"] as const)(
    "accepts %s",
    (key) => {
      expect(isRowNavigationKey(key)).toBe(true);
    }
  );

  it.each(["Enter", "Escape", "arrowdown", "PageDown", ""])(
    "rejects %s",
    (key) => {
      expect(isRowNavigationKey(key)).toBe(false);
    }
  );
});

describe("getNextRowIndex", () => {
  it("returns null when there are no rows", () => {
    expect(getNextRowIndex("ArrowDown", -1, 0)).toBeNull();
    expect(getNextRowIndex("ArrowUp", 0, 0)).toBeNull();
    expect(getNextRowIndex("Home", -1, 0)).toBeNull();
    expect(getNextRowIndex("End", -1, 0)).toBeNull();
    expect(getNextRowIndex("ArrowDown", -1, -3)).toBeNull();
  });

  it("moves down from nothing selected and stops at the last row", () => {
    expect(getNextRowIndex("ArrowDown", -1, 5)).toBe(0);
    expect(getNextRowIndex("ArrowDown", 0, 5)).toBe(1);
    expect(getNextRowIndex("ArrowDown", 3, 5)).toBe(4);
    expect(getNextRowIndex("ArrowDown", 4, 5)).toBe(4);
  });

  it("moves up from nothing selected and stops at the first row", () => {
    expect(getNextRowIndex("ArrowUp", -1, 5)).toBe(4);
    expect(getNextRowIndex("ArrowUp", 4, 5)).toBe(3);
    expect(getNextRowIndex("ArrowUp", 1, 5)).toBe(0);
    expect(getNextRowIndex("ArrowUp", 0, 5)).toBe(0);
  });

  it("jumps to the first and last row", () => {
    expect(getNextRowIndex("Home", -1, 5)).toBe(0);
    expect(getNextRowIndex("Home", 3, 5)).toBe(0);
    expect(getNextRowIndex("End", -1, 5)).toBe(4);
    expect(getNextRowIndex("End", 2, 5)).toBe(4);
  });

  it("handles a single row", () => {
    expect(getNextRowIndex("ArrowDown", -1, 1)).toBe(0);
    expect(getNextRowIndex("ArrowDown", 0, 1)).toBe(0);
    expect(getNextRowIndex("ArrowUp", -1, 1)).toBe(0);
    expect(getNextRowIndex("ArrowUp", 0, 1)).toBe(0);
    expect(getNextRowIndex("Home", 0, 1)).toBe(0);
    expect(getNextRowIndex("End", 0, 1)).toBe(0);
  });

  it("treats a stale index as the last row before moving", () => {
    expect(getNextRowIndex("ArrowDown", 9, 3)).toBe(2);
    expect(getNextRowIndex("ArrowUp", 9, 3)).toBe(1);
    expect(getNextRowIndex("Home", 9, 3)).toBe(0);
    expect(getNextRowIndex("End", 9, 3)).toBe(2);
  });
});
