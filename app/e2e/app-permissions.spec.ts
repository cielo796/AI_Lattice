import { expect, test, type APIResponse } from "@playwright/test";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { getPostgresConnectionOptions } from "../src/server/db/connection.mjs";
import type { App, AppTable } from "../src/types/app";
import { serializeTableDesign, tableDesignDraft, type TableDesignSnapshot } from "../src/lib/table-design";

test.skip(process.env.PLAYWRIGHT_APP_AUDIT_TEST !== "true", "Requires an explicitly enabled disposable local test database.");

async function json<Result>(response: APIResponse): Promise<Result> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<Result>;
}

test("app-scoped viewer and another tenant cannot mutate or execute protected resources", async ({ request, playwright, baseURL }) => {
  const connection = process.env.DATABASE_URL!;
  const database = new URL(connection);
  expect(["localhost", "127.0.0.1"]).toContain(database.hostname);
  expect(database.pathname).toMatch(/^\/lattice_test_[a-z0-9_]+$/);
  await json(await request.post("/api/auth/login", { data: { email: "marcus.chen@acme.com", password: "demo" } }));
  const suffix = Date.now();
  const apps: App[] = [];
  const client = new Client(getPostgresConnectionOptions(connection));
  const viewer = await playwright.request.newContext({ baseURL });
  const stranger = await playwright.request.newContext({ baseURL });
  const anonymous = await playwright.request.newContext({ baseURL });
  const viewerId = randomUUID();
  const viewerRoleId = randomUUID();
  const strangerTenantId = randomUUID();
  await client.connect();
  try {
    for (const label of ["allowed", "forbidden"]) apps.push(await json<App>(await request.post("/api/apps", { data: { name: `Scope ${label} ${suffix}`, code: `scope-${label}-${suffix}`, status: "published" } })));
    const app = apps[0];
    const table = await json<AppTable>(await request.post(`/api/apps/${app.id}/tables`, { data: { name: "対象", code: "requests" } }));
    await json(await request.post(`/api/apps/${app.id}/tables/${table.id}/fields`, { data: { name: "件名", code: "title", fieldType: "text" } }));
    const recordsUrl = `/api/run/${app.code}/${table.code}`;
    const record = await json<{ id: string; status: string }>(await request.post(recordsUrl, { data: { data: { title: "Protected audit record" } } }));
    const workflow = await json<{ id: string }>(await request.post(`/api/apps/${app.id}/workflows`, { data: { name: "Protected audit workflow", status: "active", triggerType: "webhook", definitionJson: { nodes: [{ id: "start", data: { label: "開始", nodeType: "trigger" } }, { id: "done", data: { label: "更新", nodeType: "status_update", config: { status: "must_not_run" } } }], edges: [{ id: "01", source: "start", target: "done" }] } } }));
    const owner = (await client.query("SELECT tenant_id, password_hash FROM users WHERE id = $1", [app.createdBy])).rows[0];
    const viewerEmail = `viewer-${suffix}@audit.example`;
    const strangerEmail = `stranger-${suffix}@audit.example`;
    await client.query("INSERT INTO users (id, tenant_id, email, name, password_hash, updated_at) VALUES ($1,$2,$3,'Audit viewer',$4,CURRENT_TIMESTAMP)", [viewerId, owner.tenant_id, viewerEmail, owner.password_hash]);
    await client.query("INSERT INTO roles (id,tenant_id,name,role_type,permissions_json,updated_at) VALUES ($1,$2,$3,'viewer',$4::jsonb,CURRENT_TIMESTAMP)", [viewerRoleId, owner.tenant_id, `Audit viewer ${suffix}`, JSON.stringify(["app:read", "table:read", "record:read", "workflow:read"])]);
    await client.query("INSERT INTO user_roles (id,tenant_id,user_id,role_id,app_id) VALUES ($1,$2,$3,$4,$5)", [randomUUID(), owner.tenant_id, viewerId, viewerRoleId, app.id]);
    await client.query("INSERT INTO tenants (id,name,code,plan_type,updated_at) VALUES ($1,'Audit isolated tenant',$2,'test',CURRENT_TIMESTAMP)", [strangerTenantId, `audit-${suffix}`]);
    const strangerId = randomUUID();
    const strangerRoleId = randomUUID();
    await client.query("INSERT INTO users (id,tenant_id,email,name,password_hash,updated_at) VALUES ($1,$2,$3,'Audit outsider',$4,CURRENT_TIMESTAMP)", [strangerId, strangerTenantId, strangerEmail, owner.password_hash]);
    await client.query("INSERT INTO roles (id,tenant_id,name,role_type,permissions_json,updated_at) VALUES ($1,$2,'Audit administrator','tenant_admin','[\"*\"]'::jsonb,CURRENT_TIMESTAMP)", [strangerRoleId, strangerTenantId]);
    await client.query("INSERT INTO user_roles (id,tenant_id,user_id,role_id) VALUES ($1,$2,$3,$4)", [randomUUID(), strangerTenantId, strangerId, strangerRoleId]);
    await json(await viewer.post("/api/auth/login", { data: { email: viewerEmail, password: "demo" } }));
    await json(await stranger.post("/api/auth/login", { data: { email: strangerEmail, password: "demo" } }));
    const modelSettingsPath = "/api/admin/ai-model-settings";
    expect((await anonymous.get(modelSettingsPath)).status()).toBe(401);
    expect((await anonymous.put(modelSettingsPath, { data: { defaultModel: "gpt-6-astra" } })).status()).toBe(401);
    expect((await viewer.get(modelSettingsPath)).status()).toBe(403);
    expect((await viewer.put(modelSettingsPath, { data: { defaultModel: "gpt-6-astra" } })).status()).toBe(403);
    const ownerModel = await json<{ defaultModel: string }>(await request.get(modelSettingsPath));
    await json(await stranger.put(modelSettingsPath, { data: { defaultModel: "gpt-6-astra", tenantId: owner.tenant_id } }));
    expect(await json(await request.get(modelSettingsPath))).toMatchObject({ defaultModel: ownerModel.defaultModel });
    expect(await json(await stranger.get(modelSettingsPath))).toMatchObject({ defaultModel: "gpt-6-astra", source: "tenant" });
    expect((await anonymous.get(`/api/apps/${app.id}`)).status()).toBe(401);
    expect((await viewer.get(`/api/apps/${app.id}`)).status()).toBe(200);
    const designer = await json<TableDesignSnapshot>(await request.get(`/api/apps/${app.id}/designer`));
    expect((await viewer.get(`/api/apps/${app.id}/designer`)).status()).toBe(200);
    expect((await viewer.put(`/api/apps/${app.id}/designer`, { data: serializeTableDesign(tableDesignDraft(designer), designer.revision) })).status()).toBe(403);
    expect((await anonymous.get(`/api/apps/${app.id}/designer`)).status()).toBe(401);
    expect((await viewer.get(`${recordsUrl}/${record.id}`)).status()).toBe(200);
    expect((await viewer.get(`/api/apps/${app.id}/workflows`)).status()).toBe(200);
    expect([403, 404]).toContain((await viewer.get(`/api/apps/${apps[1].id}`)).status());
    for (const response of [
      await viewer.put(`/api/apps/${app.id}`, { data: { name: "Forbidden mutation" } }),
      await viewer.post(`/api/apps/${app.id}/publish`),
      await viewer.post(recordsUrl, { data: { data: { title: "Forbidden record" } } }),
      await viewer.post(`/api/apps/${app.id}/workflows/${workflow.id}/run`, { data: { tableId: table.id, recordId: record.id } }),
    ]) expect(response.status(), await response.text()).toBe(403);
    for (const path of [`/api/apps/${app.id}`, `/api/apps/${app.id}/designer`, `${recordsUrl}/${record.id}`, `/api/apps/${app.id}/workflows/${workflow.id}`, `/api/apps/${app.id}/workflow-runs`]) expect((await stranger.get(path)).status()).toBe(404);
    expect((await stranger.post(`/api/apps/${app.id}/workflows/${workflow.id}/run`, { data: { tableId: table.id, recordId: record.id } })).status()).toBe(404);
    expect(await json(await request.get(`${recordsUrl}/${record.id}`))).toMatchObject({ status: record.status });
    expect(await json(await request.get(`/api/apps/${app.id}/workflow-runs`))).toEqual([]);
  } finally {
    await viewer.dispose();
    await stranger.dispose();
    await anonymous.dispose();
    for (const app of apps) await request.delete(`/api/apps/${app.id}`);
    await client.query("DELETE FROM users WHERE id = $1", [viewerId]);
    await client.query("DELETE FROM roles WHERE id = $1", [viewerRoleId]);
    await client.query("DELETE FROM tenants WHERE id = $1", [strangerTenantId]);
    await client.end();
  }
});
