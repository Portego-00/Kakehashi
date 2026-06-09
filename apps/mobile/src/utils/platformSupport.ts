import { Platform } from "react-native";

type PlatformConstants = {
  interfaceIdiom?: string;
  isMacCatalyst?: boolean;
  systemName?: string;
};

export function isIOSOnMac(): boolean {
  if (Platform.OS !== "ios") {
    return false;
  }

  const constants = Platform.constants as PlatformConstants | undefined;
  const interfaceIdiom = constants?.interfaceIdiom;
  const systemName = constants?.systemName?.toLowerCase();
  const isMacCatalyst = constants?.isMacCatalyst === true;

  return (
    interfaceIdiom === "mac" ||
    isMacCatalyst ||
    systemName === "macos" ||
    systemName === "mac os"
  );
}

export function supportsBadgeAndReviewNotifications(): boolean {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return false;
  }

  return !isIOSOnMac();
}
