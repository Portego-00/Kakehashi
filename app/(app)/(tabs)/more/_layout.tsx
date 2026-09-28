import { Stack } from "expo-router";
import { TAB_INFO } from "../../../../src/utils/tabNavigation";
export default function MoreLayout() {
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" options={{ title: "More" }} />
    {TAB_INFO.filter(tab => !tab.isRequired).map(tab => <Stack.Screen key={tab.id} name={tab.id} options={{ title: tab.label }} />)}
  </Stack>;
}
