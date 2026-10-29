import type { ViewInstance } from "react-native";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Modal, PanResponder, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { normalizeNoteImageUrl } from "../../shared/note-images";
import { containNoteImageTransform, noteImageTouchGeometry, pinchNoteImage, type NoteImageTransform } from "../../shared/note-image-gestures";
import { useTheme } from "../utils/theme";
import { registerOpenNoteSubjectPreview } from "../utils/note-subject-preview-state";
import { showStudyMaterialPermissionAlert } from "../utils/study-material-permission-alert";

function ImagePreview({ url, onReady }: { url: string; onReady?: (ready: boolean) => void }) {
  const { theme } = useTheme();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => { setStatus("error"); onReady?.(false); }, 15000);
    return () => clearTimeout(timer);
  }, [status, onReady]);
  return <View style={[styles.preview, { backgroundColor: theme.backgroundColor, borderColor: theme.border }]}>
    <Image source={{ uri: url }} contentFit="contain" style={StyleSheet.absoluteFill}
      accessibilityLabel="Note image" onLoad={() => { setStatus("ready"); onReady?.(true); }}
      onError={() => { setStatus("error"); onReady?.(false); }} />
    {status === "loading" ? <ActivityIndicator accessibilityLabel="Loading image" color={theme.primary} /> : null}
    {status === "error" ? <Text style={{ color: theme.textLight, textAlign: "center", padding: 16 }}>Image unavailable. Check the link or try again later.</Text> : null}
  </View>;
}

export function NoteImages({ images, onChange, onRemove, disabled = false }: {
  images: string[]; onChange?: (images: string[]) => Promise<void>; onRemove?: (index: number) => Promise<void>; disabled?: boolean;
}) {
  const { theme } = useTheme();
  const [opened, setOpened] = useState<number | null>(null);
  const [changing, setChanging] = useState(false);
  return <>
    {images.length ? <ScrollView horizontal showsHorizontalScrollIndicator style={{ flexGrow: 0, maxHeight: 210 }} contentContainerStyle={styles.gallery}>
      {images.map((url, index) => <View key={`${index}:${url}`} style={styles.thumbnail}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open note image ${index + 1}`} onPress={() => setOpened(index)}>
          <ImagePreview url={url} />
        </Pressable>
        {onChange ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove note image ${index + 1}`} disabled={disabled || changing}
          onPress={async () => {
            setChanging(true);
            try { await onChange(images.filter((_, position) => position !== index)); }
            catch { Alert.alert("Image wasn’t removed", "Please try again. Your note is still here."); }
            finally { setChanging(false); }
          }} style={styles.remove}>
          <Text style={{ color: theme.textLight }}>Remove</Text>
        </Pressable> : null}
      </View>)}
    </ScrollView> : null}
    {opened !== null && images[opened] ? <NoteImageViewer key={images[opened]} url={images[opened]} onClose={() => setOpened(null)}
      onRemove={(onChange || onRemove) && !disabled ? async () => {
        if (onRemove) await onRemove(opened);
        else await onChange?.(images.filter((_, index) => index !== opened));
        setOpened(null);
      } : undefined} /> : null}
  </>;
}

