import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../utils/theme';

type LevelTimeRemainingProps = {
  timeRemaining: string;
  isEstimate: boolean;
};

export default function LevelTimeRemaining({ 
  timeRemaining, 
  isEstimate 
}: LevelTimeRemainingProps) {
  const { theme } = useTheme();
  const title = isEstimate ? "Time remaining (estimated)" : "Time remaining";
  
  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground, shadowColor: theme.isDark ? '#000' : '#000' }]}>
      <View style={styles.iconContainer}>
        <Ionicons name="time-outline" size={28} color={theme.secondary} />
      </View>
      
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: theme.textSecondary }]}>{title}</Text>
        <Text style={[styles.timeText, { color: theme.textColor }]}>{timeRemaining}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  iconContainer: {
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
}); 