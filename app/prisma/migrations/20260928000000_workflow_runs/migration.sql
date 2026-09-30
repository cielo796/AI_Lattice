CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "workflow_id" TEXT,
    "workflow_name" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "definition_json" JSONB NOT NULL,
    "context_json" JSONB NOT NULL,
    "state_json" JSONB NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflow_runs_workflow_id_event_key_key" ON "workflow_runs"("workflow_id", "event_key");
CREATE INDEX "workflow_runs_tenant_id_app_id_created_at_idx" ON "workflow_runs"("tenant_id", "app_id", "created_at");
CREATE INDEX "workflow_runs_record_id_created_at_idx" ON "workflow_runs"("record_id", "created_at");
CREATE INDEX "workflow_runs_status_updated_at_idx" ON "workflow_runs"("status", "updated_at");

ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "app_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approvals" ADD COLUMN "workflow_run_id" TEXT;
ALTER TABLE "approvals" ADD COLUMN "workflow_node_id" TEXT;
ALTER TABLE "approvals" ADD COLUMN "quorum_count" INTEGER;
CREATE UNIQUE INDEX "approvals_workflow_run_id_workflow_node_id_key" ON "approvals"("workflow_run_id", "workflow_node_id");
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
