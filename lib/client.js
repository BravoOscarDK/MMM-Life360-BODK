"use strict";
const { merge } = require("./members");
const HOSTS = ["https://api.life360.com", "https://api-cloudfront.life360.com"];

function validate(config, env = process.env) {
  if (!config || typeof config !== "object") throw new Error("Invalid configuration");
  for (const key of ["accessToken", "accessTokenEnv", "baseUrl"]) {
    if (config[key] !== undefined && typeof config[key] !== "string") throw new Error(`${key} must be a string`);
  }
  const baseUrl = config.baseUrl ?? HOSTS[0];
  if (!HOSTS.includes(baseUrl)) throw new Error("baseUrl must be a supported HTTPS Life360 host");
  const token = config.accessToken || env[config.accessTokenEnv ?? "LIFE360_ACCESS_TOKEN"];
  if (typeof token !== "string" || !token.trim() || /[\r\n]/.test(token)) throw new Error("Set accessToken or the server-side token environment variable");
  const updateInterval = config.updateInterval ?? 60000;
  const requestTimeout = config.requestTimeout ?? 20000;
  if (!Number.isInteger(updateInterval) || updateInterval < 30000) throw new Error("updateInterval must be at least 30000 ms");
  if (!Number.isInteger(requestTimeout) || requestTimeout < 1000 || requestTimeout > 60000) throw new Error("requestTimeout must be between 1000 and 60000 ms");
  for (const key of ["circleIds", "memberIds"]) {
    if (config[key] !== undefined && (!Array.isArray(config[key]) || config[key].some(id => typeof id !== "string" || !id))) throw new Error(`${key} must be an array of non-empty strings`);
  }
  if (config.useImpersonation !== undefined && typeof config.useImpersonation !== "boolean") throw new Error("useImpersonation must be boolean");
  return { baseUrl, token: token.trim(), updateInterval, requestTimeout,
    circleIds: config.circleIds ?? [], memberIds: config.memberIds ?? [], useImpersonation: config.useImpersonation ?? true };
}
function apiError(status) {
  const code = status === 401 ? "auth" : status === 403 ? "blocked" : status === 429 ? "rateLimited" : "unavailable";
  return Object.assign(new Error(`Life360 request failed (HTTP ${status})`), { code, status });
}
class Client {
  constructor(config, transport) { this.config = config; this.transport = transport; }
  async get(path, signal) {
    const data = await this.transport.get(this.config, path, signal);
    if (!data || typeof data !== "object") throw Object.assign(new Error("Invalid Life360 response"), { code: "unavailable" });
    return data;
  }
  async load(signal) {
    const data = await this.get("/v3/circles", signal);
    if (!Array.isArray(data.circles)) throw new Error("Missing circles in Life360 response");
    const circles = data.circles.filter(circle => !this.config.circleIds.length || this.config.circleIds.includes(String(circle.id)));
    if (this.config.circleIds.some(id => !circles.some(circle => String(circle.id) === id))) throw Object.assign(new Error("Configured circle not found"), { code: "circleMissing" });
    const groups = [];
    for (const circle of circles) {
      const result = await this.get(`/v3/circles/${encodeURIComponent(circle.id)}/members`, signal);
      if (!Array.isArray(result.members)) throw new Error("Missing members in Life360 response");
      groups.push({ circle, rows: result.members });
    }
    return merge(groups).filter(member => !this.config.memberIds.length || this.config.memberIds.includes(member.id));
  }
}
module.exports = { Client, validate, apiError };
