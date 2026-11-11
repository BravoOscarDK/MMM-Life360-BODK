/* global Module, Life360BodkTexts, L */
Module.register("MMM-Life360-BODK", {
  defaults: {
    language: "en", accessToken: "", accessTokenEnv: "LIFE360_ACCESS_TOKEN",
    baseUrl: "https://api.life360.com", useImpersonation: true,
    circleIds: [], memberIds: [], updateInterval: 60000, requestTimeout: 20000,
    width: "340px", layout: "default", animationSpeed: 300, maxMembers: 0,
    showMap: false, mapHeight: "260px", mapZoom: 13,
    showCircle: true, showLocation: true, showAddress: true, showBattery: true,
    showDriving: true, showLastSeen: true, showLastUpdate: false, staleAfter: 900000
  },
  getStyles() {
    return ["MMM-Life360-BODK.css", ...(this.config.showMap ? ["node_modules/leaflet/dist/leaflet.css"] : [])];
  },
  getScripts() {
    return ["translations.js", ...(this.config.showMap ? ["node_modules/leaflet/dist/leaflet.js"] : [])];
  },
  start() { this.reading = { members: [], updated: null, error: null }; this.paused = false; },
  notificationReceived(notification) {
    if (notification === "DOM_OBJECTS_CREATED") this.configure();
  },
  configure() {
    if (this.paused) return;
    clearInterval(this.clock);
    this.clock = setInterval(() => this.updateDom(0), 60000);
    const keys = ["accessToken", "accessTokenEnv", "baseUrl", "useImpersonation", "circleIds", "memberIds", "updateInterval", "requestTimeout"];
    const config = Object.fromEntries(keys.map(key => [key, this.config[key]]));
    this.sendSocketNotification("LIFE360_CONFIG", { id: this.identifier, config });
  },
  clearMap() {
    clearTimeout(this.mapTimer);
    if (this.map) { this.map.remove(); this.map = null; }
  },
  suspend() {
    this.paused = true; clearInterval(this.clock); this.clearMap();
    this.sendSocketNotification("LIFE360_STOP", { id: this.identifier });
  },
  resume() { this.paused = false; this.configure(); this.updateDom(0); },
  socketNotificationReceived(notification, payload) {
    if (notification !== "LIFE360_STATUS" || !payload || payload.id !== this.identifier || this.paused) return;
    this.reading = { ...this.reading, ...payload }; this.updateDom(this.config.animationSpeed);
  },
  t(key) { return Life360BodkTexts.t(this.config.language, key); },
  formatTime(timestamp) {
    return new Date(timestamp).toLocaleString(Life360BodkTexts.language(this.config.language), {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  },
  getDom() {
    this.clearMap();
    const root = document.createElement("div"), c = this.config, r = this.reading;
    root.className = `life360-bodk ${c.layout === "compact" ? "life360-compact" : ""}`;
    root.style.width = c.width;
    const add = (parent, text, className = "") => {
      const element = document.createElement("div"); element.className = className;
      element.textContent = text; parent.appendChild(element); return element;
    };
    if (r.error) add(root, this.t(r.error), "life360-warning small");
    if (r.retryStopped) add(root, this.t("retryStopped"), "life360-warning xsmall");
    if (!r.updated) {
      if (!r.error) add(root, this.t("loading"), "dimmed small");
      return root;
    }
    const members = [...r.members].sort((a, b) => a.name.localeCompare(b.name, Life360BodkTexts.language(c.language)));
    const visible = Number.isInteger(c.maxMembers) && c.maxMembers > 0 ? members.slice(0, c.maxMembers) : members;
    if (!visible.length) add(root, this.t("empty"), "dimmed small");
    if (c.showMap && !this.paused) {
      const points = visible.filter(member => member.sharing && member.latitude !== null && member.longitude !== null);
      if (points.length && typeof L !== "undefined") {
        const container = add(root, "", "life360-map"); container.style.height = c.mapHeight;
        this.mountMap(container, points);
      } else add(root, this.t("mapUnavailable"), "dimmed small");
    }
    for (const member of visible) {
      const row = add(root, "", "life360-member");
      add(row, member.name || this.t("unknown"), "life360-name bright");
      if (c.showCircle) add(row, member.circles.map(circle => circle.name).filter(Boolean).join(" · "), "life360-circle dimmed xsmall");
      if (c.showLocation) {
        const located = member.latitude !== null && member.longitude !== null;
        const place = !member.sharing ? this.t("sharingOff") : member.place ||
          (c.showAddress && member.address) || this.t(located ? "away" : "noLocation");
        add(row, place, "life360-location small");
      }
      const meta = [];
      if (c.showBattery && member.battery !== null) meta.push(`${this.t("battery")}: ${Math.round(member.battery)}%${member.charging ? ` · ${this.t("charging")}` : ""}`);
      if (c.showDriving && member.driving) meta.push(this.t("driving"));
      if (meta.length) add(row, meta.join(" · "), "life360-meta dimmed xsmall");
      if (c.showLastSeen && member.timestamp) add(row, `${this.t("seen")}: ${this.formatTime(member.timestamp)}`, "life360-seen dimmed xsmall");
      if ((member.timestamp && Date.now() - member.timestamp > c.staleAfter) || (r.updated && Date.now() - r.updated > c.staleAfter)) add(row, this.t("stale"), "life360-warning xsmall");
    }
    if (c.showLastUpdate) add(root, `${this.t("updated")}: ${this.formatTime(r.updated)}`, "dimmed xsmall");
    return root;
  },
  mountMap(container, members, attempt = 0) {
    this.mapTimer = setTimeout(() => {
      if (this.paused) return;
      if (!container.isConnected) {
        if (attempt < 30) this.mountMap(container, members, attempt + 1);
        return;
      }
      this.map = L.map(container, { zoomControl: false, dragging: false, scrollWheelZoom: false,
        doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19
      }).addTo(this.map);
      const points = members.map(member => [member.latitude, member.longitude]);
      members.forEach((member, index) => {
        const label = document.createElement("span"); label.textContent = member.name || this.t("unknown");
        L.circleMarker(points[index], { radius: 7, color: "#fff", fillColor: "#5fa8e8", fillOpacity: 0.9 }).addTo(this.map).bindTooltip(label);
      });
      const zoom = Number.isInteger(this.config.mapZoom) && this.config.mapZoom >= 0 && this.config.mapZoom <= 19 ? this.config.mapZoom : 13;
      if (points.length === 1) this.map.setView(points[0], zoom);
      else this.map.fitBounds(points, { padding: [20, 20], maxZoom: zoom });
    }, 100);
  }
});
