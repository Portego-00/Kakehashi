import { requireOptionalNativeModule } from "expo-modules-core";
import type { HomeWidgetController } from "./homeWidgetController";
import type { HomeWidgetProps } from "./homeWidget";

type NativeEntry = { timestamp: number; props: HomeWidgetProps };
type NativeHomeWidget = {
  updateSnapshot: (json: string) => void;
  updateTimeline: (json: string) => void;
  reload: () => void;
  getTimeline: () => Promise<string>;
  requestPin: () => Promise<boolean>;
};

const nativeWidget = requireOptionalNativeModule<NativeHomeWidget>("KakehashiHomeWidget");

const controller: HomeWidgetController = {
  updateSnapshot: (props) => nativeWidget?.updateSnapshot(JSON.stringify(props)),
  updateTimeline: (entries) => nativeWidget?.updateTimeline(JSON.stringify(
    entries.map(({ date, props }) => ({ timestamp: date.getTime(), props })),
  )),
  reload: () => nativeWidget?.reload(),
  getTimeline: async () => {
    const entries: NativeEntry[] = JSON.parse(await nativeWidget?.getTimeline() ?? "[]");
    return entries.map(({ timestamp, props }) => ({ date: new Date(timestamp), props }));
  },
};

export default controller;

export async function requestPinHomeWidget(): Promise<boolean> {
  return await nativeWidget?.requestPin() ?? false;
}
