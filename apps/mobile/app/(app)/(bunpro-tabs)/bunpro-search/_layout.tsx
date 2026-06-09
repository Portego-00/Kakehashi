import { Stack, useRouter } from "expo-router";
import { supportsNativeTabs } from "../../../../src/utils/nativeTabs";
import { bunproNativeSearchBarRef } from "./searchBarRef";

export default function BunproSearchLayout() {
  const router = useRouter();
  const showNativeSearchBar = supportsNativeTabs();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "",
          headerShown: showNativeSearchBar,
          headerTransparent: true,
          headerShadowVisible: false,
          // @ts-ignore
          headerSearchBarOptions: showNativeSearchBar
            ? {
                ref: bunproNativeSearchBarRef,
                placement: "automatic",
                placeholder: "Search Bunpro grammar or vocabulary...",
                autoFocus: true,
                onChangeText: (event) => {
                  const text = event?.nativeEvent?.text ?? "";
                  router.setParams({ query: text });
                },
                onCancelButtonPress: () => {
                  router.setParams({ query: "" });
                },
              }
            : undefined,
        }}
      />
    </Stack>
  );
}
