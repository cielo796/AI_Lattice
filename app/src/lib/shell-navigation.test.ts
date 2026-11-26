import { describe, expect, it } from "vitest";
import {
  ADMIN_RAIL_ITEM,
  ADMIN_TABS,
  RAIL_ITEMS,
  canSeeAdmin,
  canSeeAppDesign,
  getAppDesignItems,
  getAppSectionItems,
  getVisibleAdminTabs,
  isAdminTabPath,
  isNavItemActive,
  parseAppRoute,
  type PermissionMap,
} from "@/lib/shell-navigation";

const allAdminPermissions: PermissionMap = Object.fromEntries(
  ADMIN_TABS.map((tab) => [tab.permission, true])
);

function railItem(key: string) {
  const item = RAIL_ITEMS.find((entry) => entry.key === key);

  if (!item) {
    throw new Error(`missing rail item: ${key}`);
  }

  return item;
}

describe("shell navigation definitions", () => {
  it("orders the global rail items", () => {
    expect(RAIL_ITEMS.map((item) => item.key)).toEqual([
      "home",
      "apps",
      "approvals",
      "notifications",
    ]);
    expect(RAIL_ITEMS.map((item) => item.href)).toEqual([
      "/home",
      "/home#my-apps",
      "/admin/approvals",
      "/notifications",
    ]);
    expect(railItem("home")).toMatchObject({
      label: "ホーム",
      icon: "home",
    });
    expect(railItem("apps")).toMatchObject({
      label: "アプリ",
      icon: "apps",
    });
    expect(railItem("approvals")).toMatchObject({
      label: "承認",
      icon: "approval",
    });
    expect(railItem("notifications")).toMatchObject({
      label: "通知",
      icon: "notifications",
    });
  });

  it("defines the admin rail item", () => {
    expect(ADMIN_RAIL_ITEM).toEqual({
      key: "admin",
      label: "管理",
      href: "/admin",
      icon: "admin_panel_settings",
    });
  });

  it("defines the admin tabs in order with their permissions", () => {
    expect(
      ADMIN_TABS.map((tab) => [tab.key, tab.href, tab.icon, tab.permission])
    ).toEqual([
      ["users", "/admin/users", "group", "admin:users"],
      ["roles", "/admin/roles", "admin_panel_settings", "admin:roles"],
      ["tenant", "/admin/tenant", "domain", "admin:tenant"],
      ["openai", "/admin/openai", "key", "admin:openai"],
      [
        "prompt-templates",
        "/admin/prompt-templates",
        "text_snippet",
        "admin:prompt_templates",
      ],
      ["ai-logs", "/admin/ai-logs", "auto_awesome", "admin:ai_logs"],
      [
        "audit-logs",
        "/admin/audit-logs",
        "fact_check",
        "admin:audit_logs",
      ],
    ]);
  });
});

describe("getVisibleAdminTabs", () => {
  it("returns every tab when all permissions are granted", () => {
    expect(getVisibleAdminTabs(allAdminPermissions)).toEqual(ADMIN_TABS);
  });

  it("only returns tabs whose permission is exactly true", () => {
    const permissions: PermissionMap = {
      "admin:users": true,
      "admin:roles": false,
      "admin:tenant": true,
    };

    expect(getVisibleAdminTabs(permissions).map((tab) => tab.key)).toEqual([
      "users",
      "tenant",
    ]);
  });

  it("returns nothing without permissions", () => {
    expect(getVisibleAdminTabs(null)).toEqual([]);
    expect(getVisibleAdminTabs(undefined)).toEqual([]);
    expect(getVisibleAdminTabs({})).toEqual([]);
    expect(getVisibleAdminTabs({ "app:write": true })).toEqual([]);
  });
});

