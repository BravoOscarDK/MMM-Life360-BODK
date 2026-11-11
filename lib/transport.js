"use strict";
const zlib = require("node:zlib");
const net = require("node:net");
const { apiError } = require("./client");
// Browser fingerprint follows the MIT-licensed MMM-Life360 reference; see NOTICE.
const JA3 = "771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-51-57-47-53-10,0-23-65281-10-11-35-16-5-51-43-13-45-28-21,29-23-24-25-256-257,0";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
function decode(response) {
  const data = response.data;
  if (data && typeof data === "object" && !Buffer.isBuffer(data) && !Array.isArray(data) && !data.data && !(data instanceof ArrayBuffer)) return data;
  let buffer = Buffer.from(data?.data || (data instanceof ArrayBuffer ? new Uint8Array(data) : data) || "");
  // Some clients already decode the body but retain the encoding header.
  try { return JSON.parse(buffer.toString("utf8")); } catch { /* Try compressed bytes. */ }
  const encoding = Object.entries(response.headers || {}).find(([key]) => key.toLowerCase() === "content-encoding")?.[1];
  const options = { maxOutputLength: 4 * 1024 * 1024 };
  if ((buffer[0] === 31 && buffer[1] === 139) || String(encoding).includes("gzip")) buffer = zlib.gunzipSync(buffer, options);
  else if (String(encoding).includes("br")) buffer = zlib.brotliDecompressSync(buffer, options);
  else if (String(encoding).includes("deflate")) buffer = zlib.inflateSync(buffer, options);
  return JSON.parse(buffer.toString("utf8"));
}
class Transport {
  constructor() { this.pending = null; this.closed = false; }
  async cycle() {
    if (this.closed) throw new Error("Transport closed");
    if (!this.pending) this.pending = this.openCycle().then(async client => {
      if (this.closed) { await client.exit(); throw new Error("Transport closed"); }
      return client;
    });
    return this.pending;
  }
  async openCycle() {
    // Isolate reconfigured helpers from processes that are still shutting down.
    const port = await new Promise((resolve, reject) => {
      const server = net.createServer(); server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const assigned = server.address().port;
        server.close(error => error ? reject(error) : resolve(assigned));
      });
    });
    if (this.closed) throw new Error("Transport closed");
    return require("cycletls")({ port, timeout: 10000 });
  }
  async get(config, path, signal) {
    signal.throwIfAborted();
    const headers = { Accept: "application/json", Authorization: `Bearer ${config.token}` };
    const url = config.baseUrl + path;
    if (config.useImpersonation) {
      const client = await this.cycle();
      signal.throwIfAborted();
      const response = await client(url, { headers, body: "", ja3: JA3, userAgent: UA,
        timeout: Math.ceil(config.requestTimeout / 1000), disableRedirect: true }, "get");
      signal.throwIfAborted();
      if (response.status < 200 || response.status >= 300) throw apiError(response.status);
      return decode(response);
    }
    const response = await fetch(url, { headers, redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(config.requestTimeout)]) });
    if (!response.ok) throw apiError(response.status);
    return response.json();
  }
  async close() {
    this.closed = true;
    if (this.pending) { try { const client = await this.pending; await client.exit(); } catch { /* Initialization failed or already closed. */ } }
  }
}
module.exports = { Transport, decode };
