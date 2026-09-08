import { useLocalSearchParams } from "expo-router";
import React from "react";
import CustomSrsSession from "../../../src/features/custom-srs/CustomSrsSession";

export default function CustomVocabularyReviews() {
  const { packId } = useLocalSearchParams<{ packId?: string }>();
  return <CustomSrsSession mode="reviews" packId={packId} />;
}