describe("canSeeAdmin", () => {
  it("is true when any admin permission is true", () => {
    expect(canSeeAdmin({ "admin:users": true })).toBe(true);
    expect(
      canSeeAdmin({ "admin:users": false, "admin:audit_logs": true })
    ).toBe(true);
    expect(canSeeAdmin(allAdminPermissions)).toBe(true);
  });

  it("is false without a true admin permission", () => {
    expect(canSeeAdmin(null)).toBe(false);
    expect(canSeeAdmin(undefined)).toBe(false);
    expect(canSeeAdmin({})).toBe(false);
    expect(canSeeAdmin({ "admin:users": false })).toBe(false);
    expect(canSeeAdmin({ "app:write": true })).toBe(false);
    expect(canSeeAdmin({ administrator: true })).toBe(false);
  });
});

describe("isAdminTabPath", () => {
  it("accepts /admin and admin tab paths", () => {
    expect(isAdminTabPath("/admin")).toBe(true);
    expect(isAdminTabPath("/admin/users")).toBe(true);
    expect(isAdminTabPath("/admin/users/123")).toBe(true);
    expect(isAdminTabPath("/admin/roles")).toBe(true);
    expect(isAdminTabPath("/admin/tenant")).toBe(true);
    expect(isAdminTabPath("/admin/openai")).toBe(true);
    expect(isAdminTabPath("/admin/prompt-templates")).toBe(true);
    expect(isAdminTabPath("/admin/ai-logs")).toBe(true);
    expect(isAdminTabPath("/admin/audit-logs")).toBe(true);
    expect(isAdminTabPath("/admin/users?tab=1")).toBe(true);
  });

  it("rejects the approvals inbox and unrelated paths", () => {
    expect(isAdminTabPath("/admin/approvals")).toBe(false);
    expect(isAdminTabPath("/admin/approvals/123")).toBe(false);
    expect(isAdminTabPath("/home")).toBe(false);
    expect(isAdminTabPath("/administer")).toBe(false);
    expect(isAdminTabPath("/notifications")).toBe(false);
    expect(isAdminTabPath(null)).toBe(false);
    expect(isAdminTabPath(undefined)).toBe(false);
    expect(isAdminTabPath("")).toBe(false);
  });
});

describe("getAppSectionItems", () => {
  it("builds the app section links", () => {
    expect(getAppSectionItems({ code: "sales" })).toEqual([
      {
        key: "app-top",
        label: "アプリトップ",
        href: "/run/sales",
        icon: "home_app_logo",
      },
      {
        key: "dashboard",
        label: "ダッシュボード",
        href: "/run/sales/dashboard",
        icon: "dashboard",
      },
      {
        key: "app-approvals",
        label: "アプリ承認",
        href: "/run/sales/approvals",
        icon: "approval",
      },
    ]);
  });

  it("encodes the app code", () => {
    const code = "営業 アプリ/2026";
    const encoded = encodeURIComponent(code);
    const items = getAppSectionItems({ code });

    expect(items.map((item) => item.href)).toEqual([
      `/run/${encoded}`,
      `/run/${encoded}/dashboard`,
      `/run/${encoded}/approvals`,
    ]);
  });
});

describe("getAppDesignItems", () => {
  it("builds the app design links", () => {
    expect(getAppDesignItems({ id: "app-1" })).toEqual([
      {
        key: "tables",
        label: "テーブル",
        href: "/apps/app-1/tables",
        icon: "table_chart",
      },
      {
        key: "workflows",
        label: "ワークフロー",
        href: "/apps/app-1/workflows",
        icon: "account_tree",
      },
      {
        key: "permissions",
        label: "権限設計",
        href: "/apps/app-1/permissions",
        icon: "shield_person",
      },
      {
        key: "settings",
        label: "アプリ設定",
        href: "/apps/app-1/settings",
        icon: "settings",
      },
    ]);
  });

  it("encodes the app id", () => {
    const id = "アプリ 1/2";
    const encoded = encodeURIComponent(id);
    const items = getAppDesignItems({ id });

    expect(items.map((item) => item.href)).toEqual([
      `/apps/${encoded}/tables`,
      `/apps/${encoded}/workflows`,
      `/apps/${encoded}/permissions`,
      `/apps/${encoded}/settings`,
    ]);
  });
});

