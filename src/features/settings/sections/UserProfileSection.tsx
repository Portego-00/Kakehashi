import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function UserProfileSection() {
  const {
    gravatarEmailInput,
    handleJpdbApiKeyInfoPress,
    handleRemoveJpdbApiKey,
    handleSaveGravatarEmail,
    handleSaveJpdbApiKey,
    hasStoredJpdbApiKey,
    isLoadingJpdbApiKey,
    isPortegoUser,
    isSavingJpdbApiKey,
    jpdbApiKeyInput,
    jpdbApiKeyStatus,
    router,
    setGravatarEmailInput,
    setJpdbApiKeyInput,
    setJpdbApiKeyStatus,
    StyleSheet,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <>
      {/* User Profile Section */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("profile", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          User Profile
        </Text>

        <View
          style={[
            styles.settingItemColumn,
            { borderBottomColor: "transparent" },
          ]}
        >
          <View style={[styles.settingRow, { marginBottom: 8 }]}>
            <Ionicons
              name="person-circle"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Gravatar Email
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Enter your email to display your Gravatar profile picture
              </Text>
            </View>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              value={gravatarEmailInput}
              onChangeText={setGravatarEmailInput}
              placeholder="Enter email address"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onEndEditing={handleSaveGravatarEmail}
              style={[
                styles.textInput,
                {
                  flex: 1,
                  marginTop: 0,
                  borderColor: theme.border,
                  backgroundColor: theme.isDark ? "#1f1f1f" : "#f5f5f5",
                  color: theme.textColor,
                },
              ]}
            />
            <TouchableOpacity
              onPress={handleSaveGravatarEmail}
              style={[
                styles.inputIconButton,
                { backgroundColor: theme.primary },
              ]}
            >
              <Ionicons name="checkmark" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={[
            styles.settingItemColumn,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.border,
              borderBottomColor: "transparent",
            },
          ]}
        >
          <View style={[styles.settingRow, { marginBottom: 8 }]}>
            <Ionicons
              name="key-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <View style={styles.settingHeadingRow}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  JPDB API Key
                </Text>
                <TouchableOpacity
                  style={styles.settingInfoButton}
                  onPress={handleJpdbApiKeyInfoPress}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="JPDB API key info"
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Used for parse-first vocabulary detection in news, EPUB reader,
                and URL Reader
              </Text>
            </View>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              value={jpdbApiKeyInput}
              onChangeText={(value) => {
                setJpdbApiKeyInput(value);
                setJpdbApiKeyStatus(null);
              }}
              placeholder="Paste JPDB API key"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              editable={!isLoadingJpdbApiKey && !isSavingJpdbApiKey}
              style={[
                styles.textInput,
                {
                  flex: 1,
                  marginTop: 0,
                  borderColor: theme.border,
                  backgroundColor: theme.isDark ? "#1f1f1f" : "#f5f5f5",
                  color: theme.textColor,
                  opacity: isLoadingJpdbApiKey ? 0.7 : 1,
                },
              ]}
            />
            <TouchableOpacity
              onPress={() => void handleSaveJpdbApiKey()}
              disabled={isLoadingJpdbApiKey || isSavingJpdbApiKey}
              style={[
                styles.inputIconButton,
                { backgroundColor: theme.primary },
                (isLoadingJpdbApiKey || isSavingJpdbApiKey) &&
                  styles.syncButtonDisabled,
              ]}
            >
              {isSavingJpdbApiKey ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="checkmark" size={24} color="#fff" />
              )}
            </TouchableOpacity>
            {hasStoredJpdbApiKey ? (
              <TouchableOpacity
                onPress={() => void handleRemoveJpdbApiKey()}
                disabled={isLoadingJpdbApiKey || isSavingJpdbApiKey}
                style={[
                  styles.inputIconButton,
                  { backgroundColor: theme.error },
                  (isLoadingJpdbApiKey || isSavingJpdbApiKey) &&
                    styles.syncButtonDisabled,
                ]}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>
          {jpdbApiKeyStatus ? (
            <Text
              style={[
                styles.syncStatusText,
                {
                  color: jpdbApiKeyStatus.isError
                    ? theme.error
                    : theme.textSecondary,
                },
              ]}
            >
              {jpdbApiKeyStatus.message}
            </Text>
          ) : null}
        </View>

        {isPortegoUser && (
          <TouchableOpacity
            style={[
              styles.settingItem,
              {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.border,
              },
            ]}
            onPress={() => router.push("/url-reader")}
            activeOpacity={0.75}
          >
            <Ionicons
              name="globe-outline"
              size={22}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                URL Reader
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Parse Japanese text from any URL with JPDB-first highlighting
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}
