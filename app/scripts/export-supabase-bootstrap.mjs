import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { REQUIRED_DATABASE_TABLES } from "../src/server/db/tables.mjs";

const schema = "ai_lattice";
const owner = process.argv[3];
if (owner && !/^[a-z_][a-z0-9_]{0,62}$/.test(owner)) {
  throw new Error("Schema owner must be a lowercase PostgreSQL identifier");
}
const directory = path.join(process.cwd(), "prisma", "migrations");
const entries = await readdir(directory, { withFileTypes: true });
const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const statements = [
  "BEGIN;",
  `CREATE SCHEMA "${schema}"${owner ? ` AUTHORIZATION "${owner}"` : ""};`,
  `REVOKE ALL ON SCHEMA "${schema}" FROM PUBLIC;`,
  ...(owner ? [`SET LOCAL ROLE "${owner}";`] : []),
  `SET LOCAL search_path = "${schema}";`,
  `CREATE TABLE "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
  );`,
];

for (const name of names) {
  const source = await readFile(path.join(directory, name, "migration.sql"));
  const checksum = createHash("sha256").update(source).digest("hex");
  const escapedName = name.replaceAll("'", "''");
  statements.push(source.toString("utf8"));
  statements.push(`INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ('${randomUUID()}', '${checksum}', '${escapedName}', now(), 1);`);
}

for (const table of REQUIRED_DATABASE_TABLES) {
  statements.push(`ALTER TABLE "${schema}"."${table}" ENABLE ROW LEVEL SECURITY;`);
}
statements.push("COMMIT;");
statements.push(`SELECT '${schema}' AS schema_name, count(*) AS applied_migrations FROM "${schema}"."_prisma_migrations" WHERE finished_at IS NOT NULL;`);
const output = statements.join("\n\n");
if (process.argv[2]) {
  await writeFile(process.argv[2], output, "utf8");
  console.log(`Exported ${names.length} migrations for ${schema} to ${process.argv[2]}`);
} else {
  process.stdout.write(output);
}
