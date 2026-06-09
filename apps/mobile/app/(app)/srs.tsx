import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SrsBreakdown from '../../src/components/SrsBreakdown';
import { SrsLevel } from '../../src/types/wanikani';
import { fetchAllPages, getAssignments, getSubjects } from '../../src/utils/api';
import { useAuthStore } from '../../src/utils/store';
import { SRS_COLORS } from '../../src/constants/srsColors';

export default function SrsScreen() {
  const { apiToken } = useAuthStore();
  const [levels, setLevels] = useState<SrsLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSrsData = useCallback(async () => {
    if (!apiToken) return;

    try {
      setIsLoading(true);
      console.log("Fetching SRS data...");

      // Fetch initial assignments
      const initialAssignmentsResponse = await getAssignments(apiToken);
      console.log(`Initial assignments count: ${initialAssignmentsResponse.data.length}`);
      
      // Handle pagination to get all assignments, not just the first 500
      const assignments = await fetchAllPages(initialAssignmentsResponse, apiToken);
      console.log(`Total assignments after pagination: ${assignments.data.length}`);

      // Get all subject IDs from assignments
      const subjectIds = assignments.data.map(a => a.data.subject_id);
      console.log(`Found ${subjectIds.length} unique subject IDs`);

      // Fetch all subjects
      const subjects = await getSubjects(apiToken, { ids: subjectIds }, { skipCollectionCache: true });
      console.log(`Fetched ${subjects.data.length} subjects`);

      // Map subjects by ID for easy lookup
      const subjectsById = subjects.data.reduce((acc, subject) => {
        acc[subject.id] = subject;
        return acc;
      }, {});

      // Process SRS levels
      const srsLevels: SrsLevel[] = [
        {
          name: "Apprentice",
          count: 0,
          color: SRS_COLORS.apprentice.hex,
          icon: "school",
          breakdown: { radical: 0, kanji: 0, vocabulary: 0 },
        },
        {
          name: "Guru",
          count: 0,
          color: SRS_COLORS.guru.hex,
          icon: "snow",
          breakdown: { radical: 0, kanji: 0, vocabulary: 0 },
        },
        {
          name: "Master",
          count: 0,
          color: SRS_COLORS.master.hex,
          icon: "trophy",
          breakdown: { radical: 0, kanji: 0, vocabulary: 0 },
        },
        {
          name: "Enlightened",
          count: 0,
          color: SRS_COLORS.enlightened.hex,
          icon: "flash",
          breakdown: { radical: 0, kanji: 0, vocabulary: 0 },
        },
        {
          name: "Burned",
          count: 0,
          color: SRS_COLORS.burned.hex,
          icon: "flame",
          breakdown: { radical: 0, kanji: 0, vocabulary: 0 },
        },
      ];

      // Count items by SRS level
      assignments.data.forEach(assignment => {
        if (assignment.data.started_at) {
          const subject = subjectsById[assignment.data.subject_id];
          if (!subject) return;

          // Determine subject type
          let subjectType: "radical" | "kanji" | "vocabulary";
          if (subject.object === "radical") {
            subjectType = "radical";
          } else if (subject.object === "kanji") {
            subjectType = "kanji";
          } else if (subject.object === "vocabulary" || subject.object === "kana_vocabulary") {
            subjectType = "vocabulary";
          } else {
            return;
          }

          // Determine SRS level
          let srsLevelIndex;
          const srsStage = assignment.data.srs_stage;

          if (srsStage >= 1 && srsStage <= 4) {
            srsLevelIndex = 0; // Apprentice
          } else if (srsStage >= 5 && srsStage <= 6) {
            srsLevelIndex = 1; // Guru
          } else if (srsStage === 7) {
            srsLevelIndex = 2; // Master
          } else if (srsStage === 8) {
            srsLevelIndex = 3; // Enlightened
          } else if (srsStage === 9) {
            srsLevelIndex = 4; // Burned
          } else {
            return; // Skip if not started
          }

          // Increment the appropriate counters
          srsLevels[srsLevelIndex].count++;
          srsLevels[srsLevelIndex].breakdown[subjectType]++;
        }
      });

      setLevels(srsLevels);
    } catch (error) {
      console.error("Failed to fetch SRS data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [apiToken]);

  useEffect(() => {
    fetchSrsData();
  }, [fetchSrsData]);

  const handleLevelPress = (level: SrsLevel) => {
    console.log(`Pressed ${level.name} with ${level.count} items`);
    // Future enhancement: Navigate to a filtered view showing items of this SRS level
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>SRS Distribution</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3A86FF" />
            <Text style={styles.loadingText}>Loading SRS data...</Text>
          </View>
        ) : (
          <SrsBreakdown levels={levels} onLevelPress={handleLevelPress} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    margin: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
}); 