"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const zlib = require("node:zlib");
const texts = require("../translations");
const { normalize, merge } = require("../lib/members");
const { validate, Client, apiError } = require("../lib/client");
const { decode, Transport } = require("../lib/transport");
const circle = { id: "circle-a", name: "Example family" };
const member = { id: "person-a", firstName: "Alex", lastName: "Example", location: {
  name: "Home", latitude: "55", longitude: "12", battery: "0", timestamp: "1700000000", charge: "1", isDriving: "0"
} };
const config = extra => validate({ accessToken: "example-test-token", ...extra }, {});

test("module locale defaults to English and handles regional/unsupported language", () => {
  assert.equal(texts.t(undefined, "loading"), "Loading Life360…");
  assert.equal(texts.t("da-DK", "battery"), "Batteri");
  assert.equal(texts.t("DA_dk", "battery"), "Batteri");
  assert.equal(texts.t("fr-FR", "battery"), "Battery");
  assert.equal(texts.t("", "battery"), "Battery");
  texts.texts.en.testFallback = "English fallback";
  assert.equal(texts.t("da", "testFallback"), "English fallback");
  delete texts.texts.en.testFallback;
  assert.deepEqual(Object.keys(texts.texts.en).sort(), Object.keys(texts.texts.da).sort());
});
test("member fields preserve upstream labels, zero battery, timestamps and flags", () => {
  const result = normalize(member, circle);
  assert.equal(result.name, "Alex Example"); assert.equal(result.place, "Home");
  assert.equal(result.battery, 0); assert.equal(result.charging, true); assert.equal(result.driving, false);
  assert.equal(result.timestamp, 1700000000000);
  assert.equal(result.latitude, 55);
});
test("missing/invalid values never become zero coordinates or made-up dates", () => {
  const result = normalize({ id: "x", location: { latitude: "", longitude: "999", battery: "bad", timestamp: "bad" } }, circle);
  assert.equal(result.latitude, null); assert.equal(result.longitude, null);
  assert.equal(result.battery, null); assert.equal(result.timestamp, null);
});
test("sharing disabled removes sensitive location and status", () => {
  const result = normalize({ ...member, features: { shareLocation: "0" } }, circle);
  for (const key of ["latitude", "longitude", "battery", "timestamp"]) assert.equal(result[key], null);
  assert.equal(result.place, ""); assert.equal(result.address, ""); assert.equal(result.charging, false);
});
test("deduplication retains every circle and chooses newest shared location", () => {
  const result = merge([
    { circle, rows: [member] },
    { circle: { id: "circle-b", name: "Other family" }, rows: [{ ...member, location: { ...member.location, name: "School", timestamp: "1700000010" } }] },
    { circle: { id: "circle-c" }, rows: [{ ...member, features: { shareLocation: false } }] }
  ]);
  assert.equal(result.length, 1); assert.equal(result[0].place, "School"); assert.equal(result[0].circles.length, 3);
});
test("configuration resolves environment token and honors explicit false", () => {
  const result = validate({ accessTokenEnv: "TEST_TOKEN", useImpersonation: false }, { TEST_TOKEN: " example " });
  assert.equal(result.token, "example"); assert.equal(result.useImpersonation, false);
  assert.equal(config({ accessToken: "explicit" }).token, "explicit");
  assert.throws(() => validate({ accessTokenEnv: "" }, { LIFE360_ACCESS_TOKEN: "unused" }));
});
test("invalid credentials, hosts, intervals and filters are rejected before requests", () => {
  assert.throws(() => validate({}, {}));
  for (const invalid of [{ baseUrl: "http://api.life360.com" }, { baseUrl: "https://example.com" },
    { updateInterval: 0 }, { updateInterval: "60000" }, { requestTimeout: 0 },
    { requestTimeout: 60001 }, { circleIds: "a" }, { memberIds: [123] }, { useImpersonation: "false" }]) {
    assert.throws(() => config(invalid));
  }
});
test("client filters circles and members and safely encodes IDs", async () => {
  const calls = [];
  const client = new Client(config({ circleIds: ["a/b"], memberIds: ["person-a"] }), {
    get: async (_config, url) => {
      calls.push(url);
      return url === "/v3/circles" ? { circles: [{ id: "a/b" }, { id: "excluded" }] } : { members: [member, { id: "excluded" }] };
    }
  });
  const result = await client.load(new AbortController().signal);
  assert.equal(result.length, 1);
  assert.deepEqual(calls, ["/v3/circles", "/v3/circles/a%2Fb/members"]);
});
test("missing selected circle and failed member requests do not become empty success", async () => {
  await assert.rejects(new Client(config({ circleIds: ["missing"] }), { get: async () => ({ circles: [] }) }).load(), { code: "circleMissing" });
  await assert.rejects(new Client(config(), { get: async (_config, url) => {
    if (url === "/v3/circles") return { circles: [circle] };
    throw apiError(403);
  } }).load(), { code: "blocked" });
  await assert.rejects(new Client(config(), { get: async () => ({}) }).load(), /Missing circles/);
});
test("HTTP errors are safe categories without response data", () => {
  for (const [status, code] of [[401, "auth"], [403, "blocked"], [429, "rateLimited"], [500, "unavailable"]]) assert.equal(apiError(status).code, code);
});
test("CycleTLS decoding supports objects, bytes, gzip, brotli and retained encoding headers", () => {
  const data = { circles: [circle] }, bytes = Buffer.from(JSON.stringify(data));
  for (const response of [{ data }, { data: bytes }, { data: bytes.toJSON() },
    { data: zlib.gzipSync(bytes) }, { data: zlib.brotliCompressSync(bytes), headers: { "Content-Encoding": "br" } },
    { data: zlib.deflateSync(bytes), headers: { "content-encoding": "deflate" } },
    { data: bytes, headers: { "content-encoding": "gzip" } }]) assert.deepEqual(decode(response), data);
  assert.throws(() => decode({ data: "<html>blocked</html>" }));
});
test("native transport uses bearer header, forbids redirects and applies abort signal", async t => {
  t.mock.method(global, "fetch", async (url, options) => {
    assert.equal(url, "https://api.life360.com/v3/circles");
    assert.equal(options.headers.Authorization, "Bearer example-test-token");
    assert.equal(options.redirect, "error"); assert.equal(options.signal.aborted, false);
    return { ok: true, json: async () => ({ circles: [] }) };
  });
  const transport = new Transport(), controller = new AbortController();
  assert.deepEqual(await transport.get(config({ useImpersonation: false }), "/v3/circles", controller.signal), { circles: [] });
  controller.abort();
  await assert.rejects(transport.get(config(), "/v3/circles", controller.signal), { name: "AbortError" });
});

