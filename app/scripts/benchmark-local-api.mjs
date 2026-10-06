import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const [baseArgument, label = "local", outputPath] = process.argv.slice(2);
const base = new URL(baseArgument ?? "http://127.0.0.1:3101");
if (base.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(base.hostname) || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
  throw new Error("Only an HTTP loopback server origin is allowed.");
}
const samples = Number(process.env.BENCHMARK_SAMPLES ?? 20);
if (!Number.isInteger(samples) || samples < 5 || samples > 100) throw new Error("BENCHMARK_SAMPLES must be 5–100.");
let cookie = "";

async function request(path, options = {}) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    ...options,
    headers: { ...(cookie ? { cookie } : {}), ...options.headers },
  });
  const body = await response.text();
  return { status: response.status, ms: performance.now() - start, bytes: Buffer.byteLength(body), body, headers: response.headers };
}

function summarize(measurements) {
  const times = measurements.map((measurement) => measurement.ms).sort((first, second) => first - second);
  const percentile = (ratio) => Number(times[Math.max(0, Math.ceil(times.length * ratio) - 1)].toFixed(1));
  return {
    count: times.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: percentile(1),
    errors: measurements.filter((measurement) => measurement.status !== 200).length,
    maxBytes: Math.max(...measurements.map((measurement) => measurement.bytes)),
  };
}

const login = await request("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.BENCHMARK_EMAIL ?? "marcus.chen@acme.com", password: process.env.BENCHMARK_PASSWORD ?? "demo" }),
});
if (login.status !== 200) throw new Error("Demo login failed with HTTP " + login.status);
cookie = login.headers.getSetCookie().find((value) => value.startsWith("stitch_session="))?.split(";")[0] ?? "";
if (!cookie) throw new Error("Login did not return a session cookie.");

try {
  const appsResponse = await request("/api/apps");
  if (appsResponse.status !== 200) throw new Error("App discovery failed.");
  const apps = JSON.parse(appsResponse.body);
  const app = apps.find((candidate) => candidate.code === "support-desk");
  if (!app) throw new Error("The demo support-desk app is required.");
  const tablesResponse = await request("/api/apps/" + app.id + "/tables");
  if (tablesResponse.status !== 200) throw new Error("Table discovery failed.");
  const table = JSON.parse(tablesResponse.body).find((candidate) => candidate.code === "tickets");
  if (!table) throw new Error("The demo tickets table is required.");
  const cases = [
    ["auth", "/api/auth/me"],
    ["permissions", "/api/auth/permissions"],
    ["scoped-permissions", "/api/auth/permissions?appId=" + app.id + "&tableId=" + table.id],
    ["apps", "/api/apps"],
    ["display", "/api/settings/display"],
    ["notifications", "/api/notifications"],
    ["notification-count", "/api/notifications/unread-count"],
    ["approvals", "/api/admin/approvals"],
    ["workflows", "/api/apps/" + app.id + "/workflows"],
    ["records", "/api/run/" + app.code + "/" + table.code],
    ["runtime-meta", "/api/run/" + app.code + "/" + table.code + "/meta"],
    ["runtime-overview", "/api/run/" + app.code + "/overview"],
    ["audit-logs", "/api/admin/audit-logs?limit=50"],
    ["ai-logs", "/api/admin/ai-logs?limit=50"],
    ["home-html", "/home"],
    ["creation-html", "/apps/new/ai"],
    ["workflow-html", "/apps/" + app.id + "/workflows"],
    ["runtime-html", "/run/" + app.code + "/" + table.code],
    ["profile-html", "/settings/profile"],
    ["notifications-html", "/notifications"],
  ];
  const results = [];
  for (const [name, path] of cases) {
    const initial = await request(path);
    if (initial.status !== 200) throw new Error(name + " returned HTTP " + initial.status);
    const measurements = [];
    for (let index = 0; index < samples; index++) measurements.push(await request(path));
    const result = { name, path, firstObservedMs: Number(initial.ms.toFixed(1)), ...summarize(measurements) };
    results.push(result);
    console.log(JSON.stringify({ label, ...result }));
  }
  const concurrent = [];
  for (const name of ["apps", "permissions", "records"]) {
    const path = cases.find((entry) => entry[0] === name)[1];
    const measurements = [];
    const started = performance.now();
    let nextIndex = 0;
    const workers = Array.from({ length: 10 }, async () => {
      while (nextIndex < 100) {
        nextIndex++;
        measurements.push(await request(path));
      }
    });
    await Promise.all(workers);
    const elapsedMs = performance.now() - started;
    const result = { name, concurrency: 10, ...summarize(measurements), requestsPerSecond: Number((100000 / elapsedMs).toFixed(1)) };
    concurrent.push(result);
    console.log(JSON.stringify({ label, concurrent: result }));
  }
  const data = { appCount: apps.length, sampleTable: app.code + "/" + table.code, recordCount: JSON.parse((await request("/api/run/" + app.code + "/" + table.code)).body).length };
  const report = { measuredAt: new Date().toISOString(), label, origin: base.origin, node: process.version, samples, data, methodology: "First observed request excluded from nearest-rank warm p50/p95; wall time includes complete body reception; no browser rendering or remote database latency.", results, concurrent };
  if (outputPath) await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n");
} finally {
  await request("/api/auth/logout", { method: "POST" });
}
