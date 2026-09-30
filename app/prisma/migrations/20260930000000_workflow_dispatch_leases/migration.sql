ALTER TABLE "workflow_runs" ADD COLUMN "lease_token" TEXT;
ALTER TABLE "workflow_runs" ADD COLUMN "lease_expires_at" TIMESTAMP(3) WITH TIME ZONE;
CREATE INDEX "workflow_runs_status_lease_expires_at_idx" ON "workflow_runs"("status", "lease_expires_at");
