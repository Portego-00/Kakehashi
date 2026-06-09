import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function CacheAnalysisModal() {
  const {
    cacheAnalysis,
    handleCacheAnalysis,
    handleClearCategory,
    handleClearLargeItems,
    handleDetailedSubjectsAnalysis,
    modalHeaderPaddingTop,
    setShowCacheModal,
    showCacheModal,
    theme,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Cache Analysis Modal */}
      <Modal
        visible={showCacheModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.backgroundColor },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: theme.cardBackground,
                borderBottomColor: theme.border,
                paddingTop: modalHeaderPaddingTop,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowCacheModal(false)}>
              <Text style={[styles.modalCancelText, { color: theme.primary }]}>
                Close
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>
              Cache Analysis
            </Text>
            <TouchableOpacity onPress={handleCacheAnalysis}>
              <Text style={[styles.modalCancelText, { color: theme.primary }]}>
                Refresh
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {cacheAnalysis && (
              <>
                {/* Summary */}
                <View
                  style={[
                    styles.cacheSection,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cacheSectionTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Summary
                  </Text>
                  <View style={styles.cacheRow}>
                    <Text
                      style={[styles.cacheLabel, { color: theme.textColor }]}
                    >
                      Total Size:
                    </Text>
                    <Text
                      style={[
                        styles.cacheValue,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {cacheAnalysis.totalSizeFormatted}
                    </Text>
                  </View>
                  <View style={styles.cacheRow}>
                    <Text
                      style={[styles.cacheLabel, { color: theme.textColor }]}
                    >
                      Total Items:
                    </Text>
                    <Text
                      style={[
                        styles.cacheValue,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {cacheAnalysis.itemCount}
                    </Text>
                  </View>
                </View>

                {/* Quick Actions */}
                <View
                  style={[
                    styles.cacheSection,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cacheSectionTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Quick Actions
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.cacheActionButton,
                      { borderColor: theme.border },
                    ]}
                    onPress={handleClearLargeItems}
                  >
                    <Ionicons name="trash" size={20} color="#e53935" />
                    <Text
                      style={[styles.cacheActionText, { color: "#e53935" }]}
                    >
                      Clear Large Items ({">"}5MB)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.cacheActionButton,
                      { borderColor: theme.border },
                    ]}
                    onPress={handleDetailedSubjectsAnalysis}
                  >
                    <Ionicons
                      name="analytics"
                      size={20}
                      color={theme.primary}
                    />
                    <Text
                      style={[styles.cacheActionText, { color: theme.primary }]}
                    >
                      Analyze Subjects Cache
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Categories */}
                <View
                  style={[
                    styles.cacheSection,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cacheSectionTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    By Category
                  </Text>
                  {Object.entries(cacheAnalysis.categories)
                    .sort(([, a], [, b]) => b.size - a.size)
                    .map(([category, data]) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryItem,
                          { borderBottomColor: theme.border },
                        ]}
                        onPress={() => handleClearCategory(category)}
                      >
                        <View style={styles.categoryInfo}>
                          <Text
                            style={[
                              styles.categoryName,
                              { color: theme.textColor },
                            ]}
                          >
                            {category}
                          </Text>
                          <Text
                            style={[
                              styles.categoryDetails,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {data.sizeFormatted} • {data.count} items
                          </Text>
                        </View>
                        <Ionicons
                          name="trash"
                          size={16}
                          color={theme.textSecondary}
                        />
                      </TouchableOpacity>
                    ))}
                </View>

                {/* Largest Items */}
                <View
                  style={[
                    styles.cacheSection,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cacheSectionTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Largest Items
                  </Text>
                  {cacheAnalysis.largestItems
                    .slice(0, 10)
                    .map((item, index) => (
                      <View
                        key={item.key}
                        style={[
                          styles.largestItem,
                          { borderBottomColor: theme.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.largestItemRank,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {index + 1}.
                        </Text>
                        <View style={styles.largestItemInfo}>
                          <Text
                            style={[
                              styles.largestItemKey,
                              { color: theme.textColor },
                            ]}
                            numberOfLines={1}
                          >
                            {item.key}
                          </Text>
                          <Text
                            style={[
                              styles.largestItemDetails,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {item.sizeFormatted} • {item.category}
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
