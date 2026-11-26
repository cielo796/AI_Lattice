import { describe, expect, it } from "vitest";
import { getAppViewLinks, moveAppSwitcherIndex } from "./app-navigation";

describe("moveAppSwitcherIndex", () => {
  it("moves through matches and wraps in both directions", () => {
    expect(moveAppSwitcherIndex(0, 3, 1)).toBe(1);
    expect(moveAppSwitcherIndex(2, 3, 1)).toBe(0);
    expect(moveAppSwitcherIndex(0, 3, -1)).toBe(2);
    expect(moveAppSwitcherIndex(0, 1, -1)).toBe(0);
    expect(moveAppSwitcherIndex(0, 0, 1)).toBe(-1);
  });
});

describe("getAppViewLinks", () => {
  const pathname = "/run/inventory/items";
  const views = [{ id: "list", name: "一覧" }, { id: "board/1", name: "ボード" }];

  it("selects the first view when viewId is omitted", () => {
    expect(getAppViewLinks(views, pathname, new URLSearchParams()).map((view) => view.active))
      .toEqual([true, false]);
  });

  it("selects the requested view and preserves the record selection in links", () => {
    const params = new URLSearchParams("viewId=board%2F1&recordId=record-1");
    expect(getAppViewLinks(views, pathname, params)[1]).toEqual({
      id: "board/1",
      name: "ボード",
      href: `${pathname}?viewId=board%2F1&recordId=record-1`,
      active: true,
    });
    expect(params.get("viewId")).toBe("board/1");
    expect(getAppViewLinks(views, pathname, new URLSearchParams("viewId=missing")).some((view) => view.active))
      .toBe(false);
  });

  it("links to the default list when the table has no saved views", () => {
    const params = new URLSearchParams("viewId=deleted");
    expect(getAppViewLinks([], pathname, params)).toEqual([
      { id: "", name: "一覧", href: pathname, active: true },
    ]);
  });
});
