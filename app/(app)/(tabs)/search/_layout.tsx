import { Stack, useRouter } from "expo-router";
import { supportsNativeTabs } from "../../../../src/utils/nativeTabs";
import { nativeSearchBarRef } from "../../../../src/utils/nativeSearchBarRefs";
import { useNativeSearchBar } from "../../../../src/contexts/NativeSearchContext";

export default function SearchLayout() {
  const router = useRouter();
  const showNativeSearchBar = supportsNativeTabs();
  const canAttachSearchBar = useNativeSearchBar(showNativeSearchBar, nativeSearchBarRef);

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "",
          headerShown: showNativeSearchBar,
          headerTransparent: true,
          headerShadowVisible: false,
          headerSearchBarOptions: canAttachSearchBar
            ? {
                ref: nativeSearchBarRef,
                placement: "automatic",
                placeholder: "Search kanji, vocabulary, or meanings...",
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