/** Kept inline so adding a link also works inside the existing note modal. */
export function NoteImageComposer({ onAdd, disabled = false, open, onOpenChange }: {
  onAdd: (url: string) => Promise<void>; disabled?: boolean; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setPreview(normalizeNoteImageUrl(draft)), 400);
    return () => clearTimeout(timer);
  }, [draft, open]);
  if (!open) return <Pressable accessibilityRole="button" accessibilityLabel="Add image" disabled={disabled}
    style={styles.addButton} onPress={() => { setDraft(""); setPreview(null); setReady(false); onOpenChange(true); }}>
    <Text style={{ color: theme.primary, fontWeight: "600" }}>＋ Add image</Text>
  </Pressable>;

  const validUrl = normalizeNoteImageUrl(draft);
  return <ScrollView style={styles.composer} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
    <Text style={{ color: theme.textColor, fontWeight: "600" }}>Image URL</Text>
    <TextInput accessibilityLabel="Image URL" autoFocus autoCapitalize="none" autoCorrect={false} keyboardType="url"
      value={draft} onChangeText={(value) => { setDraft(value); setReady(false); setPreview(null); }} placeholder="https://example.com/image.jpg" placeholderTextColor={theme.textLight}
      editable={!disabled && !saving} style={[styles.input, { color: theme.textColor, borderColor: theme.border }]} />
    <Text style={{ color: theme.textLight }}>Paste a direct link to a publicly accessible image.</Text>
    {draft.trim() && !validUrl ? <Text accessibilityRole="alert" style={{ color: theme.textColor }}>Use a complete http:// or https:// image URL.</Text> : null}
    {preview ? <ImagePreview key={preview} url={preview} onReady={setReady} /> : null}
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" disabled={disabled || saving} onPress={() => onOpenChange(false)} style={styles.action}><Text style={{ color: theme.textColor }}>Cancel image</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Add to note" disabled={disabled || saving || !ready || preview !== validUrl} style={[styles.action, { opacity: ready ? 1 : 0.4 }]}
        onPress={async () => {
          if (!ready || !preview || preview !== validUrl) return;
          setSaving(true);
          try { await onAdd(preview); onOpenChange(false); }
          catch { Alert.alert("Image wasn’t added", "Please try again. Your note is still here."); }
          finally { setSaving(false); }
        }}>
        {saving ? <ActivityIndicator color={theme.primary} /> : <Text style={{ color: theme.primary, fontWeight: "600" }}>Add to note</Text>}
      </Pressable>
    </View>
    <Text style={{ color: theme.textSecondary }}>Then tap Save note to save your text and images together.</Text>
  </ScrollView>;
}

