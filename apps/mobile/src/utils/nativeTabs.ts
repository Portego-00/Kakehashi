import { Platform } from "react-native";

export const supportsNativeTabs = () => {
  if (Platform.OS !== "ios") return false;

  const osVersion = Platform.Version;
  const majorVersion = typeof osVersion === "string"
    ? parseInt(osVersion.split(".")[0], 10)
    : osVersion;

  return majorVersion > 18;
};