describe("canSeeAppDesign", () => {
  it("requires app:write to be exactly true", () => {
    expect(canSeeAppDesign({ "app:write": true })).toBe(true);
    expect(canSeeAppDesign({ "app:write": false })).toBe(false);
    expect(canSeeAppDesign({ "app:read": true })).toBe(false);
    expect(canSeeAppDesign({})).toBe(false);
    expect(canSeeAppDesign(null)).toBe(false);
    expect(canSeeAppDesign(undefined)).toBe(false);
  });
});

describe("parseAppRoute", () => {
  it("parses builder routes", () => {
    expect(parseAppRoute("/apps/app-1/tables")).toEqual({
      kind: "builder",
      appId: "app-1",
    });
    expect(parseAppRoute("/apps/app-1")).toEqual({
      kind: "builder",
      appId: "app-1",
    });
    expect(parseAppRoute("/apps/app-1/workflows/123?step=2")).toEqual({
      kind: "builder",
      appId: "app-1",
    });
  });

  it("rejects the new app route and unrelated paths", () => {
    expect(parseAppRoute("/apps/new/ai")).toBeNull();
    expect(parseAppRoute("/apps/new")).toBeNull();
    expect(parseAppRoute("/apps")).toBeNull();
    expect(parseAppRoute("/home")).toBeNull();
    expect(parseAppRoute("/run")).toBeNull();
    expect(parseAppRoute("/admin/users")).toBeNull();
    expect(parseAppRoute(null)).toBeNull();
    expect(parseAppRoute(undefined)).toBeNull();
    expect(parseAppRoute("")).toBeNull();
  });

  it("parses runtime routes without a table", () => {
    expect(parseAppRoute("/run/sales")).toEqual({
      kind: "runtime",
      appCode: "sales",
    });
    expect(parseAppRoute("/run/sales/dashboard")).toEqual({
      kind: "runtime",
      appCode: "sales",
    });
    expect(parseAppRoute("/run/sales/approvals")).toEqual({
      kind: "runtime",
      appCode: "sales",
    });
  });

  it("parses runtime table routes", () => {
    expect(parseAppRoute("/run/sales/orders")).toEqual({
      kind: "runtime",
      appCode: "sales",
      tableCode: "orders",
    });
    expect(parseAppRoute("/run/sales/orders?viewId=1")).toEqual({
      kind: "runtime",
      appCode: "sales",
      tableCode: "orders",
    });
  });

  it("decodes encoded segments", () => {
    const appCode = "営業 アプリ";
    const tableCode = "受注 一覧";
    const pathname = `/run/${encodeURIComponent(appCode)}/${encodeURIComponent(tableCode)}`;

    expect(parseAppRoute(pathname)).toEqual({
      kind: "runtime",
      appCode,
      tableCode,
    });
    expect(
      parseAppRoute(`/apps/${encodeURIComponent("アプリ 1")}/tables`)
    ).toEqual({ kind: "builder", appId: "アプリ 1" });
  });

  it("keeps malformed builder segments raw instead of throwing", () => {
    expect(parseAppRoute("/apps/%E0%A4%A/tables")).toEqual({
      kind: "builder",
      appId: "%E0%A4%A",
    });
    expect(parseAppRoute("/apps/%E0%A4%A")).toEqual({
      kind: "builder",
      appId: "%E0%A4%A",
    });
  });

  it("keeps malformed runtime segments raw instead of throwing", () => {
    expect(parseAppRoute("/run/%E0%A4%A")).toEqual({
      kind: "runtime",
      appCode: "%E0%A4%A",
    });
    expect(parseAppRoute("/run/%E0%A4%A/dashboard")).toEqual({
      kind: "runtime",
      appCode: "%E0%A4%A",
    });
    expect(parseAppRoute("/run/%E0%A4%A/%E0%A4%B")).toEqual({
      kind: "runtime",
      appCode: "%E0%A4%A",
      tableCode: "%E0%A4%B",
    });
  });
});

