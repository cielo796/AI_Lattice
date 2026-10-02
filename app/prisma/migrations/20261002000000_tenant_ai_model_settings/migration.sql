CREATE TABLE "tenant_ai_model_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "default_model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_ai_model_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_ai_model_settings_tenant_id_key" ON "tenant_ai_model_settings"("tenant_id");

ALTER TABLE "tenant_ai_model_settings" ADD CONSTRAINT "tenant_ai_model_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