class Element {
  constructor() { this.children = []; this.style = {}; this.className = ""; this.textContent = ""; }
  appendChild(child) { this.children.push(child); return child; }
  text() { return [this.textContent, ...this.children.map(child => child.text())].join(" "); }
}
function frontend(leaflet) {
  let definition;
  const timers = new Map(); let nextTimer = 0;
  const context = { Module: { register: (_name, value) => { definition = value; } },
    Life360BodkTexts: texts, L: leaflet, document: { createElement: () => new Element() },
    setInterval: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearInterval: id => timers.delete(id),
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../MMM-Life360-BODK.js"), "utf8"), context);
  const messages = [], app = Object.assign({}, definition, { config: { ...definition.defaults },
    identifier: "instance-a", sendSocketNotification: (type, payload) => messages.push({ type, payload }), updateDom() {} });
  app.start(); return { app, messages, timers };
}
test("frontend English default ignores global language and disabled map loads no assets", () => {
  const { app } = frontend();
  assert.equal(app.config.language, "en"); assert.equal(app.config.showMap, false);
  assert.equal(app.getScripts().length, 1); assert.equal(app.getStyles().length, 1);
  assert.match(app.getDom().text(), /Loading Life360/);
  app.config.language = "da-DK"; assert.match(app.getDom().text(), /Indlæser Life360/);
  app.config.showMap = true; assert.equal(app.getScripts().length, 2); assert.equal(app.getStyles().length, 2);
});
test("list renders upstream places, hides addresses when configured and retains data on errors", () => {
  const { app } = frontend();
  const person = normalize({ ...member, location: { ...member.location, timestamp: String(Date.now() / 1000), name: "", address1: "Example address" } }, circle);
  app.socketNotificationReceived("LIFE360_STATUS", { id: "instance-a", members: [person], updated: Date.now(), error: null });
  assert.match(app.getDom().text(), /Example address/);
  app.config.showAddress = false; assert.doesNotMatch(app.getDom().text(), /Example address/);
  assert.match(app.getDom().text(), /Away from saved places/);
  app.socketNotificationReceived("LIFE360_STATUS", { id: "instance-a", error: "unavailable" });
  assert.match(app.getDom().text(), /Alex Example/); assert.match(app.getDom().text(), /Life360 unavailable/);
  app.config.language = "da"; assert.match(app.getDom().text(), /Life360 er utilgængelig/);
});
test("frontend ignores other instances and cleans timers on suspension/resume", () => {
  const { app, messages, timers } = frontend();
  app.configure(); assert.equal(timers.size, 1);
  app.socketNotificationReceived("LIFE360_STATUS", { id: "other", error: "auth" }); assert.equal(app.reading.error, null);
  app.suspend(); assert.equal(timers.size, 0); assert.equal(messages.at(-1).type, "LIFE360_STOP");
  app.resume(); app.configure(); assert.equal(timers.size, 1);
  app.suspend();
});
test("stale warning remains visible with timestamp display disabled", () => {
  const { app } = frontend(); app.config.showLastSeen = false;
  app.reading = { members: [normalize(member, circle)], updated: Date.now(), error: null };
  assert.match(app.getDom().text(), /Location may be outdated/);
  assert.doesNotMatch(app.getDom().text(), /Last seen/);
});
test("optional map creates markers, honors zoom zero and removes map on suspension", () => {
  let markers = 0, removed = 0, zoom;
  const map = { remove() { removed++; }, setView(_point, value) { zoom = value; } };
  const leaflet = { map: () => map, tileLayer: () => ({ addTo() {} }),
    circleMarker: () => { markers++; return { addTo() { return this; }, bindTooltip() {} }; } };
  const { app, timers } = frontend(leaflet);
  app.config.mapZoom = 0;
  app.mountMap({ isConnected: true }, [normalize(member, circle)]);
  const [id, fn] = [...timers][0]; timers.delete(id); fn();
  assert.equal(markers, 1); assert.equal(zoom, 0);
  app.suspend(); assert.equal(removed, 1); assert.equal(timers.size, 0);
});
test("map initialization stops after a bounded wait if its DOM is never mounted", () => {
  const { app, timers } = frontend();
  app.mountMap({ isConnected: false }, [normalize(member, circle)]);
  for (let count = 0; timers.size; count++) {
    assert.ok(count <= 30);
    const [id, fn] = [...timers][0]; timers.delete(id); fn();
  }
});

function helper(get) {
  let definition; const messages = [], timers = new Map(); let nextTimer = 0, closed = 0;
  class FakeTransport { async get(...args) { return get(...args); } async close() { closed++; } }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../node_helper.js"), "utf8"), {
    require: name => name === "node_helper" ? { create: value => { definition = value; return value; } } : name === "./lib/client" ? { Client, validate } : { Transport: FakeTransport },
    module: {}, AbortController, console: { warn() {} },
    setTimeout: (fn, delay) => { timers.set(++nextTimer, { fn, delay }); return nextTimer; }, clearTimeout: id => timers.delete(id)
  });
  const app = Object.assign({}, definition, { sendSocketNotification: (type, payload) => messages.push({ type, payload }) });
  app.start(); return { app, messages, timers, closed: () => closed };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test("backend isolates tokens/filters and cancels every session on stop", async () => {
  const tokens = [];
  const { app, messages, timers, closed } = helper(async (cfg, url) => {
    tokens.push(cfg.token); return url === "/v3/circles" ? { circles: [circle] } : { members: [member] };
  });
  app.socketNotificationReceived("LIFE360_CONFIG", { id: "a", config: { accessToken: "one" } });
  app.socketNotificationReceived("LIFE360_CONFIG", { id: "b", config: { accessToken: "two" } });
  await flush();
  assert.equal(messages.length, 2); assert.equal(timers.size, 2);
  assert.deepEqual(new Set(tokens), new Set(["one", "two"]));
  assert.equal(messages[0].payload.id, "a"); assert.equal(messages[1].payload.id, "b");
  const sessions = [...app.sessions.values()]; app.stop();
  assert.equal(timers.size, 0); assert.equal(closed(), 1);
  assert.ok(sessions.every(session => session.controller.signal.aborted));
});
test("backend rejects config without API work and stops retrying rejected tokens", async () => {
  let count = 0;
  const { app, messages, timers } = helper(async () => { count++; throw apiError(401); });
  app.socketNotificationReceived("LIFE360_CONFIG", { id: "bad", config: { accessToken: "x", updateInterval: 0 } });
  assert.equal(count, 0); assert.equal(messages[0].payload.error, "configuration");
  app.socketNotificationReceived("LIFE360_CONFIG", { id: "a", config: { accessToken: "example" } });
  await flush(); assert.equal(count, 1); assert.equal(timers.size, 0);
  assert.equal(messages.at(-1).payload.error, "auth"); assert.equal(messages.at(-1).payload.retryStopped, true);
  app.stop();
});
test("backend backs off and stops after five consecutive failures", async () => {
  const { app, messages, timers } = helper(async () => { throw new Error("private API details"); });
  app.socketNotificationReceived("LIFE360_CONFIG", { id: "a", config: { accessToken: "example" } });
  await flush();
  assert.equal([...timers.values()][0].delay, 120000);
  for (let i = 1; i < 5; i++) {
    const [id, timer] = [...timers.entries()][0]; timers.delete(id); timer.fn(); await flush();
  }
  assert.equal(messages.length, 5); assert.equal(timers.size, 0);
  assert.equal(messages.at(-1).payload.retryStopped, true);
  assert.doesNotMatch(JSON.stringify(messages), /private API details|example/);
  app.stop();
});
test("late results after suspension or reconfiguration are discarded", async () => {
  let resolveRequest;
  const { app, messages } = helper(() => new Promise(resolve => { resolveRequest = resolve; }));
  app.socketNotificationReceived("LIFE360_CONFIG", { id: "a", config: { accessToken: "example" } });
  app.socketNotificationReceived("LIFE360_STOP", { id: "a" });
  resolveRequest({ circles: [] }); await flush();
  assert.equal(messages.length, 0); assert.equal(app.sessions.size, 0);
});
