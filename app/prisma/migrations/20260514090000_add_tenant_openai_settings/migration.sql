CREATE TABLE "tenant_openai_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "api_key_last_four" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_openai_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_openai_settings_tenant_id_key" ON "tenant_openai_settings"("tenant_id");

ALTER TABLE "tenant_openai_settings" ADD CONSTRAINT "tenant_openai_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
