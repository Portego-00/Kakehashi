import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import React, { useState } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import md5 from "../utils/md5";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";

const GRAVATAR_CACHE_TOKEN_STORAGE_KEY = "gravatar_cache_token_v1";
const GRAVATAR_SESSION_CACHE_BUSTER = Date.now().toString();

let lastSuccessfulGravatarToken: string | null | undefined;
let lastSuccessfulGravatarTokenPromise: Promise<string | null> | null = null;
let hasSavedSessionGravatarToken = false;

async function getLastSuccessfulGravatarToken(): Promise<string | null> {
  if (lastSuccessfulGravatarToken !== undefined) {
    return lastSuccessfulGravatarToken;
  }

  if (!lastSuccessfulGravatarTokenPromise) {
    lastSuccessfulGravatarTokenPromise = AsyncStorage.getItem(
      GRAVATAR_CACHE_TOKEN_STORAGE_KEY,
    )
      .then((value) => {
        lastSuccessfulGravatarToken = value;
        return value;
      })
      .catch(() => {
        lastSuccessfulGravatarToken = null;
        return null;
      });
  }

  return lastSuccessfulGravatarTokenPromise;
}

async function saveSessionGravatarToken(): Promise<void> {
  if (hasSavedSessionGravatarToken) {
    return;
  }

  hasSavedSessionGravatarToken = true;
  lastSuccessfulGravatarToken = GRAVATAR_SESSION_CACHE_BUSTER;

  try {
    await AsyncStorage.setItem(
      GRAVATAR_CACHE_TOKEN_STORAGE_KEY,
      GRAVATAR_SESSION_CACHE_BUSTER,
    );
  } catch {
    hasSavedSessionGravatarToken = false;
  }
}

interface UserAvatarProps {
  size?: number;
  style?: ViewStyle;
  fallback: React.ReactNode;
  email?: string | null;
  level?: number | null;
  showLevelBadge?: boolean;
}

export function UserAvatar({
  size = 48,
  style,
  fallback,
  email,
  level,
  showLevelBadge = true
}: UserAvatarProps) {
  const storedEmail = useSettingsStore((state) => state.gravatarEmail);
  const { theme } = useTheme();
  const [cachedImageError, setCachedImageError] = useState(false);
  const [freshImageError, setFreshImageError] = useState(false);
  const [freshImageLoaded, setFreshImageLoaded] = useState(false);
  const [cachedToken, setCachedToken] = useState<string | null | undefined>(
    lastSuccessfulGravatarToken,
  );

  const targetEmail = email !== undefined ? email : storedEmail;
  const normalizedEmail = targetEmail?.trim().toLowerCase();

  // Reset local loading/error state when avatar target changes.
  React.useEffect(() => {
    setCachedImageError(false);
    setFreshImageError(false);
    setFreshImageLoaded(false);
  }, [normalizedEmail, size]);

  React.useEffect(() => {
    let isMounted = true;

    if (cachedToken !== undefined) {
      return () => {
        isMounted = false;
      };
    }

    void getLastSuccessfulGravatarToken().then((token) => {
      if (isMounted) {
        setCachedToken(token);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [cachedToken]);

  const gravatarBaseUrl = normalizedEmail
    ? `https://www.gravatar.com/avatar/${md5(normalizedEmail)}?d=404&s=${size * 2}`
    : null;
  const cachedGravatarUrl =
    gravatarBaseUrl && cachedToken
      ? `${gravatarBaseUrl}&v=${cachedToken}`
      : null;
  const freshGravatarUrl = gravatarBaseUrl
    ? `${gravatarBaseUrl}&v=${GRAVATAR_SESSION_CACHE_BUSTER}`
    : null;

  const shouldTryCachedImage =
    !!cachedGravatarUrl &&
    cachedGravatarUrl !== freshGravatarUrl &&
    !cachedImageError &&
    !freshImageLoaded;
  const shouldShowFreshImage = !!freshGravatarUrl && !freshImageError;
  const shouldShowFallback =
    !freshGravatarUrl ||
    (freshImageError && (!shouldTryCachedImage || cachedImageError));

  const badgeSize = Math.max(20, size * 0.38);
  const badgeFontSize = Math.max(8, badgeSize * 0.50);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'visible',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        },
        style
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          position: "relative",
        }}
      >
        {shouldShowFallback && fallback}
        {shouldTryCachedImage && (
          <Image
            source={{ uri: cachedGravatarUrl }}
            style={styles.imageFill}
            onError={() => setCachedImageError(true)}
            cachePolicy="memory-disk"
            contentFit="cover"
          />
        )}
        {shouldShowFreshImage && (
          <Image
            source={{ uri: freshGravatarUrl }}
            style={[
              styles.imageFill,
              shouldTryCachedImage && !freshImageLoaded ? styles.hiddenImage : null,
            ]}
            onLoad={() => {
              setFreshImageLoaded(true);
              setFreshImageError(false);
              void saveSessionGravatarToken();
            }}
            onError={() => {
              setFreshImageLoaded(false);
              setFreshImageError(true);
            }}
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={200}
          />
        )}
      </View>

      {showLevelBadge && level !== undefined && level !== null && (
        <View
          style={[
            styles.levelBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: theme.primary,
              borderWidth: 2,
              borderColor: theme.isDark ? theme.cardBackground : "#FFFFFF",
            },
          ]}
        >
          <Text
            style={[
              styles.levelText,
              {
                fontSize: badgeFontSize,
                color: "#FFFFFF",
              },
            ]}
          >
            {level}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  imageFill: {
    ...StyleSheet.absoluteFill,
  },
  hiddenImage: {
    opacity: 0,
  },
  levelBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  levelText: {
    fontWeight: "bold",
    textAlign: "center",
  },
});
