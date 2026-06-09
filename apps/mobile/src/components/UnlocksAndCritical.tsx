import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { BurnedItem, CriticalItem, UnlockItem } from "../types/wanikani";
import { fontStyles } from "../utils/fonts";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import { getSubjectTypeColor } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

type UnlocksProps = {
  items: UnlockItem[];
  onItemPress: (item: UnlockItem) => void;
  onViewAll: () => void;
};

type CriticalItemsProps = {
  items: CriticalItem[];
  onItemPress: (item: CriticalItem) => void;
  onViewAll: () => void;
};

const UnlockItemCharacter = ({ item }: { item: UnlockItem }) => {
  const isRadical = item.type === "radical";

  // For radicals, try SVG fallback if no characters
  const bestImg =
    isRadical && item.character_images?.length
      ? pickBestImage(item.character_images)
      : null;
  const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
  const svgXml = useRemoteSvg(svgUrl, "#ffffff"); // White color for visibility

  // Display logic: characters → SVG → meaning (no fallback while loading)
  if (item.characters) {
    return (
      <Text style={[styles.itemCharacter, fontStyles.japaneseText]}>
        {item.characters}
      </Text>
    );
  }

  if (svgXml) {
    return <SvgXml xml={svgXml} width={20} height={20} />;
  }

  // If we have an SVG URL but no svgXml yet, show nothing (still loading)
  if (svgUrl) {
    return null;
  }

  // Final fallback to meaning (only if no SVG available)
  return (
    <Text style={[styles.itemCharacter, fontStyles.japaneseText]}>
      {item.meaning.charAt(0)}
    </Text>
  );
};

export function RecentUnlocks({ items, onItemPress, onViewAll }: UnlocksProps) {
  const { theme } = useTheme();

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getItemColor = (type: string): string => {
    if (
      type === "radical" ||
      type === "kanji" ||
      type === "vocabulary" ||
      type === "kana_vocabulary"
    ) {
      return getSubjectTypeColor(type);
    }

    return theme.textColor;
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
          shadowColor: theme.isDark ? "#000" : "#000",
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.textColor }]}>
          New Unlocks In The Last 30 Days
        </Text>
      </View>

      <View style={styles.itemsContainer}>
        {items.slice(0, 4).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.unlockItem, { borderBottomColor: theme.border }]}
            onPress={() => onItemPress(item)}
          >
            <View
              style={[
                styles.itemTypeIndicator,
                { backgroundColor: getItemColor(item.type) },
                // Make vocabulary boxes wider based on character length with no limit
                item.type === "vocabulary" &&
                  item.characters &&
                  item.characters.length > 1 && {
                    width: 48 + (item.characters.length - 2) * 24 + 16,
                  },
              ]}
            >
              <UnlockItemCharacter item={item} />
            </View>
            <Text style={[styles.itemMeaning, { color: theme.textColor }]}>
              {item.meaning}
            </Text>
            <Text style={[styles.itemDate, { color: theme.textLight }]}>
              {formatDate(item.dateUnlocked)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.viewAllButton, { borderColor: theme.border }]}
        onPress={onViewAll}
      >
        <Text style={[styles.viewAllText, { color: theme.textSecondary }]}>
          See More Unlocks
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const CriticalItemCharacter = ({ item }: { item: CriticalItem }) => {
  const isRadical = item.type === "radical";

  // For radicals, try SVG fallback if no characters
  const bestImg =
    isRadical && item.character_images?.length
      ? pickBestImage(item.character_images)
      : null;
  const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
  const svgXml = useRemoteSvg(svgUrl, "#ffffff"); // White color for visibility

  // Display logic: characters → SVG → meaning (no fallback while loading)
  if (item.characters) {
    return (
      <Text style={[styles.itemCharacter, fontStyles.japaneseText]}>
        {item.characters}
      </Text>
    );
  }

  if (svgXml) {
    return <SvgXml xml={svgXml} width={20} height={20} />;
  }

  // If we have an SVG URL but no svgXml yet, show nothing (still loading)
  if (svgUrl) {
    return null;
  }

  // Final fallback to meaning (only if no SVG available)
  return (
    <Text style={[styles.itemCharacter, fontStyles.japaneseText]}>
      {item.meaning.charAt(0)}
    </Text>
  );
};

