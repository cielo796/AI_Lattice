export type PermissionMap = Record<string, boolean>;

export interface ShellNavItem {
  key: string;
  label: string;
  href: string;
  icon: string;
}

export const RAIL_ITEMS: ShellNavItem[] = [
  { key: "home", label: "ホーム", href: "/home", icon: "home" },
  { key: "apps", label: "アプリ", href: "/home#my-apps", icon: "apps" },
  {
    key: "approvals",
    label: "承認",
    href: "/admin/approvals",
    icon: "approval",
  },
  {
    key: "notifications",
    label: "通知",
    href: "/notifications",
    icon: "notifications",
  },
];

export const ADMIN_RAIL_ITEM: ShellNavItem = {
  key: "admin",
  label: "管理",
  href: "/admin",
  icon: "admin_panel_settings",
};

export interface AdminTab extends ShellNavItem {
  permission: string;
}

export const ADMIN_TABS: AdminTab[] = [
  {
    key: "users",
    label: "ユーザー",
    href: "/admin/users",
    icon: "group",
    permission: "admin:users",
  },
  {
    key: "roles",
    label: "ロール",
    href: "/admin/roles",
    icon: "admin_panel_settings",
    permission: "admin:roles",
  },
  {
    key: "tenant",
    label: "テナント設定",
    href: "/admin/tenant",
    icon: "domain",
    permission: "admin:tenant",
  },
  {
    key: "openai",
    label: "AI設定",
    href: "/admin/openai",
    icon: "key",
    permission: "admin:openai",
  },
  {
    key: "prompt-templates",
    label: "Prompt Template",
    href: "/admin/prompt-templates",
    icon: "text_snippet",
    permission: "admin:prompt_templates",
  },
  {
    key: "ai-logs",
    label: "AI実行ログ",
    href: "/admin/ai-logs",
    icon: "auto_awesome",
    permission: "admin:ai_logs",
  },
  {
    key: "audit-logs",
    label: "監査ログ",
    href: "/admin/audit-logs",
    icon: "fact_check",
    permission: "admin:audit_logs",
  },
];

function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) {
    return "";
  }

  const withoutHash = pathname.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];

  return withoutQuery.length > 1
    ? withoutQuery.replace(/\/+$/, "")
    : withoutQuery;
}

function isPermissionGranted(
  permissions: PermissionMap | null | undefined,
  permission: string
): boolean {
  return permissions?.[permission] === true;
}

export function getVisibleAdminTabs(
  permissions: PermissionMap | null | undefined
): AdminTab[] {
  return ADMIN_TABS.filter((tab) => isPermissionGranted(permissions, tab.permission));
}

export function canSeeAdmin(
  permissions: PermissionMap | null | undefined
): boolean {
  if (!permissions) {
    return false;
  }

  return Object.entries(permissions).some(
    ([permission, granted]) =>
      permission.startsWith("admin:") && granted === true
  );
}

export function isAdminTabPath(
  pathname: string | null | undefined
): boolean {
  const path = normalizePathname(pathname);

  if (!path) {
    return false;
  }

  if (path === ADMIN_RAIL_ITEM.href) {
    return true;
  }

  return ADMIN_TABS.some(
    (tab) => path === tab.href || path.startsWith(`${tab.href}/`)
  );
}

export function getAppSectionItems(app: { code: string }): ShellNavItem[] {
  const code = encodeURIComponent(app.code);

  return [
    {
      key: "app-top",
      label: "アプリトップ",
      href: `/run/${code}`,
      icon: "home_app_logo",
    },
    {
      key: "dashboard",
      label: "ダッシュボード",
      href: `/run/${code}/dashboard`,
      icon: "dashboard",
    },
    {
      key: "app-approvals",
      label: "アプリ承認",
      href: `/run/${code}/approvals`,
      icon: "approval",
    },
  ];
}

export function getAppDesignItems(app: { id: string }): ShellNavItem[] {
  const id = encodeURIComponent(app.id);

  return [
    {
      key: "tables",
      label: "テーブル",
      href: `/apps/${id}/tables`,
      icon: "table_chart",
    },
    {
      key: "workflows",
      label: "ワークフロー",
      href: `/apps/${id}/workflows`,
      icon: "account_tree",
    },
    {
      key: "permissions",
      label: "権限設計",
      href: `/apps/${id}/permissions`,
      icon: "shield_person",
    },
    {
      key: "settings",
      label: "アプリ設定",
      href: `/apps/${id}/settings`,
      icon: "settings",
    },
  ];
}

export function canSeeAppDesign(
  permissions: PermissionMap | null | undefined
): boolean {
  return permissions?.["app:write"] === true;
}

export interface AppRoute {
  kind: "builder" | "runtime";
  appId?: string;
  appCode?: string;
  tableCode?: string;
}

function pathSegments(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function isAppTopHref(href: string): boolean {
  const segments = pathSegments(href);

  return segments.length === 2 && segments[0] === "run";
}

export function parseAppRoute(
  pathname: string | null | undefined
): AppRoute | null {
  const path = normalizePathname(pathname);

  if (!path) {
    return null;
  }

  const segments = pathSegments(path);

  if (segments.length < 2) {
    return null;
  }

  const [root, second, third] = segments;

  if (root === "apps") {
    if (second === "new") {
      return null;
    }

    return { kind: "builder", appId: safeDecode(second) };
  }

  if (root === "run") {
    const appCode = safeDecode(second);

    if (segments.length < 3) {
      return { kind: "runtime", appCode };
    }

    const tableCode = safeDecode(third);

    if (tableCode === "dashboard" || tableCode === "approvals") {
      return { kind: "runtime", appCode };
    }

    return { kind: "runtime", appCode, tableCode };
  }

  return null;
}

export function isNavItemActive(
  item: ShellNavItem,
  pathname: string | null | undefined,
  hash?: string
): boolean {
  const path = normalizePathname(pathname);

  if (!path) {
    return false;
  }

  const normalizedHash = hash ?? "";

  if (item.href === "/home") {
    return path === "/home" && normalizedHash !== "#my-apps";
  }

  if (item.href === "/home#my-apps") {
    return (
      (path === "/home" && normalizedHash === "#my-apps") ||
      parseAppRoute(path) !== null
    );
  }

  if (item.href === ADMIN_RAIL_ITEM.href) {
    return isAdminTabPath(path);
  }

  if (isAppTopHref(item.href)) {
    return path === item.href;
  }

  return path === item.href || path.startsWith(`${item.href}/`);
}
