CREATE TABLE "app_forms" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_forms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_forms_table_id_name_key" ON "app_forms"("table_id", "name");
CREATE INDEX "app_forms_tenant_id_idx" ON "app_forms"("tenant_id");
CREATE INDEX "app_forms_app_id_idx" ON "app_forms"("app_id");
CREATE INDEX "app_forms_table_id_sort_order_idx" ON "app_forms"("table_id", "sort_order");

ALTER TABLE "app_forms" ADD CONSTRAINT "app_forms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_forms" ADD CONSTRAINT "app_forms_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_forms" ADD CONSTRAINT "app_forms_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "app_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
