/* eslint-disable @typescript-eslint/no-require-imports -- The hoisted native safe-area mock needs its module inside the factory. */
import React, { useState } from 'react';
import { Keyboard, Modal, Platform, ScrollView, TextInput, View, type KeyboardEvent, type KeyboardEventName } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Action, focusedInputScrollOffset, KeyboardFlatList, KeyboardScrollView, KeyboardTextInput, Sheet, SheetProvider } from '../design';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const listeners = new Map<KeyboardEventName, (event: KeyboardEvent) => void>();
type WindowMeasurement = Parameters<TextInput['measureInWindow']>[0];
const removed = jest.fn();
function keyboardEvent(screenY = 520): KeyboardEvent {
  return { duration: 250, easing: 'keyboard', endCoordinates: { screenX: 0, screenY, width: 390, height: 844 - screenY }, startCoordinates: { screenX: 0, screenY: 844, width: 390, height: 0 } };
}
function showKeyboard(screenY = 520, event: KeyboardEventName = 'keyboardDidShow') {
  act(() => { listeners.get(event)?.(keyboardEvent(screenY)); });
  act(() => { jest.runOnlyPendingTimers(); });
}

beforeEach(() => {
  jest.useFakeTimers();
  listeners.clear(); removed.mockClear();
  const addKeyboardListener = Keyboard.addListener.bind(Keyboard);
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
    listeners.set(name, listener);
    const subscription = addKeyboardListener(name, listener);
    const remove = subscription.remove.bind(subscription);
    subscription.remove = () => { removed(); remove(); };
    return subscription;
  });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

