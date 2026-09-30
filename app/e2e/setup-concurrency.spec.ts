import { expect, test } from "@playwright/test";

test.skip(process.env.PLAYWRIGHT_SETUP_TEST !== "true", "Requires a fresh database and DEMO_AUTO_SEED=false.");

test("only one concurrent initial setup can create an organization", async ({ request }) => {
  const password = "concurrency-test-password-2026";
  const candidates = ["first", "second"].map((name) => ({
    setupToken: process.env.SETUP_TOKEN,
    organizationName: `Concurrent ${name}`,
    organizationCode: `concurrent-${name}`,
    name: `Admin ${name}`,
    email: `${name}@concurrency.example`,
    password,
  }));

  const responses = await Promise.all(candidates.map((data) => request.post("/api/setup", { data })));
  const statuses = responses.map((response) => response.status());
  expect([...statuses].sort()).toEqual([201, 409]);
  const winner = candidates[statuses.indexOf(201)];
  const loser = candidates[statuses.indexOf(409)];

  const rejectedLogin = await request.post("/api/auth/login", { data: { email: loser.email, password } });
  expect(rejectedLogin.status()).toBe(401);
  const login = await request.post("/api/auth/login", { data: { email: winner.email, password } });
  expect(login.status(), await login.text()).toBe(200);
  const users = await request.get("/api/admin/users");
  expect(users.status()).toBe(200);
  expect(await users.json()).toEqual([expect.objectContaining({ email: winner.email })]);
  const audit = await request.get("/api/admin/audit-logs", { params: { actionType: "WORKSPACE_SETUP" } });
  expect(audit.status()).toBe(200);
  expect(await audit.json()).toEqual([expect.objectContaining({ actionType: "WORKSPACE_SETUP" })]);
});
