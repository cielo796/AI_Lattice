-- Extend approval statuses for returned requests.
ALTER TYPE "ApprovalStatus" ADD VALUE IF NOT EXISTS 'returned';

-- App-scoped approval mode.
CREATE TYPE "ApprovalMode" AS ENUM ('any', 'all', 'sequential', 'quorum');

-- App-level approval policy.
CREATE TABLE "app_approval_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "approval_mode" "ApprovalMode" NOT NULL DEFAULT 'any',
    "target_table_id" TEXT,
    "pending_status" TEXT NOT NULL DEFAULT 'pending_approval',
    "approved_status" TEXT NOT NULL DEFAULT 'approved',
    "rejected_status" TEXT NOT NULL DEFAULT 'rejected',
    "returned_status" TEXT NOT NULL DEFAULT 'returned',
    "quorum_count" INTEGER,
    "request_title_template" TEXT,
    "request_body_template" TEXT,
    "condition_json" JSONB,
    "post_approval_actions_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_approval_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app_approval_approvers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "setting_id" TEXT NOT NULL,
    "approver_type" TEXT NOT NULL DEFAULT 'user',
    "user_id" TEXT,
    "role_id" TEXT,
    "role_type" "RoleType",
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_approval_approvers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_assignees" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "approval_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "comment_text" TEXT,
    "acted_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_assignees_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "approvals"
    ADD COLUMN "app_approval_setting_id" TEXT,
    ADD COLUMN "approval_mode" "ApprovalMode",
    ADD COLUMN "pending_status" TEXT,
    ADD COLUMN "approved_status" TEXT,
    ADD COLUMN "rejected_status" TEXT,
    ADD COLUMN "returned_status" TEXT,
    ADD COLUMN "post_approval_actions_json" JSONB;

CREATE UNIQUE INDEX "app_approval_settings_app_id_key" ON "app_approval_settings"("app_id");
CREATE INDEX "app_approval_settings_tenant_id_idx" ON "app_approval_settings"("tenant_id");
CREATE INDEX "app_approval_settings_target_table_id_idx" ON "app_approval_settings"("target_table_id");

CREATE INDEX "app_approval_approvers_tenant_id_idx" ON "app_approval_approvers"("tenant_id");
CREATE INDEX "app_approval_approvers_setting_id_sort_order_idx" ON "app_approval_approvers"("setting_id", "sort_order");
CREATE INDEX "app_approval_approvers_user_id_idx" ON "app_approval_approvers"("user_id");
CREATE INDEX "app_approval_approvers_role_id_idx" ON "app_approval_approvers"("role_id");
CREATE INDEX "app_approval_approvers_role_type_idx" ON "app_approval_approvers"("role_type");

CREATE UNIQUE INDEX "approval_assignees_approval_id_user_id_key" ON "approval_assignees"("approval_id", "user_id");
CREATE INDEX "approval_assignees_tenant_id_user_id_status_idx" ON "approval_assignees"("tenant_id", "user_id", "status");
CREATE INDEX "approval_assignees_approval_id_sort_order_idx" ON "approval_assignees"("approval_id", "sort_order");
CREATE INDEX "approvals_app_approval_setting_id_idx" ON "approvals"("app_approval_setting_id");

ALTER TABLE "app_approval_settings"
    ADD CONSTRAINT "app_approval_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "app_approval_settings_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "app_approval_settings_target_table_id_fkey" FOREIGN KEY ("target_table_id") REFERENCES "app_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_approval_approvers"
    ADD CONSTRAINT "app_approval_approvers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "app_approval_approvers_setting_id_fkey" FOREIGN KEY ("setting_id") REFERENCES "app_approval_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "app_approval_approvers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "app_approval_approvers_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approval_assignees"
    ADD CONSTRAINT "approval_assignees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "approval_assignees_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "approval_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approvals"
    ADD CONSTRAINT "approvals_app_approval_setting_id_fkey" FOREIGN KEY ("app_approval_setting_id") REFERENCES "app_approval_settings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
