import { describe, expect, it } from "vitest";
import { getShellContentOffset } from "./shell-layout";

describe("getShellContentOffset", () => {
  it("reserves space for the rail on every desktop route", () => {
    expect(getShellContentOffset(false)).toBe(80);
  });

  it("reserves space for both columns when AppNav is shown", () => {
    expect(getShellContentOffset(true)).toBe(320);
  });
});
