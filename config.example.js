// Insert this object into the modules array in MagicMirror/config/config.js.
// Prefer a server environment variable; never commit a real token.
{
  module: "MMM-Life360-BODK",
  position: "top_right",
  header: "Life360",
  config: {
    language: "en", // Set "da" for Danish.
    accessTokenEnv: "LIFE360_ACCESS_TOKEN",
    // accessToken: "YOUR_LIFE360_ACCESS_TOKEN",
    circleIds: [], // Empty = all circles accessible to your account.
    memberIds: [], // Empty = all members in the selected circles.
    showMap: false,
    width: "340px",
    layout: "default",
    showCircle: true,
    showLocation: true,
    showAddress: true,
    showBattery: true,
    showDriving: true,
    showLastSeen: true,
    showLastUpdate: false,
    updateInterval: 60000
  }
}
