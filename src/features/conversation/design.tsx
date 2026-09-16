import { Ionicons } from '@expo/vector-icons';
import React, { createContext, forwardRef, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type FlatListProps, type KeyboardEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps, type TextInputProps, type TextProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConversationTheme } from './conversation-theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type KeyboardFocus = { focus(input: TextInput): void; blur(input: TextInput | null): void; reveal(): void };
const KeyboardInputs = createContext<KeyboardFocus | null>(null);

/** Both frames use window coordinates, including the offset of an iOS page sheet. */
export function focusedInputScrollOffset(offset: number, viewportY: number, viewportHeight: number, inputY: number, inputHeight: number, keyboardY: number) {
  const top = viewportY + 12;
  const bottom = Math.min(viewportY + viewportHeight, keyboardY) - 16;
  if (bottom <= top) return offset;
  // When space permits, leave room for the next submit button as well as the field.
  const targetBottom = bottom - (bottom - top >= inputHeight + 64 ? 64 : 0);
  const delta = inputY < top ? inputY - top : Math.min(Math.max(0, inputY + inputHeight - targetBottom), inputY - top);
  return Math.max(0, offset + delta);
}

function useKeyboardScroll(scrollTo: (offset: number) => void, initialOffset = 0) {
  const viewport = useRef<View>(null);
  const focused = useRef<TextInput | null>(null);
  const offset = useRef(initialOffset);
  const keyboardY = useRef(Keyboard.metrics?.()?.screenY ?? Infinity);
  const frame = useRef<number | undefined>(undefined);
  const generation = useRef(0);
  const dragging = useRef(false);
  const scroll = useRef(scrollTo); scroll.current = scrollTo;
  const cancel = useCallback(() => {
    generation.current++;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
  }, []);
  const reveal = useCallback(() => {
    cancel();
    if (!focused.current || !Number.isFinite(keyboardY.current) || dragging.current) return;
    const request = generation.current;
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      const input = focused.current;
      if (!input || request !== generation.current) return;
      viewport.current?.measureInWindow((_x, y, _width, height) => {
        if (request !== generation.current || focused.current !== input) return;
        input.measureInWindow((_inputX, inputY, _inputWidth, inputHeight) => {
          if (request !== generation.current || focused.current !== input || dragging.current) return;
          const next = focusedInputScrollOffset(offset.current, y, height, inputY, inputHeight, keyboardY.current);
          if (Math.abs(next - offset.current) < 1) return;
          offset.current = next;
          scroll.current(next);
        });
      });
    });
  }, [cancel]);
  useEffect(() => {
    const show = (event: KeyboardEvent) => { keyboardY.current = event.endCoordinates.screenY; reveal(); };
    const hide = () => { keyboardY.current = Infinity; cancel(); };
    const subscriptions = [Keyboard.addListener('keyboardDidShow', show), Keyboard.addListener('keyboardDidHide', hide)];
    if (Platform.OS === 'ios') subscriptions.push(Keyboard.addListener('keyboardWillChangeFrame', show));
    return () => { cancel(); focused.current = null; subscriptions.forEach(subscription => subscription.remove()); };
  }, [cancel, reveal]);
  const context = useMemo<KeyboardFocus>(() => ({
    focus(input) { focused.current = input; dragging.current = false; keyboardY.current = Keyboard.metrics?.()?.screenY ?? keyboardY.current; reveal(); },
    blur(input) { if (focused.current === input) { focused.current = null; cancel(); } },
    reveal,
  }), [cancel, reveal]);
  return {
    viewport, context, reveal,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => { offset.current = event.nativeEvent.contentOffset.y; },
    onScrollBeginDrag: () => { dragging.current = true; cancel(); },
    onScrollEndDrag: () => { dragging.current = false; },
  };
}

