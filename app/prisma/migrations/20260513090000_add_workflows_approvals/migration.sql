-- CreateEnum
CREATE TYPE "WorkflowTriggerType" AS ENUM ('create', 'update', 'schedule', 'webhook', 'status_change');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('draft', 'active');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_type" "WorkflowTriggerType" NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'draft',
    "definition_json" JSONB NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "workflow_id" TEXT,
    "approver_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "acted_by_id" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "comment_text" TEXT,
    "acted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_tenant_id_idx" ON "workflows"("tenant_id");

-- CreateIndex
CREATE INDEX "workflows_app_id_status_idx" ON "workflows"("app_id", "status");

-- CreateIndex
CREATE INDEX "workflows_created_by_id_idx" ON "workflows"("created_by_id");

-- CreateIndex
CREATE INDEX "approvals_tenant_id_status_created_at_idx" ON "approvals"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "approvals_app_id_status_idx" ON "approvals"("app_id", "status");

-- CreateIndex
CREATE INDEX "approvals_record_id_status_idx" ON "approvals"("record_id", "status");

-- CreateIndex
CREATE INDEX "approvals_workflow_id_idx" ON "approvals"("workflow_id");

-- CreateIndex
CREATE INDEX "approvals_approver_id_status_idx" ON "approvals"("approver_id", "status");

-- CreateIndex
CREATE INDEX "approvals_requested_by_id_idx" ON "approvals"("requested_by_id");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "app_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "app_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_acted_by_id_fkey" FOREIGN KEY ("acted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
