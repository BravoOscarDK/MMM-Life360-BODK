#!/usr/bin/env node
"use strict";
// Token diagnostics inspired by maxbethge/MMM-Life360; see NOTICE.
const { validate } = require("./lib/client");
const { Transport } = require("./lib/transport");

async function diagnose(token, { createTransport = () => new Transport(), log = console.log } = {}) {
  // Validate before opening a transport or sending any requests.
  const config = validate({ accessToken: token });
  let winner;
  for (const baseUrl of ["https://api.life360.com", "https://api-cloudfront.life360.com"]) {
    for (const useImpersonation of [true, false]) {
      const transport = createTransport();
      const label = `${useImpersonation ? "CycleTLS" : "fetch"} ${baseUrl}`;
      try {
        const data = await transport.get({ ...config, baseUrl, useImpersonation }, "/v3/circles", new AbortController().signal);
        if (!Array.isArray(data?.circles)) {
          log(`${label}: INVALID RESPONSE (expected circles array)`);
          continue;
        }
        log(`${label}: SUCCESS (${data.circles.length} circles)`);
        winner ??= { baseUrl, useImpersonation };
      } catch (error) {
        // Never print arbitrary exceptions or response bodies: they may contain secrets.
        const reasons = { auth: "UNAUTHORIZED: token invalid or expired", blocked: "ACCESS BLOCKED: HTTP 403 does not identify the cause",
          rateLimited: "RATE LIMITED: wait before trying again" };
        log(`${label}: ${reasons[error.code] || "REQUEST FAILED: check network, transport installation and API response"}`);
        if (error.code === "rateLimited") return false;
      } finally {
        await transport.close();
      }
    }
  }
  if (winner) {
    log(`Use baseUrl: ${JSON.stringify(winner.baseUrl)}, useImpersonation: ${winner.useImpersonation} in your module config, then restart MagicMirror².`);
  } else {
    log("No combination succeeded. Check your token, network and CycleTLS installation. See README Troubleshooting.");
  }
  return Boolean(winner);
}

async function main(args = process.argv.slice(2), env = process.env) {
  if (args.includes("--help")) {
    console.log("Usage: node diagnose.js [--token]\nSet LIFE360_ACCESS_TOKEN (or LIFE360_TOKEN), or paste a token at the prompt.\nTests /v3/circles on both supported hosts with CycleTLS and fetch. No password login.\nExit codes: 0 = at least one success; 1 = failed, rate limited or invalid input.");
    return true;
  }
  if (args.some(arg => arg !== "--token")) throw new Error("Unsupported arguments");
  let token = env.LIFE360_ACCESS_TOKEN || env.LIFE360_TOKEN;
  if (!token) {
    if (!process.stdin.isTTY) throw new Error("Token required");
    const readline = require("node:readline/promises");
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    try { token = await prompt.question("Paste Life360 access token (input is visible locally): "); }
    finally { prompt.close(); }
  }
  return diagnose(token.replace(/^Bearer\s+/i, "").trim());
}

if (require.main === module) {
  main().then(ok => { process.exitCode = ok ? 0 : 1; }).catch(() => {
    console.error("Diagnostics failed. Set LIFE360_ACCESS_TOKEN or run node diagnose.js --token in a terminal. Use --help for usage.");
    process.exitCode = 1;
  });
}
module.exports = { diagnose, main };
