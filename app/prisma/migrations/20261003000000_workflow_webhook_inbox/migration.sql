ALTER TABLE "workflows" ADD COLUMN "webhook_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workflows" ADD COLUMN "webhook_secret_encrypted" TEXT;
ALTER TABLE "workflows" ADD COLUMN "webhook_key_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "workflows" ADD COLUMN "webhook_secret_updated_at" TIMESTAMP(3) WITH TIME ZONE;
CREATE TABLE "workflow_webhook_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "record_id" TEXT,
    "run_ids_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_webhook_events_workflow_id_delivery_id_key" ON "workflow_webhook_events"("workflow_id", "delivery_id");
CREATE INDEX "workflow_webhook_events_workflow_id_created_at_idx" ON "workflow_webhook_events"("workflow_id", "created_at");
CREATE INDEX "workflow_webhook_events_tenant_id_idx" ON "workflow_webhook_events"("tenant_id");
CREATE INDEX "workflow_webhook_events_record_id_idx" ON "workflow_webhook_events"("record_id");
ALTER TABLE "workflow_webhook_events" ADD CONSTRAINT "workflow_webhook_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_webhook_events" ADD CONSTRAINT "workflow_webhook_events_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_webhook_events" ADD CONSTRAINT "workflow_webhook_events_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "app_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflow_webhook_events" ENABLE ROW LEVEL SECURITY;
