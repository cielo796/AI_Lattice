CREATE TYPE "AppViewType" AS ENUM ('list', 'kanban', 'calendar', 'chart', 'kpi');

CREATE TABLE "app_views" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "view_type" "AppViewType" NOT NULL DEFAULT 'list',
    "settings_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_views_table_id_name_key" ON "app_views"("table_id", "name");
CREATE INDEX "app_views_tenant_id_idx" ON "app_views"("tenant_id");
CREATE INDEX "app_views_app_id_idx" ON "app_views"("app_id");
CREATE INDEX "app_views_table_id_sort_order_idx" ON "app_views"("table_id", "sort_order");

ALTER TABLE "app_views" ADD CONSTRAINT "app_views_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_views" ADD CONSTRAINT "app_views_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_views" ADD CONSTRAINT "app_views_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "app_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
