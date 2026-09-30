CREATE TABLE "workflow_schedule_states" (
    "workflow_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "definition_hash" TEXT NOT NULL,
    "workflow_updated_at" TIMESTAMP(3) NOT NULL,
    "cycle_id" TEXT,
    "cycle_started_at" TIMESTAMP(3) WITH TIME ZONE,
    "cursor_record_id" TEXT,
    "next_due_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_batch_at" TIMESTAMP(3) WITH TIME ZONE,
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    CONSTRAINT "workflow_schedule_states_pkey" PRIMARY KEY ("workflow_id")
);
CREATE INDEX "workflow_schedule_states_next_due_at_last_batch_at_idx" ON "workflow_schedule_states"("next_due_at", "last_batch_at");
CREATE INDEX "workflow_schedule_states_tenant_id_idx" ON "workflow_schedule_states"("tenant_id");
CREATE INDEX "app_records_tenant_id_app_id_id_idx" ON "app_records"("tenant_id", "app_id", "id");
ALTER TABLE "workflow_schedule_states" ADD CONSTRAINT "workflow_schedule_states_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_schedule_states" ADD CONSTRAINT "workflow_schedule_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_schedule_states" ENABLE ROW LEVEL SECURITY;
