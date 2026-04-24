import { config as loadEnv } from "dotenv";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const requiredTables = [
  "_prisma_migrations",
  "tenants",
  "users",
  "sessions",
  "apps",
  "app_tables",
  "app_fields",
  "app_records",
  "record_comments",
  "attachments",
];

const demoAutoSeedEnabled = process.env.DEMO_AUTO_SEED !== "false";
const connectionString = process.env.DATABASE_URL?.trim() ?? "";

function fail(payload) {
  console.error(JSON.stringify({ status: "error", ...payload }, null, 2));
  process.exit(1);
}

if (!connectionString) {
  fail({
    message: "DATABASE_URL is not set.",
    hint: "Set DATABASE_URL and run npm run db:migrate:deploy.",
  });
}

const client = new Client({ connectionString });

async function listExpectedMigrationNames() {
  const migrationsDirectory = path.join(process.cwd(), "prisma", "migrations");

  try {
    const entries = await readdir(migrationsDirectory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

try {
  await client.connect();

  const tableResult = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  `);
  const tables = new Set(tableResult.rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((table) => !tables.has(table));

  const failedMigrations = tables.has("_prisma_migrations")
    ? (
        await client.query(`
          select migration_name
          from _prisma_migrations
          where finished_at is null
            and rolled_back_at is null
        `)
      ).rows.map((row) => row.migration_name)
    : [];
  const appliedMigrations = tables.has("_prisma_migrations")
    ? new Set(
        (
          await client.query(`
            select migration_name
            from _prisma_migrations
            where finished_at is not null
              and rolled_back_at is null
          `)
        ).rows.map((row) => row.migration_name)
      )
    : new Set();
  const pendingMigrations = (await listExpectedMigrationNames()).filter(
    (migrationName) => !appliedMigrations.has(migrationName)
  );

  const seedMissing = [];
  if (demoAutoSeedEnabled && tables.has("tenants") && tables.has("users")) {
    const [tenantResult, userResult] = await Promise.all([
      client.query("select exists(select 1 from tenants where id = $1)", [
        "t-001",
      ]),
      client.query("select exists(select 1 from users where id = $1)", ["u-001"]),
    ]);

    if (!tenantResult.rows[0]?.exists) {
      seedMissing.push("demo tenant t-001");
    }
    if (!userResult.rows[0]?.exists) {
      seedMissing.push("demo user u-001");
    }
  }

  if (
    missingTables.length > 0 ||
    failedMigrations.length > 0 ||
    pendingMigrations.length > 0 ||
    seedMissing.length > 0
  ) {
    fail({
      message: "Database setup is incomplete.",
      missingTables,
      failedMigrations,
      pendingMigrations,
      seed: {
        enabled: demoAutoSeedEnabled,
        missing: seedMissing,
      },
      hint: "Run npm run db:migrate:deploy and verify demo seed state.",
    });
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        message: "Database setup is healthy.",
        checkedTables: requiredTables.length,
        seed: {
          enabled: demoAutoSeedEnabled,
          checked: demoAutoSeedEnabled,
        },
      },
      null,
      2
    )
  );
} catch (error) {
  fail({
    message: "Database health check failed.",
    error: error instanceof Error ? error.message : String(error),
  });
} finally {
  await client.end().catch(() => undefined);
}
