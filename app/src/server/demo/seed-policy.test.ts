import { afterEach, describe, expect, it } from "vitest";
import { isDemoAutoSeedEnabled } from "@/server/demo/seed-policy";

describe("isDemoAutoSeedEnabled", () => {
  const originalValue = process.env.DEMO_AUTO_SEED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.DEMO_AUTO_SEED;
    } else {
      process.env.DEMO_AUTO_SEED = originalValue;
    }
  });

  it("enables demo seed by default", () => {
    delete process.env.DEMO_AUTO_SEED;

    expect(isDemoAutoSeedEnabled()).toBe(true);
  });

  it("disables demo seed only for the explicit false value", () => {
    process.env.DEMO_AUTO_SEED = "false";

    expect(isDemoAutoSeedEnabled()).toBe(false);
  });
});
