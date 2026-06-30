CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('queued', 'sent', 'failed', 'skipped');

ALTER TABLE "notifications"
  ADD COLUMN "dedupe_key" TEXT,
  ADD COLUMN "delivery_status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'sent',
  ADD COLUMN "delivery_error" TEXT,
  ADD COLUMN "delivered_at" TIMESTAMP(3),
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "deleted_at" TIMESTAMP(3);

UPDATE "notifications"
SET "delivered_at" = "created_at"
WHERE "delivered_at" IS NULL;

CREATE UNIQUE INDEX "notifications_tenant_id_recipient_id_dedupe_key_key"
  ON "notifications"("tenant_id", "recipient_id", "dedupe_key");

CREATE INDEX "notifications_tenant_id_recipient_id_archived_at_created_at_idx"
  ON "notifications"("tenant_id", "recipient_id", "archived_at", "created_at");

CREATE INDEX "notifications_tenant_id_recipient_id_deleted_at_created_at_idx"
  ON "notifications"("tenant_id", "recipient_id", "deleted_at", "created_at");

CREATE TABLE "user_notification_preferences" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_notification_preferences_user_id_type_key"
  ON "user_notification_preferences"("user_id", "type");

CREATE INDEX "user_notification_preferences_tenant_id_idx"
  ON "user_notification_preferences"("tenant_id");

ALTER TABLE "user_notification_preferences"
  ADD CONSTRAINT "user_notification_preferences_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_notification_preferences"
  ADD CONSTRAINT "user_notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
