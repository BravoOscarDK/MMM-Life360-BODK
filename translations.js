/* global module */
var Life360BodkTexts = (() => {
  const texts = {
    en: { loading: "Loading Life360…", empty: "No members found", unknown: "Unknown member", away: "Away from saved places", noLocation: "Location unavailable", sharingOff: "Location sharing is off", battery: "Battery", charging: "Charging", driving: "Driving", seen: "Last seen", stale: "Location may be outdated", configuration: "Check Life360 configuration and access token", auth: "Token expired or rejected. Supply a new token and restart", blocked: "Life360 blocked access. Check transport settings and restart", rateLimited: "Life360 rate limit reached. Retrying later", unavailable: "Life360 unavailable. Retrying later", circleMissing: "Configured circle not found", mapUnavailable: "No locations available for the map", updated: "Updated" },
    da: { loading: "Indlæser Life360…", empty: "Ingen medlemmer fundet", unknown: "Ukendt medlem", away: "Uden for gemte steder", noLocation: "Placering utilgængelig", sharingOff: "Placeringsdeling er slået fra", battery: "Batteri", charging: "Oplader", driving: "Kører", seen: "Sidst set", stale: "Placeringen kan være forældet", configuration: "Kontrollér Life360-konfiguration og adgangstoken", auth: "Token er udløbet eller afvist. Angiv et nyt token og genstart", blocked: "Life360 blokerede adgangen. Kontrollér forbindelsesindstillinger og genstart", rateLimited: "Life360-grænsen er nået. Prøver igen senere", unavailable: "Life360 er utilgængelig. Prøver igen senere", circleMissing: "Den valgte cirkel blev ikke fundet", mapUnavailable: "Ingen placeringer til kortet", updated: "Opdateret" }
  };
  texts.en.retryStopped = "Automatic updates stopped. Check settings and restart";
  texts.da.retryStopped = "Automatiske opdateringer stoppet. Kontrollér indstillinger og genstart";
  const language = value => String(value || "en").toLowerCase().split(/[-_]/)[0] === "da" ? "da" : "en";
  return { texts, language, t: (locale, key) => texts[language(locale)][key] ?? texts.en[key] ?? key };
})();
if (typeof module !== "undefined") module.exports = Life360BodkTexts;
