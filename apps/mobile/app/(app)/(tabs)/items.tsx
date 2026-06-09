import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GlassButton } from "../../../src/components/GlassButton";
import LoadingProgressBar from "../../../src/components/LoadingProgressBar";
import {
  BurnedItems,
  CriticalItems,
  RecentUnlocks,
} from "../../../src/components/UnlocksAndCritical";
import { useDashboardData } from "../../../src/hooks/useDashboardData";
import { CriticalItem, UnlockItem } from "../../../src/types/wanikani";
import { supportsNativeTabs } from "../../../src/utils/nativeTabs";
import { useTheme } from "../../../src/utils/theme";

export default function ItemsTab() {
  const { dashboardData, isLoading, loadingProgress, refreshData, errorStatus } = useDashboardData();
  const { theme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const shouldUseNativeTabsPadding = supportsNativeTabs();

  const onRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshData]);

  const handleUnlockItemPress = (item: UnlockItem) => {
    // Navigate to item details screen
    router.push(`/subject/${item.id}`);
  };

  const handleCriticalItemPress = (item: CriticalItem) => {
    // Navigate to item details screen
    router.push(`/subject/${item.id}`);
  };

  const handleViewAllUnlocks = () => {
    // Navigate to all unlocks screen
    router.push("/unlocks");
  };

  const handleViewAllCritical = () => {
    // Navigate to critical items screen
    router.push("/critical");
  };

  // Show initial loading only if we have no data at all
  if (isLoading && Object.keys(dashboardData).length === 0 && !dashboardData.dataLoadingState.subjects) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.secondary} />
        <Text style={[styles.loadingText, { color: theme.textColor }]}>Loading items data...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />
      <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>Item Collections</Text>
          <Text style={[styles.headerSubtitle, { color: theme.headerText }]}>
            Unlocks, critical items, and more
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <GlassButton
            iconName="search-outline"
            onPress={() => router.push("/search")}
            iconColor={theme.headerText}
          />
          <GlassButton
            iconName="settings-outline"
            onPress={() => router.push("/settings")}
            iconColor={theme.headerText}
          />
        </View>
      </View>
      
      {/* Progress bar below header */}
      <LoadingProgressBar 
        isLoading={isLoading} 
        progress={loadingProgress}
        color={theme.secondary}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollViewContent, shouldUseNativeTabsPadding && styles.nativeTabsPadding]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            progressViewOffset={10}
            tintColor={theme.primary}
          />
        }
      >
        
        {errorStatus && (
          <View style={[styles.errorContainer, { backgroundColor: theme.isDark ? 'rgba(100, 30, 30, 0.5)' : 'rgba(255, 235, 235, 0.9)' }]}>
            <Text style={[styles.errorText, { color: theme.error }]}>{errorStatus}</Text>
          </View>
        )}
        
        <View style={styles.cardsContainer}>
          {/* Always show recent unlocks - it will update as data loads */}
          <RecentUnlocks
            items={dashboardData.recentUnlocks}
            onItemPress={handleUnlockItemPress}
            onViewAll={handleViewAllUnlocks}
          />

          {/* Always show critical items - it will update as data loads */}
          <CriticalItems
            items={dashboardData.criticalItems}
            onItemPress={handleCriticalItemPress}
            onViewAll={handleViewAllCritical}
          />

          <BurnedItems 
            items={dashboardData.burnedItems} 
            onItemPress={(item) => router.push(`/subject/${item.id}`)}
            onViewAll={() => router.push('/burned')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  cachedDataNotice: {
    padding: 8,
    borderRadius: 8,
    marginVertical: 8,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  cachedDataText: {
    fontSize: 12,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  errorText: {
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    position: "relative",
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  content: {
    flex: 1,
  },
  scrollViewContent: {
  },
  nativeTabsPadding: {
    paddingBottom: 120,
  },
  cardsContainer: {
    padding: 16,
  },
}); 
