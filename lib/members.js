"use strict";

const flag = value => value === true || value === 1 || value === "1";
function number(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function normalize(raw, circle) {
  const location = raw.location || {};
  const shared = raw.features?.shareLocation;
  const sharing = shared === undefined || flag(shared);
  const lat = number(location.latitude), lon = number(location.longitude);
  const battery = number(location.battery), timestamp = number(location.timestamp);
  return {
    id: String(raw.id), name: [raw.firstName, raw.lastName].filter(Boolean).join(" "),
    circles: [{ id: String(circle.id), name: circle.name || "" }], sharing,
    place: sharing ? String(location.name || "") : "",
    address: sharing ? [location.address1, location.address2].filter(Boolean).join(", ") : "",
    latitude: sharing && lat !== null && Math.abs(lat) <= 90 ? lat : null,
    longitude: sharing && lon !== null && Math.abs(lon) <= 180 ? lon : null,
    battery: sharing && battery !== null && battery >= 0 && battery <= 100 ? battery : null,
    charging: sharing && flag(location.charge), driving: sharing && flag(location.isDriving),
    timestamp: sharing && timestamp !== null && timestamp > 0 ? timestamp * 1000 : null
  };
}
function merge(groups) {
  const members = new Map();
  for (const { circle, rows } of groups) for (const raw of rows) {
    if (!raw || raw.id === undefined || raw.id === null) continue;
    const next = normalize(raw, circle), previous = members.get(next.id);
    if (!previous) { members.set(next.id, next); continue; }
    const circles = [...previous.circles, ...next.circles];
    // Sharing is circle-specific: keep the latest location actually shared with us.
    const chosen = next.sharing && (!previous.sharing || (next.timestamp || 0) > (previous.timestamp || 0)) ? next : previous;
    members.set(next.id, { ...chosen, circles });
  }
  return [...members.values()];
}
module.exports = { normalize, merge };
