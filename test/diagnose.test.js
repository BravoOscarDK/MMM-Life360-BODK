"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { diagnose } = require("../diagnose");

test("diagnostics test all combinations, close transports and keep private data out of output", async () => {
  const calls = [], logs = [];
  let closed = 0;
  const ok = await diagnose("fictional-secret", {
    log: line => logs.push(line),
    createTransport: () => ({
      get: async (config, path) => { calls.push([config.baseUrl, config.useImpersonation, path]); return { circles: [{ name: "private-name" }] }; },
      close: async () => { closed++; }
    })
  });
  assert.equal(ok, true);
  assert.equal(new Set(calls.map(call => JSON.stringify(call))).size, 4);
  assert.equal(closed, 4);
  assert.doesNotMatch(logs.join("\n"), /fictional-secret|private-name/);
});

test("diagnostics reject malformed success and redact transport errors", async () => {
  let closed = 0;
  const logs = [];
  assert.equal(await diagnose("fictional-secret", {
    log: line => logs.push(line),
    createTransport: () => ({
      get: async config => { if (config.useImpersonation) throw new Error("fictional-secret"); return {}; },
      close: async () => { closed++; }
    })
  }), false);
  assert.equal(closed, 4);
  assert.doesNotMatch(logs.join("\n"), /fictional-secret/);
});

test("rate limiting stops further probes and closes transport", async () => {
  let closed = 0;
  assert.equal(await diagnose("fictional-secret", {
    log: () => {},
    createTransport: () => ({
      get: async () => { throw Object.assign(new Error("private"), { code: "rateLimited" }); },
      close: async () => { closed++; }
    })
  }), false);
  assert.equal(closed, 1);
});

test("missing token fails before transport initialization", async () => {
  await assert.rejects(diagnose("", { createTransport: () => { assert.fail("transport started"); } }));
});
