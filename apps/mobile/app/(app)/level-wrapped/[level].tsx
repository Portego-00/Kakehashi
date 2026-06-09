import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from "react-native";
import { WrappedContainer } from "../../../src/components/wrapped/WrappedContainer";
import { AccuracySlide } from "../../../src/components/wrapped/slides/AccuracySlide";
import { IntroSlide } from "../../../src/components/wrapped/slides/IntroSlide";
import { StarSlide } from "../../../src/components/wrapped/slides/StarSlide";
import { SubjectDropSlide } from "../../../src/components/wrapped/slides/SubjectDropSlide";
import { SummarySlide } from "../../../src/components/wrapped/slides/SummarySlide";
import { TimeSlide } from "../../../src/components/wrapped/slides/TimeSlide";
import { TroubleSlide } from "../../../src/components/wrapped/slides/TroubleSlide";
import { VolumeSlide } from "../../../src/components/wrapped/slides/VolumeSlide";
import { useWrappedData } from "../../../src/hooks/useWrappedData";

export default function LevelWrappedScreen() {
  const params = useLocalSearchParams();
  const level = parseInt(params.level as string);
  const data = useWrappedData(level);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)");
    }
  }, []);

  if (!level || isNaN(level)) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Invalid level</Text>
      </View>
    );
  }

  if (!data.isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Loading your wrapped...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <WrappedContainer onClose={handleClose} interactiveSlideIndex={7}>
        {/* Slide 0: Intro – shows the transition from completed level to new level */}
        <IntroSlide completedLevel={level} newLevel={level + 1} />

        {/* Slide 1: Radicals & kanji falling into place */}
        <SubjectDropSlide levelUpSubjects={data.levelUpSubjects} level={level} />

        {/* Slide 2: Time to complete */}
        <TimeSlide
          timeDays={data.timeDays}
          timeHours={data.timeHours}
          comparedToAverageDays={data.comparedToAverageDays}
          isFasterThanAverage={data.isFasterThanAverage}
        />

        {/* Slide 3: Volume of items */}
        <VolumeSlide
          totalSubjects={data.totalSubjects}
          radicalCount={data.radicalCount}
          kanjiCount={data.kanjiCount}
          vocabCount={data.vocabCount}
          totalReviews={data.totalReviews}
        />

        {/* Slide 4: Accuracy */}
        <AccuracySlide
          overallAccuracy={data.overallAccuracy}
          meaningAccuracy={data.meaningAccuracy}
          readingAccuracy={data.readingAccuracy}
        />

        {/* Slide 5: Trouble items */}
        <TroubleSlide mostMissed={data.mostMissed} />

        {/* Slide 6: Star performer */}
        <StarSlide
          starPerformer={data.starPerformer}
          fastestToGuru={data.fastestToGuru}
        />

        {/* Slide 7: Summary card (interactive — share button) */}
        <SummarySlide data={data} />
      </WrappedContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f0326",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    marginTop: 16,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#0f0326",
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#e53935",
    fontSize: 16,
    fontWeight: "500",
  },
});
