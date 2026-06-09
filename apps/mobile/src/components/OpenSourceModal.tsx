import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GitHubMark from "./GitHubMark";
import { KAKEHASHI_REPOSITORY_URL } from "../utils/openSourceAnnouncement";
import { useTheme } from "../utils/theme";

type OpenSourceModalProps = {
  visible: boolean;
  onClose: () => void | Promise<void>;
};

export default function OpenSourceModal({
  visible,
  onClose,
}: OpenSourceModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [isOpeningRepository, setIsOpeningRepository] = useState(false);

  const handleClose = async () => {
    await Promise.resolve(onClose());
  };

  const handleOpenRepository = async () => {
    if (isOpeningRepository) {
      return;
    }

    setIsOpeningRepository(true);

    try {
      const canOpenRepository = await Linking.canOpenURL(
        KAKEHASHI_REPOSITORY_URL,
      );
      if (!canOpenRepository) {
        Alert.alert(
          "Unable to Open GitHub",
          "Could not open the repository right now. Please try again later.",
        );
        return;
      }

      await Promise.resolve(onClose());
      await Linking.openURL(KAKEHASHI_REPOSITORY_URL);
    } catch (error) {
      console.error("Failed to open GitHub repository:", error);
      Alert.alert(
        "Unable to Open GitHub",
        "Could not open the repository right now. Please try again later.",
      );
    } finally {
      setIsOpeningRepository(false);
    }
  };

  const textColor = theme.textColor;
  const iconColor = theme.isDark ? "#FFFFFF" : "#24292F";

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.backdrop,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.logoBadge,
                  {
                    backgroundColor: theme.isDark ? "#FFFFFF" : "#24292F",
                  },
                ]}
              >
                <GitHubMark
                  size={34}
                  color={theme.isDark ? "#24292F" : "#FFFFFF"}
                  accessibilityLabel="GitHub"
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: theme.backgroundColor },
                  pressed && styles.pressed,
                ]}
                onPress={handleClose}
              >
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.title, { color: textColor }]}>
              Kakehashi is open source
            </Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              You can now read the code, contribute fixes or ideas, and star the
              repo if Kakehashi helps your studies.
            </Text>

            <View style={styles.actionList}>
              <OpenSourceAction
                icon="git-pull-request-outline"
                title="Contribute"
                description="Open issues, send pull requests, or help shape what comes next."
              />
              <OpenSourceAction
                icon="star-outline"
                title="Star the repo"
                description="A star helps other WaniKani learners find the project."
              />
            </View>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}
              onPress={handleOpenRepository}
              disabled={isOpeningRepository}
            >
              {isOpeningRepository ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <GitHubMark size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Open on GitHub</Text>
                </>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.border },
                pressed && styles.pressed,
              ]}
              onPress={handleClose}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: theme.textSecondary },
                ]}
              >
                Not now
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </View>
    </Modal>
  );

  function OpenSourceAction({
    icon,
    title,
    description,
  }: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    title: string;
    description: string;
  }) {
    return (
      <View style={styles.actionRow}>
        <View
          style={[
            styles.actionIcon,
            { backgroundColor: theme.backgroundColor },
          ]}
        >
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.actionTextContainer}>
          <Text style={[styles.actionTitle, { color: textColor }]}>
            {title}
          </Text>
          <Text
            style={[
              styles.actionDescription,
              { color: theme.textSecondary },
            ]}
          >
            {description}
          </Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  card: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "100%",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  content: {
    padding: 22,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  logoBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  description: {
    fontSize: 16,
    lineHeight: 23,
  },
  actionList: {
    gap: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
});
