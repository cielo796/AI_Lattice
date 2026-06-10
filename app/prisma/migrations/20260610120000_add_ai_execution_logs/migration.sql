-- CreateEnum
CREATE TYPE "AIExecutionStatus" AS ENUM ('success', 'error');

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_template_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "prompt_template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "model_name" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "response_schema_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_execution_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "app_id" TEXT,
    "record_id" TEXT,
    "prompt_template_version_id" TEXT,
    "actor_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model_name" TEXT NOT NULL,
    "status" "AIExecutionStatus" NOT NULL DEFAULT 'success',
    "input_json" JSONB,
    "output_json" JSONB,
    "error_message" TEXT,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_tenant_id_key_key" ON "prompt_templates"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "prompt_templates_tenant_id_operation_idx" ON "prompt_templates"("tenant_id", "operation");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_template_versions_prompt_template_id_version_key" ON "prompt_template_versions"("prompt_template_id", "version");

-- CreateIndex
CREATE INDEX "prompt_template_versions_tenant_id_is_active_idx" ON "prompt_template_versions"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "prompt_template_versions_created_by_id_idx" ON "prompt_template_versions"("created_by_id");

-- CreateIndex
CREATE INDEX "ai_execution_logs_tenant_id_created_at_idx" ON "ai_execution_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_execution_logs_tenant_id_operation_created_at_idx" ON "ai_execution_logs"("tenant_id", "operation", "created_at");

-- CreateIndex
CREATE INDEX "ai_execution_logs_tenant_id_status_created_at_idx" ON "ai_execution_logs"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ai_execution_logs_app_id_created_at_idx" ON "ai_execution_logs"("app_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_execution_logs_actor_id_created_at_idx" ON "ai_execution_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_execution_logs_prompt_template_version_id_idx" ON "ai_execution_logs"("prompt_template_version_id");

-- AddForeignKey
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_template_versions" ADD CONSTRAINT "prompt_template_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_template_versions" ADD CONSTRAINT "prompt_template_versions_prompt_template_id_fkey" FOREIGN KEY ("prompt_template_id") REFERENCES "prompt_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_template_versions" ADD CONSTRAINT "prompt_template_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_execution_logs" ADD CONSTRAINT "ai_execution_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_execution_logs" ADD CONSTRAINT "ai_execution_logs_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_execution_logs" ADD CONSTRAINT "ai_execution_logs_prompt_template_version_id_fkey" FOREIGN KEY ("prompt_template_version_id") REFERENCES "prompt_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_execution_logs" ADD CONSTRAINT "ai_execution_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
