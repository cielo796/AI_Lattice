import { readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { isDemoAutoSeedEnabled } from "@/server/demo/seed-policy";

export const REQUIRED_DATABASE_TABLES = [
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
  "audit_logs",
] as const;

const DEMO_TENANT_ID = "t-001";
const DEMO_USER_ID = "u-001";

export interface DatabaseSetupHealth {
  status: "ok" | "error";
  checkedAt: string;
  message: string;
  database: {
    urlConfigured: boolean;
    connected: boolean;
    error?: string;
  };
  migrations: {
    ok: boolean;
    expectedTables: string[];
    missingTables: string[];
    appliedMigrationCount: number;
    failedMigrations: string[];
    pendingMigrations: string[];
    hint?: string;
  };
  seed: {
    ok: boolean;
    enabled: boolean;
    checked: boolean;
    missing: string[];
    hint?: string;
  };
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() ?? "";
}

function createBaseHealth(): DatabaseSetupHealth {
  return {
    status: "error",
    checkedAt: new Date().toISOString(),
    message: "データベースセットアップの確認に失敗しました。",
    database: {
      urlConfigured: Boolean(getDatabaseUrl()),
      connected: false,
    },
    migrations: {
      ok: false,
      expectedTables: [...REQUIRED_DATABASE_TABLES],
      missingTables: [...REQUIRED_DATABASE_TABLES],
      appliedMigrationCount: 0,
      failedMigrations: [],
      pendingMigrations: [],
      hint: "npm run db:migrate:deploy を実行してください。",
    },
    seed: {
      ok: false,
      enabled: isDemoAutoSeedEnabled(),
      checked: false,
      missing: [],
      hint: "デモログインを使う場合は DEMO_AUTO_SEED=true で起動してください。",
    },
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function listExistingTables(client: Client) {
  const result = await client.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
    `
  );

  return new Set(result.rows.map((row) => row.table_name));
}

async function listMigrationState(client: Client, hasMigrationTable: boolean) {
  if (!hasMigrationTable) {
    return {
      appliedMigrationCount: 0,
      pendingMigrations: await listExpectedMigrationNames(),
      failedMigrations: [],
    };
  }

  const [applied, failed, expectedMigrationNames] = await Promise.all([
    client.query<{ migration_name: string }>(
      `
        select migration_name
        from _prisma_migrations
        where finished_at is not null
          and rolled_back_at is null
      `
    ),
    client.query<{ migration_name: string }>(
      `
        select migration_name
        from _prisma_migrations
        where finished_at is null
          and rolled_back_at is null
      `
    ),
    listExpectedMigrationNames(),
  ]);

  const appliedMigrationNames = new Set(
    applied.rows.map((row) => row.migration_name)
  );

  return {
    appliedMigrationCount: appliedMigrationNames.size,
    pendingMigrations: expectedMigrationNames.filter(
      (migrationName) => !appliedMigrationNames.has(migrationName)
    ),
    failedMigrations: failed.rows.map((row) => row.migration_name),
  };
}

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

async function hasRow(client: Client, sql: string, values: unknown[]) {
  const result = await client.query<{ exists: boolean }>(sql, values);
  return Boolean(result.rows[0]?.exists);
}

async function checkSeedState(
  client: Client,
  existingTables: Set<string>
): Promise<DatabaseSetupHealth["seed"]> {
  const enabled = isDemoAutoSeedEnabled();

  if (!enabled) {
    return {
      ok: true,
      enabled,
      checked: false,
      missing: [],
      hint: "DEMO_AUTO_SEED=false のためデモseed確認をスキップしました。",
    };
  }

  const requiredSeedTables = ["tenants", "users"];
  const missingSeedTables = requiredSeedTables.filter(
    (table) => !existingTables.has(table)
  );

  if (missingSeedTables.length > 0) {
    return {
      ok: false,
      enabled,
      checked: false,
      missing: missingSeedTables.map((table) => `${table} table`),
      hint: "先に Prisma migration を適用してください。",
    };
  }

  const [hasDemoTenant, hasDemoUser] = await Promise.all([
    hasRow(client, "select exists(select 1 from tenants where id = $1)", [
      DEMO_TENANT_ID,
    ]),
    hasRow(client, "select exists(select 1 from users where id = $1)", [
      DEMO_USER_ID,
    ]),
  ]);
  const missing = [
    hasDemoTenant ? null : `demo tenant ${DEMO_TENANT_ID}`,
    hasDemoUser ? null : `demo user ${DEMO_USER_ID}`,
  ].filter((item): item is string => item !== null);

  return {
    ok: missing.length === 0,
    enabled,
    checked: true,
    missing,
    ...(missing.length > 0
      ? {
          hint: "ログイン前にデモseedが実行されているか確認してください。",
        }
      : {}),
  };
}

export async function checkDatabaseSetup(): Promise<DatabaseSetupHealth> {
  const health = createBaseHealth();
  const connectionString = getDatabaseUrl();

  if (!connectionString) {
    return {
      ...health,
      message:
        "DATABASE_URL が設定されていません。管理者は環境変数を設定してください。",
      database: {
        ...health.database,
        urlConfigured: false,
        error: "DATABASE_URL is not set",
      },
      migrations: {
        ...health.migrations,
        hint: "DATABASE_URL を設定してから npm run db:migrate:deploy を実行してください。",
      },
      seed: {
        ...health.seed,
        hint: "DATABASE_URL 設定後にデモseedを確認してください。",
      },
    };
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    const existingTables = await listExistingTables(client);
    const missingTables = REQUIRED_DATABASE_TABLES.filter(
      (table) => !existingTables.has(table)
    );
    const migrationState = await listMigrationState(
      client,
      existingTables.has("_prisma_migrations")
    );
    const seed = await checkSeedState(client, existingTables);
    const migrationsOk =
      missingTables.length === 0 &&
      migrationState.failedMigrations.length === 0 &&
      migrationState.pendingMigrations.length === 0;
    const ok = migrationsOk && seed.ok;

    return {
      status: ok ? "ok" : "error",
      checkedAt: health.checkedAt,
      message: ok
        ? "データベースセットアップは正常です。"
        : "データベースセットアップが未完了です。管理者は migration と seed を確認してください。",
      database: {
        urlConfigured: true,
        connected: true,
      },
      migrations: {
        ok: migrationsOk,
        expectedTables: [...REQUIRED_DATABASE_TABLES],
        missingTables,
        appliedMigrationCount: migrationState.appliedMigrationCount,
        failedMigrations: migrationState.failedMigrations,
        pendingMigrations: migrationState.pendingMigrations,
        ...(migrationsOk
          ? {}
          : { hint: "npm run db:migrate:deploy を実行してください。" }),
      },
      seed,
    };
  } catch (error) {
    return {
      ...health,
      message:
        "データベースへ接続できません。管理者は DATABASE_URL とDB起動状態を確認してください。",
      database: {
        urlConfigured: true,
        connected: false,
        error: errorMessage(error),
      },
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}
