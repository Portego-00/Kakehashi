import React from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BunproDetailsContent } from "../components/bunpro/bunpro-details-content";
import { useAuthStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import { isPortegoUsername } from "../utils/portegoAccess";

export default function BunproReviewableDetailsScreen() {
  const params = useLocalSearchParams<{ kind?: string; slug?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  let slug = params.slug ?? "";
  try { slug = decodeURIComponent(slug); } catch { /* Preserve malformed slugs for the API's validation. */ }
  const kind = params.kind === "vocab" ? "vocab" : "grammar";
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderBottomColor: theme.border, borderBottomWidth: 1 }}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ minHeight: 48, paddingVertical: 12, paddingRight: 24 }}><Text style={{ color: theme.textColor }}>‹ Back</Text></Pressable><Text style={{ color: theme.textColor, fontWeight: "600" }}>Bunpro {kind === "vocab" ? "vocabulary" : "grammar"}</Text></View>
    {isPortegoUsername(userData?.username) ? <BunproDetailsContent key={`${kind}:${slug}`} kind={kind} slug={slug} /> : <Text style={{ padding: 24, color: theme.textColor }}>Bunpro is currently available only for the Portego account.</Text>}
  </SafeAreaView>;
}
