// Insert this object into the modules array in MagicMirror/config/config.js.
// Replace the token placeholder locally; never commit a real token.
{
  module: "MMM-Life360-BODK",
  position: "top_right",
  header: "Life360",
  config: {
    language: "en", // Set "da" for Danish.
    accessToken: "YOUR_LIFE360_ACCESS_TOKEN",
    baseUrl: "https://api.life360.com",
    useImpersonation: true,
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
