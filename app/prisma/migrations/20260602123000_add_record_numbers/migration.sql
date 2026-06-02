ALTER TABLE "app_records" ADD COLUMN "record_no" INTEGER;

WITH numbered_records AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "table_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS "record_no"
  FROM "app_records"
)
UPDATE "app_records"
SET "record_no" = numbered_records."record_no"
FROM numbered_records
WHERE "app_records"."id" = numbered_records."id";

ALTER TABLE "app_records" ALTER COLUMN "record_no" SET NOT NULL;

CREATE UNIQUE INDEX "app_records_table_id_record_no_key"
  ON "app_records"("table_id", "record_no");
