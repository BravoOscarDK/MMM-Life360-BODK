"use strict";
// Exercise the installed native transport against a local mock, never Life360.
const http = require("node:http");
const assert = require("node:assert/strict");
const { Transport } = require("../lib/transport");
async function main() {
  const server = http.createServer((request, response) => {
    assert.equal(request.headers.authorization, "Bearer fictional-test-token");
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ circles: [{ id: "mock-circle", name: "Example family" }] }));
  });
  const transport = new Transport();
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const result = await transport.get({ baseUrl: `http://127.0.0.1:${server.address().port}`,
      token: "fictional-test-token", useImpersonation: true, requestTimeout: 5000 }, "/v3/circles", new AbortController().signal);
    assert.equal(result.circles[0].id, "mock-circle");
    console.log("Installed CycleTLS transport: local HTTP mock and native process cleanup OK");
  } finally {
    await transport.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