describe('focused field visibility', () => {
  it('accounts for an iOS page-sheet origin and leaves room for the submit action', () => {
    expect(focusedInputScrollOffset(300, 100, 650, 600, 48, 520)).toBe(508);
  });

  it('does not subtract the keyboard twice after Android has resized the viewport', () => {
    expect(focusedInputScrollOffset(300, 100, 420, 600, 48, 520)).toBe(508);
  });

  it('keeps an already-visible field still and reveals a field hidden above the viewport', () => {
    expect(focusedInputScrollOffset(200, 100, 420, 180, 80, 520)).toBe(200);
    expect(focusedInputScrollOffset(200, 100, 420, 80, 48, 520)).toBe(168);
    expect(focusedInputScrollOffset(0, 100, 420, 80, 48, 520)).toBe(0);
  });

  it('keeps a tall multiline editor top visible instead of scrolling its caret container offscreen', () => {
    expect(focusedInputScrollOffset(0, 100, 420, 112, 600, 520)).toBe(0);
  });

  function form() {
    const submit = jest.fn();
    const result = render(<KeyboardScrollView><KeyboardTextInput accessibilityLabel="Bottom field" /><Action title="Save" onPress={submit} /></KeyboardScrollView>);
    const viewport = result.UNSAFE_getAllByType(View).find(node => node.props.collapsable === false)?.instance;
    const input = result.UNSAFE_getByType(TextInput).instance;
    const scroller = result.UNSAFE_getByType(ScrollView);
    let inputY = 600;
    let offset = 300;
    viewport.measureInWindow = jest.fn((callback: WindowMeasurement) => callback(0, 100, 390, 650));
    input.measureInWindow = jest.fn((callback: WindowMeasurement) => callback(20, inputY, 350, 48));
    scroller.instance.scrollTo = jest.fn(({ y }: { y: number }) => { inputY -= y - offset; offset = y; });
    fireEvent.scroll(scroller, { nativeEvent: { contentOffset: { x: 0, y: offset } } });
    fireEvent(screen.getByLabelText('Bottom field'), 'focus', { nativeEvent: {} });
    return { ...result, viewport, input, scroller, submit };
  }

  it('measures and scrolls the focused field after the keyboard opens, then allows a one-tap submit', () => {
    const { scroller, submit } = form();
    showKeyboard();
    expect(scroller.instance.scrollTo).toHaveBeenLastCalledWith({ y: 508, animated: true });
    expect(scroller.props.keyboardShouldPersistTaps).toBe('handled');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('rechecks the focused field when the iOS keyboard frame grows', () => {
    const { scroller } = form();
    showKeyboard();
    showKeyboard(450, 'keyboardWillChangeFrame');
    expect(scroller.instance.scrollTo).toHaveBeenLastCalledWith({ y: 578, animated: true });
  });

  it('reveals a restored sheet field before the first native scroll event arrives', () => {
    const result = render(<KeyboardScrollView contentOffset={{ x: 0, y: 420 }}><KeyboardTextInput accessibilityLabel="Restored field" /></KeyboardScrollView>);
    const viewport = result.UNSAFE_getAllByType(View).find(node => node.props.collapsable === false)?.instance;
    const input = result.UNSAFE_getByType(TextInput).instance;
    const scroller = result.UNSAFE_getByType(ScrollView);
    viewport.measureInWindow = jest.fn((callback: WindowMeasurement) => callback(0, 100, 390, 650));
    input.measureInWindow = jest.fn((callback: WindowMeasurement) => callback(20, 600, 350, 48));
    scroller.instance.scrollTo = jest.fn();
    fireEvent(screen.getByLabelText('Restored field'), 'focus', { nativeEvent: {} });
    showKeyboard();
    expect(scroller.instance.scrollTo).toHaveBeenLastCalledWith({ y: 628, animated: true });
  });

  it('does not fight interactive drag dismissal or scroll after the field blurs', () => {
    const { scroller } = form();
    showKeyboard();
    scroller.instance.scrollTo.mockClear();
    fireEvent(scroller, 'scrollBeginDrag', { nativeEvent: {} });
    showKeyboard(400, 'keyboardWillChangeFrame');
    expect(scroller.instance.scrollTo).not.toHaveBeenCalled();
    fireEvent(screen.getByLabelText('Bottom field'), 'blur', { nativeEvent: {} });
    showKeyboard(380);
    expect(scroller.instance.scrollTo).not.toHaveBeenCalled();
  });

  it('ignores a native measurement that returns after unmount and removes listeners', () => {
    const { viewport, input, scroller, unmount } = form();
    let finishMeasure: () => void = () => { throw new Error('Measurement must be requested first.'); };
    viewport.measureInWindow.mockImplementation((callback: WindowMeasurement) => { finishMeasure = () => callback(0, 100, 390, 650); });
    showKeyboard();
    const scrollTo = scroller.instance.scrollTo;
    unmount();
    act(() => finishMeasure());
    expect(input.measureInWindow).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(removed).toHaveBeenCalledTimes(3);
  });

  it.each(['ios', 'android'] as const)('uses the native keyboard inset and drag behavior on %s lists', os => {
    const platform = jest.replaceProperty(Platform, 'OS', os);
    try {
      render(<KeyboardFlatList data={[]} renderItem={() => null} ListHeaderComponent={<KeyboardTextInput accessibilityLabel="Search" />} />);
      const listScroll = screen.UNSAFE_getByType(ScrollView);
      expect(listScroll.props.keyboardDismissMode).toBe(os === 'ios' ? 'interactive' : 'on-drag');
      expect(listScroll.props.automaticallyAdjustKeyboardInsets).toBe(os === 'ios');
      expect(listScroll.props.contentInsetAdjustmentBehavior).toBe('never');
      expect(listScroll.props.keyboardShouldPersistTaps).toBe('handled');
    } finally { platform.restore(); }
  });

  it('keeps automatic native-tab insets when explicitly requested by a page', () => {
    render(<><KeyboardScrollView contentInsetAdjustmentBehavior="automatic"><KeyboardTextInput accessibilityLabel="Page input" /></KeyboardScrollView><KeyboardFlatList contentInsetAdjustmentBehavior="automatic" data={[]} renderItem={() => null} /></>);
    for (const scroller of screen.UNSAFE_getAllByType(ScrollView)) expect(scroller.props.contentInsetAdjustmentBehavior).toBe('automatic');
  });
});

describe('sheet keyboard ownership', () => {
  function NestedSheets() {
    const [nested, setNested] = useState(false);
    return <SheetProvider><Sheet title="Settings" visible onClose={() => {}}>
      <KeyboardTextInput accessibilityLabel="Interests" multiline />
      <Action title="Languages" onPress={() => setNested(true)} />
    </Sheet><Sheet title="Languages" visible={nested} onClose={() => setNested(false)}><Action title="English" onPress={() => setNested(false)} /></Sheet></SheetProvider>;
  }

  it('dismisses on nested presentation changes and restores the parent scroll position in one modal', () => {
    const result = render(<NestedSheets />);
    fireEvent.scroll(screen.UNSAFE_getByType(ScrollView), { nativeEvent: { contentOffset: { x: 0, y: 420 } } });
    jest.mocked(Keyboard.dismiss).mockClear();
    fireEvent.press(screen.getByRole('button', { name: 'Languages' }));
    expect(Keyboard.dismiss).toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Languages' })).toBeTruthy();
    expect(screen.UNSAFE_getByType(ScrollView).props.contentOffset.y).toBe(0);
    fireEvent.press(screen.getByRole('button', { name: 'Close Languages' }));
    expect(screen.getByRole('header', { name: 'Settings' })).toBeTruthy();
    expect(screen.UNSAFE_getByType(ScrollView).props.contentOffset.y).toBe(420);
    expect(result.UNSAFE_getAllByType(Modal)).toHaveLength(1);
  });

  it('closes every nested sheet when its native tab loses focus', () => {
    function TabSheets({ active }: { active: boolean }) {
      const [settings, setSettings] = useState(true);
      const [languages, setLanguages] = useState(true);
      return <SheetProvider active={active}><Sheet title="Settings" visible={settings} onClose={() => setSettings(false)}><KeyboardTextInput accessibilityLabel="Interests" /></Sheet><Sheet title="Languages" visible={languages} onClose={() => setLanguages(false)}><View /></Sheet></SheetProvider>;
    }
    const result = render(<TabSheets active />);
    expect(screen.getByRole('header', { name: 'Languages' })).toBeTruthy();
    result.rerender(<TabSheets active={false} />);
    expect(screen.queryByRole('header', { name: 'Languages' })).toBeNull();
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false);
    result.rerender(<TabSheets active />);
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false);
  });

  it('does not dismiss after onShow focuses a typed reply', () => {
    const focus = jest.fn();
    render(<SheetProvider><Sheet title="Reply" visible onClose={() => {}} onShow={focus}><KeyboardTextInput accessibilityLabel="Reply" multiline /></Sheet></SheetProvider>);
    jest.mocked(Keyboard.dismiss).mockClear();
    fireEvent(screen.UNSAFE_getByType(Modal), 'show');
    expect(focus).not.toHaveBeenCalled();
    act(() => { jest.runOnlyPendingTimers(); });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).not.toHaveBeenCalled();
  });

  it('cancels a deferred input focus if its sheet is closed before the window is ready', () => {
    const focus = jest.fn();
    render(<SheetProvider><Sheet title="Reply" visible onClose={() => {}} onShow={focus}><KeyboardTextInput accessibilityLabel="Reply" multiline /></Sheet></SheetProvider>);
    fireEvent(screen.UNSAFE_getByType(Modal), 'show');
    fireEvent.press(screen.getByRole('button', { name: 'Close Reply' }));
    act(() => { jest.runOnlyPendingTimers(); });
    expect(focus).not.toHaveBeenCalled();
  });

  it('waits for the Android dialog enter animation before requesting input focus', () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const focus = jest.fn();
      render(<SheetProvider><Sheet title="Reply" visible onClose={() => {}} onShow={focus}><KeyboardTextInput accessibilityLabel="Reply" multiline /></Sheet></SheetProvider>);
      fireEvent(screen.UNSAFE_getByType(Modal), 'show');
      act(() => { jest.advanceTimersByTime(250); });
      expect(focus).not.toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(50); });
      expect(focus).toHaveBeenCalledTimes(1);
    } finally { platform.restore(); }
  });
});
