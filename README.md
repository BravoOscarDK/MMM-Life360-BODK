# MMM-Life360-BODK

## Description

A MagicMirror² module displaying Life360 circle members and their latest shared places. The member list is the default; the optional map is disabled with `showMap: false` and loads no map scripts or tiles in that mode. Supports English and Danish, multiple independent instances, circle/member filters and compact styling.

A **circle** is a Life360 group, not a geographic area. The module shows its members and the place name reported by Life360 (for example Home or Work), otherwise the reported address or an away/unknown status. It does not independently calculate geofences, detect arrivals, or request fresh phone locations. Place names and addresses remain unchanged in either UI language.

Inspired by [maxbethge/MMM-Life360](https://github.com/maxbethge/MMM-Life360). This is an **experimental integration using an unofficial API**. Live authentication and device behavior have not been validated. Life360 can change or block access; a valid token does not guarantee API access. See [NOTICE](NOTICE) for upstream attribution.

## Requirements

- A working MagicMirror² installation and a Node.js version supported by that installation, at least Node.js 22.
- A Life360 account with access to the desired circles and members sharing their locations.
- A valid Life360 access token and outbound HTTPS access to the API.
- The default `cycletls` transport runs a bundled native executable. Its published platform binaries include Linux x64/ARM/ARM64 and Windows x64; verify compatibility on the target Raspberry Pi/OS. No OS packages are installed by this module.
- Optional map: internet access to OpenStreetMap tiles. Leaflet scripts and CSS are installed locally by npm.

## Installation

The module is currently a local development repository. The following standard commands apply **after it has been published to the stated GitHub repository**; that remote is not created by this implementation:

```sh
cd ~/MagicMirror/modules
git clone https://github.com/BravoOscarDK/MMM-Life360-BODK.git
cd MMM-Life360-BODK
npm install
```

For a local checkout, copy the `MMM-Life360-BODK` directory into `~/MagicMirror/modules`, then run `npm install` there. Keep the folder name unchanged. Configure the module below and restart MagicMirror².

## Configuration

Insert this object into the `modules` array in `~/MagicMirror/config/config.js`:

```js
{
  module: "MMM-Life360-BODK",
  position: "top_right",
  header: "Life360",
  config: {
    language: "en",
    accessTokenEnv: "LIFE360_ACCESS_TOKEN",
    circleIds: [],
    showMap: false,
    showCircle: true,
    showLocation: true,
    showBattery: true,
    showLastSeen: true
  }
},
```

### Authentication and circle IDs

The recommended configuration reads `LIFE360_ACCESS_TOKEN` from the **MagicMirror² server process environment**. Set it in your shell or process manager before starting MagicMirror². Restart the server after changing it. Different instances can use different environment variable names. Tokens read this way remain on the server; direct `accessToken` values in MagicMirror² config can be exposed to its browser and take precedence over the environment variable.

This module does not implement password login, email-code login, token refresh or token persistence. Sign in to your own account using Life360's website and its normal authentication flow. In your browser's Developer Tools, inspect Network requests for an OAuth token response (`access_token`) or an authenticated API request (`Authorization: Bearer …`). Copy only the token value into your local server environment. Do not share the token, logs containing it, or screenshots of it. The exact web flow may change. The reference project's [token instructions](https://github.com/maxbethge/MMM-Life360#getting-an-access-token) provide additional guidance, but are not a guarantee of working access.

To restrict circles, inspect the authenticated `/v3/circles` response in the same browser session and copy the desired `id` values into `circleIds`. Member IDs are available in `/v3/circles/<circle-id>/members`. Empty arrays select all accessible circles/members. Members appearing in several selected circles are shown once, with all circle names and their newest available shared location. An explicitly selected but unavailable circle produces a configuration warning.

Alternatively set `accessToken: "YOUR_LIFE360_ACCESS_TOKEN"` in local configuration. Never commit a real token. A rejected token requires a new token and a restart; the module does not automatically log in or bypass an interactive challenge.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `language` | `"en"` | English or Danish; regional codes supported; unsupported/empty codes use English |
| `accessToken` | `""` | Explicit token; otherwise use the environment variable |
| `accessTokenEnv` | `"LIFE360_ACCESS_TOKEN"` | Server environment variable name; `""` disables environment lookup |
| `baseUrl` | `"https://api.life360.com"` | Other supported host: `https://api-cloudfront.life360.com` |
| `useImpersonation` | `true` | Use CycleTLS browser TLS transport; `false` uses native Node fetch |
| `circleIds` | `[]` | Include selected circle IDs; empty means all |
| `memberIds` | `[]` | Include selected member IDs; empty means all |
| `updateInterval` | `60000` | Delay after a completed poll in milliseconds; integer, minimum `30000` |
| `requestTimeout` | `20000` | Timeout per request in milliseconds, integer `1000`–`60000` |
| `width` | `"340px"` | CSS module width |
| `layout` | `"default"` | `default` or `compact` |
| `animationSpeed` | `300` | DOM animation duration in milliseconds; `0` disables animation |
| `maxMembers` | `0` | Maximum members in the list and map; `0` means all; sorted by name |
| `showMap` | `false` | Enable an OpenStreetMap view with member markers |
| `mapHeight` | `"260px"` | CSS map height |
| `mapZoom` | `13` | Zoom for one member and maximum auto zoom; integer `0`–`19` |
| `showCircle` | `true` | Display circle names |
| `showLocation` | `true` | Display reported place/address/status |
| `showAddress` | `true` | Use the address when no named place is reported; `false` shows an away/unknown label |
| `showBattery` | `true` | Battery percentage and charging status, when reported |
| `showDriving` | `true` | Driving indicator, when reported |
| `showLastSeen` | `true` | Localized date/time of the phone's location report |
| `showLastUpdate` | `false` | Last successful server poll time |
| `staleAfter` | `900000` | Age in milliseconds before warning about stale location/poll data; `0` warns immediately |

See [config.example.js](config.example.js). Standard MagicMirror² `header`, `position` and `classes` options work. Custom header text remains unchanged.

### Display and privacy

Use only information shared with your account. Location sharing off suppresses location, battery and driving data for that circle. Missing locations are shown as unavailable; timestamps are not replaced by the poll time. An error preserves the previous successful data with a visible warning. Stale data receives a warning even when last-seen text is hidden.

`showAddress: false` hides address text, but the optional map still uses coordinates. `showLocation: false` hides the location text independently of `showMap`. With `showMap: true`, the browser contacts OpenStreetMap's tile service for the visible area. Attribution stays visible; map interaction is disabled. Turn it off to avoid map requests entirely. Tile usage is subject to [OpenStreetMap's tile policy](https://operations.osmfoundation.org/policies/tiles/).

Override styles in `~/MagicMirror/css/custom.css`:

```css
.MMM-Life360-BODK .life360-bodk {
  --life360-gap: 8px;
  --life360-warning: #ffb454;
}
```

## Language

English is always the default regardless of MagicMirror²'s global language. Set `language: "da"` for Danish; `da-DK` is also accepted. Unsupported languages and missing translation keys fall back to English. Dates use the module's locale and device timezone without changing global date settings. Member names, circle names, custom labels and upstream place/address data are preserved.

## Updating

After publication, update the installed checkout:

```sh
cd ~/MagicMirror/modules/MMM-Life360-BODK
git pull --ff-only
npm install
```

Restart MagicMirror² using your normal startup method. For an unpublished local copy, replace the module source with the updated version, preserve your external config/environment settings, then run `npm install` and restart.

## Troubleshooting

- **Configuration warning:** supply a token; check ID arrays, supported HTTPS host, and interval/timeout ranges. Configuration is validated before API requests start.
- **401/token rejected:** capture a new token, update the server environment or local config, and restart. Automatic polling stops for this error.
- **403/access blocked:** access may be rejected by Life360 or its protection service. Check the default CycleTLS transport and target platform. You can try the other supported API host; success is not guaranteed. Polling stops to avoid repeated blocked requests. Restart after correcting settings.
- **429/network/server failure:** polling backs off exponentially, capped at 30 minutes, and stops after five consecutive failures. A message tells you when updates stop; check access and restart. There is no immediate retry loop. Polls never overlap within an instance.
- **No people or place names:** check circle/member filters, account access and sharing in Life360. Empty selected circles are valid. A named place appears only when upstream reports it; there is no local geofence engine or reverse geocoding.
- **CycleTLS cannot start:** run `npm install` on the target device, check binary/architecture compatibility and execution permissions. `useImpersonation: false` selects fetch explicitly, which may be blocked too. Native requests have a timeout and abort on suspension. CycleTLS requests in flight can finish up to their timeout when another instance still uses the process; their results are discarded. The native process closes when the final instance stops.
- **Map blank:** verify `showMap: true`, coordinates, tile connectivity and the installed Leaflet assets. No map service key is needed. This optional map still needs target-device visual validation.

Diagnostics contain error categories only, never response bodies, names, coordinates or tokens. No member data or tokens are cached on disk by the module. Tokens placed in the environment remain subject to your operating system and process manager's access controls.

## Validation

```sh
npm install
npm run check
npm test
npm run smoke
git diff --check
```

Checks cover JavaScript/config syntax, English defaults, Danish/regional selection and fallback, member normalization, sharing disabled, circle filtering, deduplication, error handling, instance isolation, polling cleanup, and list/map switch behavior. External requests and MagicMirror² lifecycle calls are mocked. `npm run smoke` additionally launches the installed CycleTLS executable, requests a local HTTP mock with a fictional token, and closes the process. Windows automated checks and that local smoke test have passed. These checks do not prove live Life360 access, token validity, map rendering in Electron, or Raspberry Pi support. Validate those on your target system with your account before relying on the display.

## License

MIT; see [LICENSE](LICENSE) and [NOTICE](NOTICE). This module is not affiliated with Life360.
