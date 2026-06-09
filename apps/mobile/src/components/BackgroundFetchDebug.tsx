import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import WaniKaniBackgroundFetch from '../modules/WaniKaniBackgroundFetch';
import { useTheme } from '../utils/theme';

export function BackgroundFetchDebug() {
  const { theme } = useTheme();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = () => {
    if (WaniKaniBackgroundFetch) {
      const fetchStatus = WaniKaniBackgroundFetch.getBackgroundFetchStatus();
      setStatus(fetchStatus);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const triggerManualFetch = async () => {
    if (!WaniKaniBackgroundFetch) {
      Alert.alert('Error', 'Background fetch not available');
      return;
    }

    setLoading(true);
    try {
      const result = await WaniKaniBackgroundFetch.triggerBackgroundFetchManually();
      Alert.alert('Background Fetch Result', `Result: ${result.result}\nReview Count: ${result.reviewCount}\nTimestamp: ${new Date(result.timestamp).toLocaleString()}`);
      loadStatus();
    } catch {
      Alert.alert('Error', 'Failed to trigger background fetch');
    } finally {
      setLoading(false);
    }
  };

  if (!WaniKaniBackgroundFetch) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
      <Text style={[styles.title, { color: theme.textColor }]}>Background Fetch Debug</Text>
      
      {status && (
        <View style={styles.statusContainer}>
          <StatusRow label="Last Fetch" value={status.timeSinceLastFetch} color={theme.textColor} />
          <StatusRow label="Review Count" value={status.currentReviewCount.toString()} color={theme.textColor} />
          <StatusRow label="API Token" value={status.hasApiToken ? '✅ Set' : '❌ Not Set'} color={theme.textColor} />
          <StatusRow label="Badge Enabled" value={status.badgeEnabled ? '✅ Yes' : '❌ No'} color={theme.textColor} />
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }, loading && styles.buttonDisabled]}
        onPress={triggerManualFetch}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Triggering...' : 'Trigger Manual Fetch'}</Text>
      </TouchableOpacity>

      <Text style={[styles.note, { color: theme.textColor }]}>
        Note: Check Xcode console for detailed logs
      </Text>
    </View>
  );
}

function StatusRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={[styles.statusLabel, { color }]}>{label}:</Text>
      <Text style={[styles.statusValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statusContainer: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
});