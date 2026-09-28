import { afterEach, describe, expect, it, vi } from "vitest";
import { isDemoAutoSeedEnabled } from "@/server/demo/seed-policy";

describe("isDemoAutoSeedEnabled", () => {
  const originalValue = process.env.DEMO_AUTO_SEED;

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("does not create demo accounts by default in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.DEMO_AUTO_SEED;
    expect(isDemoAutoSeedEnabled()).toBe(false);
  });

  it("allows an explicitly enabled production demonstration", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.DEMO_AUTO_SEED = "true";
    expect(isDemoAutoSeedEnabled()).toBe(true);
  });

  it.each(["", "FALSE", "yes", "1"])("does not treat %s as explicit consent to seed", (value) => {
    process.env.DEMO_AUTO_SEED = value;
    expect(isDemoAutoSeedEnabled()).toBe(false);
  });
});
