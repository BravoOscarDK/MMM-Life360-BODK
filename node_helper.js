"use strict";
const NodeHelper = require("node_helper");
const { Client, validate } = require("./lib/client");
const { Transport } = require("./lib/transport");
module.exports = NodeHelper.create({
  start() { this.sessions = new Map(); this.transport = null; },
  stop() {
    for (const id of this.sessions.keys()) this.remove(id);
  },
  remove(id) {
    const session = this.sessions.get(id);
    if (!session) return;
    clearTimeout(session.timer); session.controller.abort(); this.sessions.delete(id);
    if (!this.sessions.size && this.transport) {
      void this.transport.close(); this.transport = null;
    }
  },
  socketNotificationReceived(notification, payload) {
    if (!payload || typeof payload.id !== "string") return;
    if (notification === "LIFE360_STOP") { this.remove(payload.id); return; }
    if (notification !== "LIFE360_CONFIG") return;
    this.remove(payload.id);
    let config;
    try { config = validate(payload.config); }
    catch (error) {
      console.warn(`[MMM-Life360-BODK] Invalid configuration: ${error.message}. See README.`);
      this.sendSocketNotification("LIFE360_STATUS", { id: payload.id, error: "configuration" }); return;
    }
    if (!this.transport) this.transport = new Transport();
    const session = { controller: new AbortController(), config, failures: 0 };
    session.client = new Client(config, this.transport);
    this.sessions.set(payload.id, session);
    void this.poll(payload.id, session);
  },
  async poll(id, session) {
    if (this.sessions.get(id) !== session) return;
    let terminal = false;
    try {
      const members = await session.client.load(session.controller.signal);
      if (this.sessions.get(id) !== session) return;
      session.failures = 0;
      this.sendSocketNotification("LIFE360_STATUS", { id, members, updated: Date.now(), error: null, retryStopped: false });
    } catch (error) {
      if (this.sessions.get(id) !== session) return;
      session.failures++;
      const code = ["auth", "blocked", "rateLimited", "circleMissing"].includes(error.code) ? error.code : "unavailable";
      terminal = ["auth", "blocked", "circleMissing"].includes(code);
      if (session.failures >= 5) terminal = true;
      // Never log API bodies, credentials, names or locations.
      console.warn(`[MMM-Life360-BODK] Request failed: ${code}. ${terminal ? "Update configuration and restart." : "Retrying with backoff."}`);
      this.sendSocketNotification("LIFE360_STATUS", { id, error: code, retryStopped: terminal });
    }
    if (!terminal && this.sessions.get(id) === session) {
      const delay = Math.min(1800000, session.config.updateInterval * 2 ** Math.min(session.failures, 5));
      session.timer = setTimeout(() => void this.poll(id, session), delay);
    }
  }
});
