import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BunproNativeDetails, type BunproDetailKind } from "../components/bunpro/bunpro-native-details";

function decodeParam(value: string | string[] | undefined): string {
  const text = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  try { return decodeURIComponent(text); } catch { return text; }
}

export default function BunproReviewableDetailsScreen() {
  const params = useLocalSearchParams<{ kind?: string; slug?: string; tab?: string }>();
  const router = useRouter();
  const kind = decodeParam(params.kind) as BunproDetailKind;
  const slug = decodeParam(params.slug);
  return <BunproNativeDetails key={`${kind}:${slug}`} kind={kind} slug={slug} initialTab={params.tab === "Context" ? "Context" : "Meaning"} onBack={() => router.back()} />;
}
