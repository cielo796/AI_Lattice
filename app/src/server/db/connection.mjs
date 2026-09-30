export function getDatabaseSchema(connectionString) {
  const schema = new URL(connectionString).searchParams.get("schema") ?? "public";
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) {
    throw new Error("DATABASE_URL schema must be a lowercase PostgreSQL identifier");
  }
  return schema;
}

export function getPostgresConnectionOptions(connectionString) {
  const schema = getDatabaseSchema(connectionString);
  const url = new URL(connectionString);
  const existingOptions = url.searchParams.get("options")?.trim() ?? "";
  url.searchParams.delete("schema");
  url.searchParams.set("options", `${existingOptions} -c search_path=${schema}`.trim());
  return { connectionString: url.toString(), connectionTimeoutMillis: 10_000 };
}
