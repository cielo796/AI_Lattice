-- CreateTable
CREATE TABLE "app_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "data_json" JSONB NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "app_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_comments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "comment_text" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_records_tenant_id_idx" ON "app_records"("tenant_id");

-- CreateIndex
CREATE INDEX "app_records_app_id_table_id_updated_at_idx" ON "app_records"("app_id", "table_id", "updated_at");

-- CreateIndex
CREATE INDEX "app_records_table_id_deleted_at_idx" ON "app_records"("table_id", "deleted_at");

-- CreateIndex
CREATE INDEX "app_records_created_by_id_idx" ON "app_records"("created_by_id");

-- CreateIndex
CREATE INDEX "app_records_updated_by_id_idx" ON "app_records"("updated_by_id");

-- CreateIndex
CREATE INDEX "record_comments_tenant_id_idx" ON "record_comments"("tenant_id");

-- CreateIndex
CREATE INDEX "record_comments_record_id_created_at_idx" ON "record_comments"("record_id", "created_at");

-- CreateIndex
CREATE INDEX "record_comments_created_by_id_idx" ON "record_comments"("created_by_id");

-- CreateIndex
CREATE INDEX "attachments_tenant_id_idx" ON "attachments"("tenant_id");

-- CreateIndex
CREATE INDEX "attachments_record_id_created_at_idx" ON "attachments"("record_id", "created_at");

-- CreateIndex
CREATE INDEX "attachments_uploaded_by_id_idx" ON "attachments"("uploaded_by_id");

-- AddForeignKey
ALTER TABLE "app_records" ADD CONSTRAINT "app_records_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_records" ADD CONSTRAINT "app_records_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "app_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_records" ADD CONSTRAINT "app_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_records" ADD CONSTRAINT "app_records_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_comments" ADD CONSTRAINT "record_comments_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "app_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_comments" ADD CONSTRAINT "record_comments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "app_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
