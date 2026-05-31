import { Stack, useRouter } from "expo-router";
import SubjectSearchScreen from "../../src/screens/SubjectSearchScreen";
import { supportsNativeTabs } from "../../src/utils/nativeTabs";

export default function ReviewSearchScreen() {
  const router = useRouter();
  const showNativeSearchBar = supportsNativeTabs();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerBackButtonDisplayMode: "minimal",
          headerTransparent: showNativeSearchBar,
          headerShadowVisible: !showNativeSearchBar,
          // @ts-ignore iOS-only native search bar options
          headerSearchBarOptions: showNativeSearchBar
            ? {
                placement: "automatic",
                placeholder: "Search kanji, vocabulary, or meanings...",
                autoFocus: true,
                hideNavigationBar: false,
                onChangeText: (
                  event: { nativeEvent?: { text?: string } } | undefined
                ) => {
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
      <SubjectSearchScreen
        forceInlineSearchBar={!showNativeSearchBar}
        topPadding={showNativeSearchBar ? 60 : 12}
        showNativeTopTitle={false}
      />
    </>
  );
}
