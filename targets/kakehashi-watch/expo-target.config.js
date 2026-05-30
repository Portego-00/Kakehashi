/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "watch",
  name: "Kakehashi Watch",
  displayName: "Kakehashi",
  bundleIdentifier: ".watch",
  deploymentTarget: "10.0",
  icon: "../../assets/images/icon.png",
  frameworks: ["SwiftUI", "WatchConnectivity"],
  colors: {
    $accent: "#2563EB",
    bridgeBlue: "#2563EB",
    bridgeTeal: "#14B8A6",
    sunrise: "#F97316",
  },
});
