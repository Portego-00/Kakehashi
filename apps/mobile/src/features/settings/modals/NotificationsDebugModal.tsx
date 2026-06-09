import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function NotificationsDebugModal() {
  const {
    expoPendingNotifications,
    formatExpoTriggerLabel,
    formatNativeTriggerLabel,
    handleShowPendingNotifications,
    modalHeaderPaddingTop,
    pendingNotifications,
    setShowNotificationsModal,
    showNotificationsModal,
    theme,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Notifications Debug Modal - Dev Only */}
      {__DEV__ && (
        <Modal
          visible={showNotificationsModal}
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
              <TouchableOpacity
                onPress={() => setShowNotificationsModal(false)}
              >
                <Text
                  style={[styles.modalCancelText, { color: theme.primary }]}
                >
                  Close
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                Scheduled Notifications
              </Text>
              <TouchableOpacity onPress={handleShowPendingNotifications}>
                <Text
                  style={[styles.modalCancelText, { color: theme.primary }]}
                >
                  Refresh
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {pendingNotifications && (
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
                        Total Notifications:
                      </Text>
                      <Text
                        style={[
                          styles.cacheValue,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {pendingNotifications.count +
                          expoPendingNotifications.length}
                      </Text>
                    </View>
                    <View style={styles.cacheRow}>
                      <Text
                        style={[styles.cacheLabel, { color: theme.textColor }]}
                      >
                        Native Scheduled:
                      </Text>
                      <Text
                        style={[
                          styles.cacheValue,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {pendingNotifications.count}
                      </Text>
                    </View>
                    <View style={styles.cacheRow}>
                      <Text
                        style={[styles.cacheLabel, { color: theme.textColor }]}
                      >
                        Expo Scheduled:
                      </Text>
                      <Text
                        style={[
                          styles.cacheValue,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {expoPendingNotifications.length}
                      </Text>
                    </View>
                  </View>

                  {/* Native Notifications List */}
                  {pendingNotifications.notifications.length > 0 && (
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
                        Native Scheduled Notifications
                      </Text>
                      {pendingNotifications.notifications.map(
                        (notification, index) => (
                          <View
                            key={notification.identifier}
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
                                {notification.title || notification.identifier}
                              </Text>
                              <Text
                                style={[
                                  styles.largestItemDetails,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Badge: {notification.badge} •{" "}
                                {formatNativeTriggerLabel(notification.trigger)}
                              </Text>
                              <Text
                                style={[
                                  styles.largestItemDetails,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {notification.body}
                              </Text>
                            </View>
                          </View>
                        ),
                      )}
                    </View>
                  )}

                  {/* Expo Notifications List */}
                  {expoPendingNotifications.length > 0 && (
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
                        Expo Scheduled Notifications
                      </Text>
                      {expoPendingNotifications.map((notification, index) => (
                        <View
                          key={notification.identifier}
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
                              {notification.content.title ||
                                notification.identifier}
                            </Text>
                            <Text
                              style={[
                                styles.largestItemDetails,
                                { color: theme.textSecondary },
                              ]}
                            >
                              Trigger:{" "}
                              {formatExpoTriggerLabel(notification.trigger)}
                            </Text>
                            <Text
                              style={[
                                styles.largestItemDetails,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {notification.content.body || "No body"}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Empty state */}
                  {pendingNotifications.notifications.length === 0 &&
                    expoPendingNotifications.length === 0 && (
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
                          No Scheduled Notifications
                        </Text>
                        <Text
                          style={[
                            styles.cacheLabel,
                            { color: theme.textSecondary },
                          ]}
                        >
                          No notifications are currently scheduled. Enable
                          notification settings to schedule review
                          notifications.
                        </Text>
                      </View>
                    )}
                </>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </>
  );
}
