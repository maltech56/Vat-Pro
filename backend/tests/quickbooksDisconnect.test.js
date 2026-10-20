"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

// Exercise the actual controller implementation with an isolated pool and OAuth
// client. No database, network calls, or live tokens are used.
const controllerFile = path.resolve(__dirname, "../src/controllers/quickbooksController.js");
const source = fs.readFileSync(controllerFile, "utf8");
const start = source.indexOf("const isConfirmedInvalidRevocationToken =");
const end = source.indexOf("exports.getQuickBooksStatus =", start);
assert.ok(start >= 0 && end > start, "disconnect controller source not found");
const section = source.slice(start, end);

function setup({ rows = [{ refresh_token: "test-refresh-token" }], revokeError = null, rowCount = 1, dbError = null } = {}) {
  const calls = { sql: [], revoked: [] };
  const pool = { async query(sql, args) {
    calls.sql.push({ sql, args });
    if (dbError && /DELETE/.test(sql)) throw dbError;
    return /SELECT/.test(sql) ? { rows } : { rowCount };
  } };
  const oauthClient = { async revoke(args) {
    calls.revoked.push(args);
    if (revokeError) throw revokeError;
  } };
  const exports = {};
  vm.runInNewContext(section, { exports, pool, oauthClient, console: { error() {} } });
  const response = {
    code: 200, payload: null,
    status(code) { this.code = code; return this; },
    json(body) { this.payload = body; return this; }
  };
  return { handler: exports.disconnectQuickBooks, calls, response };
}
async function invoke(options, body = { companyId: 12 }) {
  const ctx = setup(options);
  await ctx.handler({ body }, ctx.response);
  return ctx;
}
const deleted = ctx => ctx.calls.sql.filter(x => /DELETE/.test(x.sql));

test("successful revoke deletes only matching grant and reports success", async () => {
  const ctx = await invoke();
  assert.equal(ctx.response.code, 200);
  assert.equal(ctx.response.payload.disconnected, true);
  assert.equal(ctx.response.payload.authorizationAlreadyInvalid, false);
  assert.equal(ctx.calls.revoked.length, 1);
  assert.equal(ctx.calls.revoked[0].refresh_token, "test-refresh-token");
  assert.equal(deleted(ctx).length, 1);
  assert.equal(deleted(ctx)[0].args[1], "test-refresh-token");
});

test("explicit HTTP 400 invalid_token clears stale grant without claiming revocation", async () => {
  const ctx = await invoke({ revokeError: { response: { status: 400, data: { error: "invalid_token" } } } });
  assert.equal(ctx.response.code, 200);
  assert.equal(ctx.response.payload.authorizationAlreadyInvalid, true);
  assert.match(ctx.response.payload.message, /already invalid/);
  assert.equal(deleted(ctx).length, 1);
});

test("temporary Intuit outage retains local connection", async () => {
  const ctx = await invoke({ revokeError: { response: { status: 503 } } });
  assert.equal(ctx.response.code, 502);
  assert.equal(deleted(ctx).length, 0);
});

test("unauthorized client credentials are not mistaken for invalid token", async () => {
  const ctx = await invoke({ revokeError: { response: { status: 401, data: { error: "invalid_token" } } } });
  assert.equal(ctx.response.code, 502);
  assert.equal(deleted(ctx).length, 0);
});

test("generic HTTP 400 is not treated as invalid token", async () => {
  const ctx = await invoke({ revokeError: { response: { status: 400, data: { error: "invalid_request" } } } });
  assert.equal(ctx.response.code, 502);
  assert.equal(deleted(ctx).length, 0);
});

test("changed connection returns conflict instead of false success", async () => {
  const ctx = await invoke({ rowCount: 0 });
  assert.equal(ctx.response.code, 409);
  assert.equal(ctx.response.payload.disconnected, false);
});

test("already disconnected is idempotent", async () => {
  const ctx = await invoke({ rows: [] });
  assert.equal(ctx.response.code, 200);
  assert.equal(ctx.response.payload.disconnected, true);
  assert.equal(ctx.calls.revoked.length, 0);
  assert.equal(deleted(ctx).length, 0);
});

test("missing token requires support and does not revoke", async () => {
  const ctx = await invoke({ rows: [{ refresh_token: null }] });
  assert.equal(ctx.response.code, 409);
  assert.equal(ctx.calls.revoked.length, 0);
  assert.equal(deleted(ctx).length, 0);
});

test("invalid company ID does not query or revoke", async () => {
  const ctx = await invoke({}, { companyId: -1 });
  assert.equal(ctx.response.code, 400);
  assert.equal(ctx.calls.sql.length, 0);
});

test("database deletion failure is not reported as success", async () => {
  const ctx = await invoke({ dbError: new Error("database unavailable") });
  assert.equal(ctx.response.code, 500);
  assert.notEqual(ctx.response.payload.disconnected, true);
});
