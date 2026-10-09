import type { Widget } from "expo-widgets";
import type { HomeWidgetProps } from "./homeWidget";

export type HomeWidgetController = Pick<
  Widget<HomeWidgetProps>,
  "updateSnapshot" | "updateTimeline" | "reload" | "getTimeline"
>;

const controller: HomeWidgetController = {
  updateSnapshot: () => {},
  updateTimeline: () => {},
  reload: () => {},
  getTimeline: async () => [],
};

export default controller;

export async function requestPinHomeWidget(): Promise<boolean> {
  return false;
}
