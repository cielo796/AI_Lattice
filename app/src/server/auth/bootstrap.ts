import { getPrismaClient } from "@/server/db/prisma";
import { hashPassword } from "@/server/auth/crypto";
import { isDemoAutoSeedEnabled } from "@/server/demo/seed-policy";

const DEMO_PASSWORD = "demo";
const DEMO_TENANT_ID = "t-001";

const DEMO_TENANT = {
  id: DEMO_TENANT_ID,
  name: "Acme Corporation",
  code: "acme",
  status: "active" as const,
  planType: "enterprise",
};

const DEMO_USERS = [
  {
    id: "u-001",
    tenantId: DEMO_TENANT_ID,
    email: "marcus.chen@acme.com",
    name: "Marcus Chen",
    status: "active" as const,
    lastLoginAt: "2026-04-11T08:30:00Z",
    createdAt: "2025-01-15T00:00:00Z",
  },
  {
    id: "u-002",
    tenantId: DEMO_TENANT_ID,
    email: "alex.rivera@acme.com",
    name: "Alex Rivera",
    status: "active" as const,
    lastLoginAt: "2026-04-10T14:00:00Z",
    createdAt: "2025-02-01T00:00:00Z",
  },
  {
    id: "u-003",
    tenantId: DEMO_TENANT_ID,
    email: "sarah.jenkins@acme.com",
    name: "Sarah Jenkins",
    status: "active" as const,
    lastLoginAt: "2026-04-11T09:15:00Z",
    createdAt: "2025-03-10T00:00:00Z",
  },
  {
    id: "u-004",
    tenantId: DEMO_TENANT_ID,
    email: "admin@acme.com",
    name: "Admin User",
    status: "active" as const,
    lastLoginAt: "2026-04-11T07:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
  },
] as const;

const DEMO_ROLE_PRESETS = [
  {
    id: "role-tenant-admin",
    name: "Tenant Admin",
    roleType: "tenant_admin" as const,
    permissions: ["*"],
  },
  {
    id: "role-app-admin",
    name: "App Admin",
    roleType: "app_admin" as const,
    permissions: [
      "app:read",
      "app:write",
      "app:publish",
      "table:read",
      "table:write",
      "record:read",
      "record:write",
      "workflow:read",
      "workflow:manage",
      "approval:manage",
      "ai:execute",
      "notifications:read",
    ],
  },
  {
    id: "role-approver",
    name: "Approver",
    roleType: "approver" as const,
    permissions: [
      "app:read",
      "table:read",
      "record:read",
      "approval:manage",
      "notifications:read",
    ],
  },
  {
    id: "role-user",
    name: "User",
    roleType: "user" as const,
    permissions: [
      "app:read",
      "table:read",
      "record:read",
      "record:write",
      "workflow:read",
      "ai:execute",
      "notifications:read",
    ],
  },
  {
    id: "role-viewer",
    name: "Viewer",
    roleType: "viewer" as const,
    permissions: ["app:read", "table:read", "record:read", "notifications:read"],
  },
] as const;

let bootstrapPromise: Promise<void> | null = null;

async function seedDemoAuthData() {
  const prisma = getPrismaClient();

  await prisma.tenant.upsert({
    where: { id: DEMO_TENANT.id },
    update: {
      name: DEMO_TENANT.name,
      code: DEMO_TENANT.code,
      status: DEMO_TENANT.status,
      planType: DEMO_TENANT.planType,
    },
    create: DEMO_TENANT,
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const demoUser of DEMO_USERS) {
    const existingUser = await prisma.user.findUnique({
      where: { id: demoUser.id },
      select: { id: true, passwordHash: true },
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          id: demoUser.id,
          tenantId: demoUser.tenantId,
          email: demoUser.email,
          name: demoUser.name,
          status: demoUser.status,
          passwordHash,
          lastLoginAt: new Date(demoUser.lastLoginAt),
          createdAt: new Date(demoUser.createdAt),
        },
      });

      continue;
    }

    await prisma.user.update({
      where: { id: demoUser.id },
      data: {
        tenantId: demoUser.tenantId,
        email: demoUser.email,
        name: demoUser.name,
        status: demoUser.status,
        ...(existingUser.passwordHash ? {} : { passwordHash }),
      },
    });
  }

  for (const role of DEMO_ROLE_PRESETS) {
    await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId: DEMO_TENANT_ID,
          name: role.name,
        },
      },
      update: {
        roleType: role.roleType,
        permissionsJson: role.permissions,
        isSystem: true,
      },
      create: {
        id: role.id,
        tenantId: DEMO_TENANT_ID,
        name: role.name,
        roleType: role.roleType,
        permissionsJson: role.permissions,
        isSystem: true,
      },
    });
  }

  const tenantAdminRole = await prisma.role.findUnique({
    where: {
      tenantId_name: {
        tenantId: DEMO_TENANT_ID,
        name: "Tenant Admin",
      },
    },
    select: { id: true },
  });
  const userRole = await prisma.role.findUnique({
    where: {
      tenantId_name: {
        tenantId: DEMO_TENANT_ID,
        name: "User",
      },
    },
    select: { id: true },
  });

  for (const demoUser of DEMO_USERS) {
    const roleId =
      demoUser.email === "admin@acme.com" ||
      demoUser.email === "marcus.chen@acme.com"
        ? tenantAdminRole?.id
        : userRole?.id;

    if (!roleId) {
      continue;
    }

    const existingAssignment = await prisma.userRole.findFirst({
      where: {
        tenantId: DEMO_TENANT_ID,
        userId: demoUser.id,
        roleId,
        appId: null,
        tableId: null,
      },
      select: { id: true },
    });

    if (!existingAssignment) {
      await prisma.userRole.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: DEMO_TENANT_ID,
          userId: demoUser.id,
          roleId,
        },
      });
    }
  }
}

export async function ensureDemoAuthData() {
  if (!isDemoAutoSeedEnabled()) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = seedDemoAuthData().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  await bootstrapPromise;
}