function NoteImageViewer({ url, onClose, onRemove }: { url: string; onClose: () => void; onRemove?: () => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const zoom = useRef(new Animated.Value(1)).current;
  const offset = useRef(new Animated.ValueXY()).current;
  const position = useRef({ scale: 1, x: 0, y: 0 });
  const origin = useRef({ transform: { scale: 1, x: 0, y: 0 }, touches: noteImageTouchGeometry([]) });
  const viewportRef = useRef<ViewInstance>(null);
  const viewportPosition = useRef({ x: 0, y: 0 });
  const [zoomLabel, setZoomLabel] = useState(100);
  const [removing, setRemoving] = useState(false);
  const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => registerOpenNoteSubjectPreview(), []);
  useEffect(() => {
    if (imageStatus !== "loading") return;
    const timer = setTimeout(() => setImageStatus("error"), 15000);
    return () => clearTimeout(timer);
  }, [imageStatus]);
  const viewportHeight = Math.max(100, height - insets.top - insets.bottom - 130);
  const bounds = useRef({ width, height: viewportHeight });
  const imageSize = useRef({ width: 0, height: 0 });
  const apply = (value: NoteImageTransform) => {
    position.current = containNoteImageTransform(value, { ...bounds.current, imageWidth: imageSize.current.width, imageHeight: imageSize.current.height });
    zoom.setValue(position.current.scale);
    offset.setValue({ x: position.current.x, y: position.current.y });
    setZoomLabel(Math.round(position.current.scale * 100));
  };
  const [responder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      origin.current = { transform: { ...position.current }, touches: noteImageTouchGeometry(event.nativeEvent.touches.map((touch) => ({ x: touch.pageX, y: touch.pageY }))) };
    },
    onPanResponderMove: (event) => {
      const touches = noteImageTouchGeometry(event.nativeEvent.touches.map((touch) => ({ x: touch.pageX, y: touch.pageY })));
      if (touches.count !== origin.current.touches.count) { origin.current = { transform: { ...position.current }, touches }; return; }
      const movement = { x: touches.x - origin.current.touches.x, y: touches.y - origin.current.touches.y };
      if (touches.count === 2 && origin.current.touches.distance > 0) {
        const anchor = { x: origin.current.touches.x - viewportPosition.current.x - bounds.current.width / 2, y: origin.current.touches.y - viewportPosition.current.y - bounds.current.height / 2 };
        apply(pinchNoteImage(origin.current.transform, origin.current.transform.scale * touches.distance / origin.current.touches.distance, anchor, movement));
      } else if (touches.count === 1) apply({ ...origin.current.transform, x: origin.current.transform.x + movement.x, y: origin.current.transform.y + movement.y });
    },
    onPanResponderEnd: (event) => { origin.current = { transform: { ...position.current }, touches: noteImageTouchGeometry(event.nativeEvent.touches.map((touch) => ({ x: touch.pageX, y: touch.pageY }))) }; },
  }));

  return <Modal visible animationType="fade" onRequestClose={() => { if (!removing) onClose(); }} presentationStyle="fullScreen">
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: "#111", paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={styles.viewerToolbar}>
        <Text style={{ color: "white", fontWeight: "600" }}>Note image</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close image" disabled={removing} onPress={onClose} style={styles.action}><Text style={styles.viewerText}>Close</Text></Pressable>
      </View>
      <View ref={viewportRef} testID="Note image gestures" accessibilityRole="adjustable" accessibilityLabel="Image zoom and pan"
        accessibilityHint="Pinch to zoom and drag to move the image" accessibilityValue={{ min: 100, max: 500, now: zoomLabel }}
        accessibilityActions={[{ name: "increment", label: "Zoom in" }, { name: "decrement", label: "Zoom out" }]}
        onAccessibilityAction={(event) => { const change = event.nativeEvent.actionName === "increment" ? 0.5 : event.nativeEvent.actionName === "decrement" ? -0.5 : 0; if (change) apply(pinchNoteImage(position.current, position.current.scale + change, { x: 0, y: 0 })); }}
        style={{ flex: 1, overflow: "hidden" }} onLayout={(event) => {
        bounds.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
        viewportRef.current?.measureInWindow((x, y) => { viewportPosition.current = { x, y }; });
        apply(position.current);
      }} {...responder.panHandlers}>
        <Animated.View style={{ flex: 1, transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale: zoom }] }}>
          <Image source={{ uri: url }} contentFit="contain" style={{ flex: 1 }} accessibilityLabel="Expanded note image"
            onLoad={(event) => { imageSize.current = event.source; setImageStatus("ready"); }} onError={() => setImageStatus("error")} />
        </Animated.View>
        {imageStatus !== "ready" ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center", padding: 24 }]}>
          {imageStatus === "loading" ? <ActivityIndicator color="white" accessibilityLabel="Loading expanded image" /> : <Text style={[styles.viewerText, { textAlign: "center" }]}>Image unavailable. Close and reopen to try again.</Text>}
        </View> : null}
      </View>
      <View style={styles.viewerToolbar}>
        <Text style={[styles.viewerText, { fontSize: 14 }]}>Pinch to zoom · {zoomLabel}%</Text>
        {onRemove ? <Pressable accessibilityRole="button" accessibilityLabel="Remove image" disabled={removing} onPress={async () => {
          setRemoving(true);
          try { await onRemove(); } catch (error) { setRemoving(false); if (!showStudyMaterialPermissionAlert(error)) Alert.alert("Image wasn’t removed", "Check your connection and try again."); }
        }} style={styles.action}>{removing ? <ActivityIndicator color="white" /> : <Text style={styles.viewerText}>Remove</Text>}</Pressable> : null}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  gallery: { gap: 12, paddingVertical: 8 },
  thumbnail: { width: 180 },
  preview: { height: 150, borderWidth: 1, borderRadius: 8, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  remove: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: 8 },
  addButton: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: 4 },
  composer: { maxHeight: 320, flexShrink: 1 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  action: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  viewerToolbar: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  viewerText: { color: "white", fontSize: 16 },
});