/** Native iOS keyboard insets and Android adjustResize each own their platform's inset. */
export const KeyboardScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardScrollView({ onScroll, onLayout, onContentSizeChange, onScrollBeginDrag, onScrollEndDrag, contentInsetAdjustmentBehavior = 'never', ...props }, ref) {
  const scroll = useRef<ScrollView | null>(null);
  const keyboard = useKeyboardScroll(y => scroll.current?.scrollTo({ y, animated: true }), props.contentOffset?.y);
  const attach = useCallback((node: ScrollView | null) => { scroll.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }, [ref]);
  return <View ref={keyboard.viewport} collapsable={false} style={{ flex: 1 }} onLayout={keyboard.reveal}>
    <KeyboardInputs.Provider value={keyboard.context}>
      <ScrollView {...props} ref={attach} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior} scrollEventThrottle={16}
        onScroll={event => { keyboard.onScroll(event); onScroll?.(event); }}
        onLayout={event => { keyboard.reveal(); onLayout?.(event); }}
        onContentSizeChange={(width, height) => { keyboard.reveal(); onContentSizeChange?.(width, height); }}
        onScrollBeginDrag={event => { keyboard.onScrollBeginDrag(); onScrollBeginDrag?.(event); }}
        onScrollEndDrag={event => { keyboard.onScrollEndDrag(); onScrollEndDrag?.(event); }} />
    </KeyboardInputs.Provider>
  </View>;
});

export function KeyboardFlatList<Item>({ onScroll, onLayout, onContentSizeChange, onScrollBeginDrag, onScrollEndDrag, contentInsetAdjustmentBehavior = 'never', ...props }: FlatListProps<Item>) {
  const list = useRef<FlatList<Item>>(null);
  const keyboard = useKeyboardScroll(offset => list.current?.scrollToOffset({ offset, animated: true }), props.contentOffset?.y);
  return <View ref={keyboard.viewport} collapsable={false} style={{ flex: 1 }} onLayout={keyboard.reveal}>
    <KeyboardInputs.Provider value={keyboard.context}>
      <FlatList {...props} ref={list} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior} scrollEventThrottle={16}
        onScroll={event => { keyboard.onScroll(event); onScroll?.(event); }}
        onLayout={event => { keyboard.reveal(); onLayout?.(event); }}
        onContentSizeChange={(width, height) => { keyboard.reveal(); onContentSizeChange?.(width, height); }}
        onScrollBeginDrag={event => { keyboard.onScrollBeginDrag(); onScrollBeginDrag?.(event); }}
        onScrollEndDrag={event => { keyboard.onScrollEndDrag(); onScrollEndDrag?.(event); }} />
    </KeyboardInputs.Provider>
  </View>;
}

export const KeyboardTextInput = forwardRef<TextInput, TextInputProps>(function KeyboardTextInput({ onFocus, onBlur, onContentSizeChange, style, multiline, ...props }, ref) {
  const { colors, isDark } = useConversationTheme();
  const input = useRef<TextInput | null>(null);
  const keyboard = useContext(KeyboardInputs);
  const { height } = useWindowDimensions();
  const attach = useCallback((node: TextInput | null) => { if (!node) keyboard?.blur(input.current); input.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }, [keyboard, ref]);
  useEffect(() => { const node = input.current; return () => keyboard?.blur(node); }, [keyboard]);
  return <TextInput {...props} ref={attach} multiline={multiline} keyboardAppearance={props.keyboardAppearance ?? (isDark ? 'dark' : 'light')} selectionColor={props.selectionColor ?? colors.orange} placeholderTextColor={props.placeholderTextColor ?? colors.muted} scrollEnabled={multiline ? true : props.scrollEnabled} style={[multiline && { maxHeight: Math.max(120, Math.min(240, height * 0.3)) }, style]}
    onFocus={event => { if (input.current) keyboard?.focus(input.current); onFocus?.(event); }}
    onBlur={event => { keyboard?.blur(input.current); onBlur?.(event); }}
    onContentSizeChange={event => { keyboard?.reveal(); onContentSizeChange?.(event); }} />;
});

