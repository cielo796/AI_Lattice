import { describe, expect, it } from "vitest";
import {
  getGuideTourForPathname,
  getVisibleGuideSteps,
} from "@/lib/guide-registry";

describe("guide registry", () => {
  it("resolves specific approval routes before runtime table routes", () => {
    expect(getGuideTourForPathname("/run/expense-app/approvals")?.id).toBe(
      "approvals"
    );
    expect(getGuideTourForPathname("/run/expense-app/expenses")?.id).toBe(
      "runtime-table"
    );
  });

  it("resolves builder and settings routes", () => {
    expect(getGuideTourForPathname("/apps/app_1/tables")?.id).toBe(
      "builder-tables"
    );
    expect(getGuideTourForPathname("/apps/app_1/settings")?.id).toBe(
      "app-settings"
    );
  });

  it("filters state-specific home steps by visible anchors", () => {
    const tour = getGuideTourForPathname("/home");
    const emptySteps = getVisibleGuideSteps(
      tour,
      new Set(["home-create-app", "home-empty-state", "sidebar-nav"])
    );
    const populatedSteps = getVisibleGuideSteps(
      tour,
      new Set(["home-create-app", "home-stats", "home-app-card", "sidebar-nav"])
    );

    expect(emptySteps.map((step) => step.id)).toContain("home-empty");
    expect(emptySteps.map((step) => step.id)).not.toContain("home-app-card");
    expect(populatedSteps.map((step) => step.id)).toContain("home-app-card");
    expect(populatedSteps.map((step) => step.id)).not.toContain("home-empty");
  });

  it("filters runtime table steps when optional anchors are missing", () => {
    const tour = getGuideTourForPathname("/run/expense-app/expenses");
    const steps = getVisibleGuideSteps(
      tour,
      new Set(["runtime-record-create-button", "runtime-record-list"])
    );

    expect(steps.map((step) => step.id)).toEqual(["record-create"]);
  });
});
