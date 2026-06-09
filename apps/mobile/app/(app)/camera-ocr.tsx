import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import { GlassButton } from "../../src/components/GlassButton";
import { performOcr } from "../../src/utils/ocr";
import { useTheme } from "../../src/utils/theme";

interface DetectedTextRegion {
  text: string;
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export default function CameraOCRScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const camera = useRef<Camera>(null);
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();

  const [isActive, setIsActive] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const params = useLocalSearchParams();
  const [manuallyGranted, setManuallyGranted] = useState(
    params.permissionJustGranted === "true"
  );
  const [permissionStatus, setPermissionStatus] = useState<
    "undetermined" | "denied"
  >("undetermined");

  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!hasPermission && !manuallyGranted) {
      setShowPermissionModal(true);
    }
  }, [hasPermission, manuallyGranted]);

  const requestCameraPermission = async () => {
    if (permissionStatus === "denied") {
      Linking.openSettings();
      return;
    }

    const granted = await requestPermission();
    if (granted) {
      setManuallyGranted(true);
      setShowPermissionModal(false);
      setError(null);

      // Workaround: Navigate back and then push again to force a full refresh of the native camera view
      router.back();
      setTimeout(() => {
        router.push({
          pathname: "/camera-ocr",
          params: { permissionJustGranted: "true" },
        });
      }, 300);
    } else {
      setPermissionStatus("denied");
      // On iOS, if permission is denied, requestPermission returns false immediately.
      // We can prompt the user to open settings.
      Linking.openSettings();
    }
  };

  const startAIProcessingAnimation = () => {
    // Glow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Shimmer sweep animation
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopAIProcessingAnimation = () => {
    glowAnim.stopAnimation();
    shimmerAnim.stopAnimation();
    glowAnim.setValue(0);
    shimmerAnim.setValue(0);
  };

  const handleClose = useCallback(() => {
    setIsActive(false);
    router.back();
  }, [router]);

  const handleCapturePress = useCallback(async () => {
    if (!camera.current || !device || isCapturing) return;

    try {
      setIsCapturing(true);
      setError(null);

      // Button press animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      const photo = await camera.current.takePhoto({});

      setCapturedImage(`file://${photo.path}`);
      setImageUri(`file://${photo.path}`);
      performOCR(`file://${photo.path}`);
    } catch (err) {
      console.error("Error taking photo:", err);
      setError("Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  }, [device, isCapturing]);

  const handleGalleryPress = useCallback(async () => {
    try {
      setError(null);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setCapturedImage(uri);
        setImageUri(uri);
        performOCR(uri);
      }
    } catch (err) {
      console.error("Error picking image:", err);
      setError("Failed to select image. Please try again.");
    }
  }, []);

  const performOCR = async (imageUri: string) => {
    try {
      setIsProcessing(true);
      setError(null);

      // Start AI processing animation
      startAIProcessingAnimation();

      console.log("Starting OCR on image:", imageUri);

      const result = await performOcr(imageUri);
      console.log("OCR result:", result);

      if (result.originalText.trim().length === 0) {
        setError(
          "No text detected in the image. Try with an image containing Japanese text."
        );
        return;
      }

      // Filter and extract Japanese text
      const japaneseText = result.recognizedText;

      if (japaneseText.length === 0) {
        setError(
          "No Japanese text detected. Try with an image containing Japanese characters."
        );
        return;
      }

      // Create regions from detected blocks
      const regions: DetectedTextRegion[] = result.regions;

      console.log("Filtered Japanese text:", japaneseText);
      console.log("Detected regions:", regions.length);

      // Navigate to OCR results immediately
      router.replace({
        pathname: "/ocr-results",
        params: {
          recognizedText: japaneseText,
          originalText: result.originalText,
          imageUri: imageUri,
          textRegions: JSON.stringify(regions),
        },
      });
    } catch (err) {
      console.error("OCR error:", err);
      setError("Failed to process image. Please try again.");
    } finally {
      setIsProcessing(false);
      stopAIProcessingAnimation();
    }
  };

  // Helper function to filter out non-Japanese characters (same as speech search)
  const filterJapaneseText = (text: string): string => {
    // Japanese character ranges:
    // Hiragana: \u3040-\u309F
    // Katakana: \u30A0-\u30FF
    // Kanji: \u4E00-\u9FAF
    // Japanese punctuation: \u3000-\u303F
    // Japanese symbols: \uFF00-\uFFEF (full-width characters)

    // Split text into lines to preserve structure
    const lines = text.split("\n");
    const filteredLines = lines
      .map((line) => {
        // Extract Japanese characters while preserving some spacing
        const japaneseRegex =
          /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\uFF00-\uFFEF0-9\s\.,!\?\-]/g;
        const matches = line.match(japaneseRegex);
        if (matches) {
          // Join matches and clean up excessive whitespace
          return matches.join("").replace(/\s+/g, " ").trim();
        }
        return "";
      })
      .filter((line) => line.length > 0); // Remove empty lines

    const result = filteredLines.join("\n");
    console.log("Japanese filtering result:", result);
    console.log(
      "Original length:",
      text.length,
      "Filtered length:",
      result.length
    );

    return result;
  };

  const handleRetry = useCallback(() => {
    setCapturedImage(null);
    setImageUri(null);
    setError(null);
    setIsProcessing(false);
    stopAIProcessingAnimation();
  }, []);

  const screenDimensions = Dimensions.get("window");

  // Permission modal
  if (showPermissionModal) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.permissionContainer}>
          <View
            style={[
              styles.permissionContent,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            <Ionicons
              name="camera-outline"
              size={64}
              color={theme.textSecondary}
            />
            <Text style={[styles.permissionTitle, { color: theme.textColor }]}>
              Camera Permission Required
            </Text>
            <Text
              style={[styles.permissionText, { color: theme.textSecondary }]}
            >
              We need access to your camera to capture images for Japanese text
              recognition.
            </Text>
            <TouchableOpacity
              style={[
                styles.permissionButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={requestCameraPermission}
              activeOpacity={0.7}
            >
              <Text style={styles.permissionButtonText}>
                {permissionStatus === "denied"
                  ? "Open Settings"
                  : "Continue"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (!device) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.errorContainer}>
          <Ionicons name="camera-outline" size={64} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>
            Camera not available
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: "rgba(0,0,0,0.3)" }]}>
        <GlassButton
          iconName="arrow-back"
          onPress={handleClose}
          iconColor="white"
        />
        <Text style={styles.headerTitle}>Image Search</Text>
        <GlassButton
          iconName="images"
          onPress={handleGalleryPress}
          iconColor="white"
        />
      </View>

      {/* Camera or Captured Image */}
      <View style={styles.cameraContainer}>
        {capturedImage ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: capturedImage }}
              style={styles.capturedImage}
            />

            {/* AI Processing Animation */}
            {isProcessing && (
              <View style={styles.aiProcessingOverlay}>
                {/* Glow effect */}
                <Animated.View
                  style={[
                    styles.aiGlowEffect,
                    {
                      opacity: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 0.8],
                      }),
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      "rgba(0,122,255,0.1)",
                      "rgba(0,122,255,0.3)",
                      "rgba(0,122,255,0.1)",
                    ]}
                    style={styles.glowGradient}
                  />
                </Animated.View>

                {/* Scanning beam effect */}
                <Animated.View
                  style={[
                    styles.scanningBeam,
                    {
                      transform: [
                        {
                          translateX: shimmerAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-400, 400],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      "transparent",
                      "rgba(0,122,255,0.6)",
                      "rgba(255,255,255,0.8)",
                      "rgba(0,122,255,0.6)",
                      "transparent",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.beamGradient}
                  />
                </Animated.View>

                {/* Processing indicator */}
                <View style={styles.aiProcessingContent}>
                  <View
                    style={[
                      styles.aiIndicator,
                      { backgroundColor: theme.cardBackground },
                    ]}
                  >
                    <View style={styles.aiIconContainer}>
                      <Ionicons name="scan" size={32} color="#007AFF" />
                      <Animated.View
                        style={[
                          styles.aiPulse,
                          {
                            transform: [
                              {
                                scale: glowAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [1, 1.1],
                                }),
                              },
                            ],
                            opacity: glowAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 1],
                            }),
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.aiProcessingText,
                        { color: theme.textColor },
                      ]}
                    >
                      AI Processing
                    </Text>
                    <Text
                      style={[
                        styles.aiProcessingSubtext,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Analyzing Japanese text...
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        ) : (
          <>
            <Camera
              ref={camera}
              style={styles.camera}
              device={device}
              isActive={isActive && (hasPermission || manuallyGranted)}
              photo={true}
            />

            {/* Viewfinder corners */}
            <View style={styles.viewfinder}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={[styles.instructionsTitle, { color: theme.textColor }]}>
          {capturedImage ? "Processing Image" : "Point camera at Japanese text"}
        </Text>
        <Text
          style={[styles.instructionsSubtitle, { color: theme.textSecondary }]}
        >
          {capturedImage
            ? "Detecting Japanese characters and vocabulary..."
            : "Books, signs, menus, or any printed text"}
        </Text>
      </View>

      {/* Error display */}
      {error && (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={20} color={theme.error} />
          <Text style={[styles.errorBannerText, { color: theme.error }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={styles.controlsContainer}>
        {capturedImage ? (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={24} color="white" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.captureContainer}>
            <GlassButton
              iconName="images"
              onPress={handleGalleryPress}
              iconColor="white"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            />

            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  {
                    backgroundColor: "white",
                    opacity: isCapturing ? 0.6 : 1,
                  },
                ]}
                onPress={handleCapturePress}
                disabled={isCapturing}
                activeOpacity={0.8}
              >
                {isCapturing ? (
                  <ActivityIndicator size="large" color={theme.primary} />
                ) : (
                  <View
                    style={[
                      styles.captureButtonInner,
                      { backgroundColor: theme.primary },
                    ]}
                  />
                )}
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.spacer} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cameraContainer: {
    flex: 1,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
    position: "relative",
  },
  capturedImage: {
    flex: 1,
    width: "100%",
    resizeMode: "contain",
  },
  viewfinder: {
    position: "absolute",
    top: "20%",
    left: "10%",
    right: "10%",
    bottom: "30%",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "white",
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  aiProcessingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    overflow: "hidden",
  },
  aiGlowEffect: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glowGradient: {
    flex: 1,
  },
  scanningBeam: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 200,
    left: 0,
    opacity: 0.8,
  },
  beamGradient: {
    flex: 1,
    width: "100%",
  },
  aiProcessingContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  aiIndicator: {
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    minWidth: 200,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "rgba(0,122,255,0.5)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.2)",
  },
  aiIconContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  aiPulse: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,122,255,0.2)",
    top: -14,
    left: -14,
  },
  aiProcessingText: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
    color: "#007AFF",
  },
  aiProcessingSubtext: {
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
    fontWeight: "500",
  },
  instructionsContainer: {
    position: "absolute",
    bottom: 140,
    left: 20,
    right: 20,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 16,
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  instructionsSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  errorBanner: {
    position: "absolute",
    top: 120,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    shadowColor: "rgba(0,0,0,0.2)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  errorBannerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  controlsContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 40,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.3)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  spacer: {
    width: 50,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: "rgba(0,0,0,0.2)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionContent: {
    alignItems: "center",
    padding: 32,
    borderRadius: 16,
    maxWidth: 300,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
});