export function Label({ style, ...props }: TextProps) {
  const { styles } = useConversationTheme();
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const numericWeight = weight === 'bold' ? 700 : Number(weight) || 400;
  const fontFamily = numericWeight >= 800 ? 'ConversationNunitoExtraBold' : numericWeight >= 700 ? 'ConversationNunitoBold' : numericWeight >= 500 ? 'ConversationNunitoSemiBold' : 'ConversationNunito';
  // Explicit static faces avoid the source variable font's 200-weight default on native.
  return <Text {...props} style={[styles.text, style, { fontFamily, fontWeight: 'normal' }]} />;
}
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useConversationTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.ink} accessible={false} />;
}
export function Action({ title, icon, onPress, disabled = false, primary = false, compact = false, busy = false, destructive = false }: {
  title: string; icon?: IconName; onPress: () => void; disabled?: boolean; primary?: boolean; compact?: boolean; busy?: boolean; destructive?: boolean;
}) {
  const { colors, styles } = useConversationTheme();
  const foreground = destructive ? colors.danger : primary ? colors.onPrimary : colors.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.action, compact && { paddingVertical: 10, paddingHorizontal: 14 }, primary && { backgroundColor: colors.orange, borderColor: colors.orange }, { opacity: disabled ? 0.45 : pressed ? 0.65 : 1 }]}>
    {busy ? <ActivityIndicator color={foreground} /> : icon ? <Icon name={icon} size={20} color={foreground} /> : null}
    <Label style={[styles.actionLabel, { color: foreground }]}>{title}</Label>
  </Pressable>;
}
export function CircleAction({ title, icon, onPress, main, selected, disabled, busy }: {
  title: string; icon: IconName; onPress: () => void; main?: boolean; selected?: boolean; disabled?: boolean; busy?: boolean;
}) {
  const { colors } = useConversationTheme();
  const foreground = main ? colors.onPrimary : colors.ink;
  return <View style={{ alignItems: 'center', gap: 7, minWidth: main ? 88 : 76 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled, selected: !!selected, busy: !!busy }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ width: main ? 80 : 52, height: main ? 80 : 52, borderRadius: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: main ? colors.orange : selected ? colors.selection : colors.paper, borderWidth: main ? 0 : 1, borderColor: colors.border, opacity: disabled ? 0.4 : pressed ? 0.65 : 1 }]}>
      {busy ? <ActivityIndicator size="large" color={foreground} /> : <Icon name={icon} size={main ? 37 : 24} color={foreground} />}
    </Pressable>
    {!main ? <Label style={{ fontSize: 13 }}>{title}</Label> : null}
  </View>;
}
type SheetProps = { title: string; visible: boolean; onClose: () => void; children: React.ReactNode; scroll?: boolean; onShow?: () => void };
type SheetPresentation = SheetProps & { presentationID?: string; scrollOffset?: React.MutableRefObject<number> };
class SheetStack {
  entries = new Map<string, SheetPresentation>();
  private listeners = new Set<() => void>();
  private snapshot: SheetPresentation | undefined;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => this.listeners.delete(callback); };
  getSnapshot = () => this.snapshot;
  update(id: string, props: SheetPresentation) {
    if (props.visible) this.entries.set(id, props); else this.entries.delete(id);
    const next = [...this.entries.values()].pop();
    if (next !== this.snapshot) { this.snapshot = next; this.listeners.forEach(callback => callback()); }
  }
  remove(id: string) { this.entries.delete(id); const next = [...this.entries.values()].pop(); if (next !== this.snapshot) { this.snapshot = next; this.listeners.forEach(callback => callback()); } }
  closeAll() { [...this.entries.values()].reverse().forEach(entry => entry.onClose()); }
}
const Sheets = createContext<SheetStack | null>(null);
export function SheetProvider({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
  const stack = useMemo(() => new SheetStack(), []);
  useEffect(() => { if (!active) { Keyboard.dismiss(); stack.closeAll(); } }, [active, stack]);
  return <Sheets.Provider value={stack}>{children}<SheetHost stack={stack} /></Sheets.Provider>;
}
function SheetHost({ stack }: { stack: SheetStack }) {
  const props = useSyncExternalStore(stack.subscribe, stack.getSnapshot, stack.getSnapshot);
  return <SheetModal title={props?.title ?? ''} visible={!!props} onClose={() => props?.onClose()} onShow={props?.onShow} scroll={props?.scroll} presentationID={props?.presentationID} scrollOffset={props?.scrollOffset}>{props?.children}</SheetModal>;
}
/** Keep one native presenter, so settings, word lookups and confirmation sheets can nest on iOS. */
export function Sheet(props: SheetProps) {
  const stack = useContext(Sheets);
  const id = useId();
  const scrollOffset = useRef(0);
  useLayoutEffect(() => { if (!props.visible) scrollOffset.current = 0; stack?.update(id, { ...props, presentationID: id, scrollOffset }); });
  useEffect(() => () => stack?.remove(id), [id, stack]);
  return stack ? null : <SheetModal {...props} presentationID={id} scrollOffset={scrollOffset} />;
}
function SheetModal({ title, visible, onClose, onShow, children, scroll = true, presentationID, scrollOffset }: SheetPresentation) {
  const { colors, styles } = useConversationTheme();
  const insets = useSafeAreaInsets();
  const scrollView = useRef<ScrollView>(null);
  const showFrame = useRef<number | undefined>(undefined);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showCallback = useRef(onShow); showCallback.current = onShow;
  const cancelShow = useCallback(() => {
    if (showFrame.current !== undefined) cancelAnimationFrame(showFrame.current);
    if (showTimer.current !== undefined) clearTimeout(showTimer.current);
    showFrame.current = undefined; showTimer.current = undefined;
  }, []);
  // Switch the keyboard owner before a new sheet focuses an input in onShow.
  useLayoutEffect(() => { cancelShow(); Keyboard.dismiss(); return cancelShow; }, [cancelShow, presentationID, visible]);
  const close = () => { cancelShow(); Keyboard.dismiss(); onClose(); };
  return <Modal visible={visible} onRequestClose={close} onShow={() => {
    scrollView.current?.scrollTo({ y: scrollOffset?.current ?? 0, animated: false });
    cancelShow();
    // Android reports onShow before the native slide animation finishes. Focusing
    // then creates a caret without an IME; RN ignores another focus on that field.
    if (Platform.OS === 'android') showTimer.current = setTimeout(() => { showTimer.current = undefined; showCallback.current?.(); }, 300);
    else showFrame.current = requestAnimationFrame(() => { showFrame.current = undefined; showCallback.current?.(); });
  }} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}>
    <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: Platform.OS === 'ios' ? 12 : insets.top }}>
      <View style={styles.sheetHeader}>
        <Label accessibilityRole="header" style={styles.sheetTitle}>{title}</Label>
        <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} hitSlop={10} onPress={close} style={styles.close}><Icon name="close" /></Pressable>
      </View>
      {scroll ? <KeyboardScrollView key={presentationID ?? title} ref={scrollView} contentOffset={{ x: 0, y: scrollOffset?.current ?? 0 }} onScroll={event => { if (scrollOffset) scrollOffset.current = Math.max(0, event.nativeEvent.contentOffset.y); }} contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 32, gap: 20 }}>{children}</KeyboardScrollView> : children}
    </View>
  </Modal>;
}
export function RecallBars({ count }: { count: number }) {
  const { colors } = useConversationTheme();
  return <View accessible accessibilityLabel={`${count} of 3 recall bars`} style={{ flexDirection: 'row', gap: 4 }}>
    {[0, 1, 2].map(index => <View key={index} style={{ width: 18, height: 5, borderRadius: 3, backgroundColor: index < count ? colors.orange : colors.peach }} />)}
  </View>;
}