export function CriticalItems({
  items,
  onItemPress,
  onViewAll,
}: CriticalItemsProps) {
  const { theme } = useTheme();

  const getItemColor = (type: string): string => {
    if (
      type === "radical" ||
      type === "kanji" ||
      type === "vocabulary" ||
      type === "kana_vocabulary"
    ) {
      return getSubjectTypeColor(type);
    }

    return theme.textColor;
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
          shadowColor: theme.isDark ? "#000" : "#000",
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.textColor }]}>
          Critical Condition Items
        </Text>
      </View>

      <View style={styles.itemsContainer}>
        {items.slice(0, 4).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.criticalItem, { borderBottomColor: theme.border }]}
            onPress={() => onItemPress(item)}
          >
            <View
              style={[
                styles.itemTypeIndicator,
                { backgroundColor: getItemColor(item.type) },
                // Make vocabulary boxes wider based on character length with no limit
                item.type === "vocabulary" &&
                  item.characters &&
                  item.characters.length > 1 && {
                    width: 48 + (item.characters.length - 2) * 24 + 16,
                  },
              ]}
            >
              <CriticalItemCharacter item={item} />
            </View>
            <Text style={[styles.itemMeaning, { color: theme.textColor }]}>
              {item.meaning}
            </Text>
            <View
              style={[
                styles.percentageContainer,
                { backgroundColor: theme.isDark ? "#333" : "#f0f0f0" },
              ]}
            >
              <View
                style={[
                  styles.percentageBar,
                  {
                    width: `${item.percentage}%`,
                    backgroundColor:
                      item.percentage < 70 ? "#ff4d4d" : "#ffcc00",
                  },
                ]}
              />
              <Text style={[styles.percentageText, { color: theme.textColor }]}>
                {item.percentage}%
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.viewAllButton, { borderColor: theme.border }]}
        onPress={onViewAll}
      >
        <Text style={[styles.viewAllText, { color: theme.textSecondary }]}>
          See More Critical Items
        </Text>
      </TouchableOpacity>
    </View>
  );
}

type BurnedItemsProps = {
  items: BurnedItem[];
  onItemPress?: (item: BurnedItem) => void;
  onViewAll?: () => void;
};

export function BurnedItems({
  items,
  onItemPress,
  onViewAll,
}: BurnedItemsProps) {
  const { theme } = useTheme();

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getItemColor = (type: string): string => {
    if (
      type === "radical" ||
      type === "kanji" ||
      type === "vocabulary" ||
      type === "kana_vocabulary"
    ) {
      return getSubjectTypeColor(type);
    }

    return theme.textColor;
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
          shadowColor: theme.isDark ? "#000" : "#000",
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.textColor }]}>
          Burned Items In The Last 30 Days
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.burnedContainer}>
          <Text style={[styles.burnedText, { color: theme.textSecondary }]}>
            Turtles are safe... for now.
          </Text>
        </View>
      ) : (
        <View style={styles.itemsContainer}>
          {items.slice(0, 4).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.unlockItem, { borderBottomColor: theme.border }]}
              onPress={() => onItemPress && onItemPress(item)}
              disabled={!onItemPress}
            >
              <View
                style={[
                  styles.itemTypeIndicator,
                  { backgroundColor: getItemColor(item.type) },
                  // Make vocabulary boxes wider based on character length with no limit
                  (item.type === "vocabulary" ||
                    item.type === "kana_vocabulary") &&
                    item.characters &&
                    item.characters.length > 1 && {
                      width: 48 + (item.characters.length - 2) * 24 + 16,
                    },
                ]}
              >
                <UnlockItemCharacter item={item as any} />
              </View>
              <Text style={[styles.itemMeaning, { color: theme.textColor }]}>
                {item.meaning}
              </Text>
              <Text style={[styles.itemDate, { color: theme.textLight }]}>
                {formatDate(item.dateBurned)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {onViewAll && (
        <TouchableOpacity
          style={[styles.viewAllButton, { borderColor: theme.border }]}
          onPress={onViewAll}
        >
          <Text style={[styles.viewAllText, { color: theme.textSecondary }]}>
            See More Burned Items
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  itemsContainer: {
    // No scrolling, just show 4 items
  },
  unlockItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  criticalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  itemTypeIndicator: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemCharacter: {
    fontSize: 20,
    color: "white",
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
  },
  itemMeaning: {
    flex: 1,
    fontSize: 16,
  },
  itemDate: {
    fontSize: 14,
  },
  percentageContainer: {
    width: 80,
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  percentageBar: {
    height: "100%",
    position: "absolute",
    left: 0,
    top: 0,
  },
  percentageText: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "bold",
    lineHeight: 24,
  },
  viewAllButton: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 4,
  },
  viewAllText: {
    fontSize: 14,
  },
  burnedContainer: {
    alignItems: "center",
    padding: 20,
  },
  burnedImage: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  burnedText: {
    fontSize: 16,
  },
});
