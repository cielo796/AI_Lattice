import type { User } from "@/types/user";

export const mockUsers: User[] = [
  {
    id: "u-001",
    tenantId: "t-001",
    email: "marcus.chen@acme.com",
    name: "Marcus Chen",
    status: "active",
    lastLoginAt: "2026-04-11T08:30:00Z",
    createdAt: "2025-01-15T00:00:00Z",
  },
  {
    id: "u-002",
    tenantId: "t-001",
    email: "alex.rivera@acme.com",
    name: "Alex Rivera",
    status: "active",
    lastLoginAt: "2026-04-10T14:00:00Z",
    createdAt: "2025-02-01T00:00:00Z",
  },
  {
    id: "u-003",
    tenantId: "t-001",
    email: "sarah.jenkins@acme.com",
    name: "Sarah Jenkins",
    status: "active",
    lastLoginAt: "2026-04-11T09:15:00Z",
    createdAt: "2025-03-10T00:00:00Z",
  },
  {
    id: "u-004",
    tenantId: "t-001",
    email: "admin@acme.com",
    name: "Admin User",
    status: "active",
    lastLoginAt: "2026-04-11T07:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
  },
];

export const currentUser = mockUsers[0];
