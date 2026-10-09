import { createWidget } from "expo-widgets";
import type { HomeWidgetProps } from "./homeWidget";
import KakehashiHomeWidget from "./homeWidgetLayout.ios";

export default createWidget<HomeWidgetProps>(
  "KakehashiHomeWidget",
  KakehashiHomeWidget,
);

export async function requestPinHomeWidget(): Promise<boolean> {
  return false;
}