describe("isNavItemActive", () => {
  const home = railItem("home");
  const apps = railItem("apps");
  const approvals = railItem("approvals");
  const notifications = railItem("notifications");

  it("activates home only on /home without the my-apps hash", () => {
    expect(isNavItemActive(home, "/home")).toBe(true);
    expect(isNavItemActive(home, "/home", "#my-apps")).toBe(false);
    expect(isNavItemActive(home, "/home", "#other")).toBe(true);
    expect(isNavItemActive(home, "/home/extra")).toBe(false);
    expect(isNavItemActive(home, "/apps/app-1/tables")).toBe(false);
  });

  it("activates apps on the my-apps hash or any app route", () => {
    expect(isNavItemActive(apps, "/home", "#my-apps")).toBe(true);
    expect(isNavItemActive(apps, "/home")).toBe(false);
    expect(isNavItemActive(apps, "/apps/app-1/tables")).toBe(true);
    expect(isNavItemActive(apps, "/run/sales/orders")).toBe(true);
    expect(isNavItemActive(apps, "/apps/new/ai")).toBe(false);
    expect(isNavItemActive(apps, "/notifications")).toBe(false);
  });

  it("activates approvals on the approvals inbox", () => {
    expect(isNavItemActive(approvals, "/admin/approvals")).toBe(true);
    expect(isNavItemActive(approvals, "/admin/approvals/123")).toBe(true);
    expect(isNavItemActive(approvals, "/admin/users")).toBe(false);
  });

  it("activates notifications on the notifications route", () => {
    expect(isNavItemActive(notifications, "/notifications")).toBe(true);
    expect(isNavItemActive(notifications, "/notifications/123")).toBe(true);
    expect(isNavItemActive(notifications, "/notifications?page=2")).toBe(true);
    expect(isNavItemActive(notifications, "/home")).toBe(false);
  });

  it("activates the admin rail item on admin tab paths only", () => {
    expect(isNavItemActive(ADMIN_RAIL_ITEM, "/admin")).toBe(true);
    expect(isNavItemActive(ADMIN_RAIL_ITEM, "/admin/users")).toBe(true);
    expect(isNavItemActive(ADMIN_RAIL_ITEM, "/admin/audit-logs/123")).toBe(
      true
    );
    expect(isNavItemActive(ADMIN_RAIL_ITEM, "/admin/approvals")).toBe(false);
    expect(isNavItemActive(ADMIN_RAIL_ITEM, "/home")).toBe(false);
  });

  it("activates the app top item only on the exact route", () => {
    const [appTop, dashboard, appApprovals] = getAppSectionItems({
      code: "sales",
    });

    expect(isNavItemActive(appTop, "/run/sales")).toBe(true);
    expect(isNavItemActive(appTop, "/run/sales/dashboard")).toBe(false);
    expect(isNavItemActive(appTop, "/run/sales/orders")).toBe(false);
    expect(isNavItemActive(appTop, "/run/other")).toBe(false);

    expect(isNavItemActive(dashboard, "/run/sales/dashboard")).toBe(true);
    expect(isNavItemActive(dashboard, "/run/sales/dashboard/extra")).toBe(true);
    expect(isNavItemActive(dashboard, "/run/sales")).toBe(false);

    expect(isNavItemActive(appApprovals, "/run/sales/approvals")).toBe(true);
    expect(isNavItemActive(appApprovals, "/run/sales/orders")).toBe(false);
  });

  it("activates design items on exact and nested paths", () => {
    const [tables, workflows] = getAppDesignItems({ id: "app-1" });

    expect(isNavItemActive(tables, "/apps/app-1/tables")).toBe(true);
    expect(isNavItemActive(tables, "/apps/app-1/tables/123")).toBe(true);
    expect(isNavItemActive(tables, "/apps/app-1/workflows")).toBe(false);
    expect(isNavItemActive(workflows, "/apps/app-1/workflows")).toBe(true);
  });

  it("matches encoded app routes", () => {
    const code = "営業 アプリ";
    const [appTop] = getAppSectionItems({ code });
    const pathname = `/run/${encodeURIComponent(code)}`;

    expect(isNavItemActive(appTop, pathname)).toBe(true);
    expect(isNavItemActive(appTop, pathname, "#view")).toBe(true);
  });

  it("returns false for missing pathnames", () => {
    expect(isNavItemActive(home, null)).toBe(false);
    expect(isNavItemActive(home, undefined)).toBe(false);
    expect(isNavItemActive(home, "")).toBe(false);
  });
});
