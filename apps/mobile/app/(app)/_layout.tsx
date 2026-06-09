import { Stack } from 'expo-router';
import { useTheme } from '../../src/utils/theme';

const INTENTIONAL_EXIT_SCREEN_OPTIONS = {
  gestureEnabled: false,
  fullScreenGestureEnabled: false,
} as const;

export default function AppLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      initialRouteName="(tabs)"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.backgroundColor },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(bunpro-tabs)" />
      <Stack.Screen name="bunpro-reviews" options={INTENTIONAL_EXIT_SCREEN_OPTIONS} />
      <Stack.Screen name="bunpro-lessons" options={INTENTIONAL_EXIT_SCREEN_OPTIONS} />
      {/* Disable swipe-to-go-back on active study flows that require explicit exit confirmation */}
      <Stack.Screen name="reviews" options={INTENTIONAL_EXIT_SCREEN_OPTIONS} />
      <Stack.Screen name="lessons" options={INTENTIONAL_EXIT_SCREEN_OPTIONS} />
      <Stack.Screen name="recent-lessons-review" options={INTENTIONAL_EXIT_SCREEN_OPTIONS} />
      <Stack.Screen name="custom-review" options={INTENTIONAL_EXIT_SCREEN_OPTIONS} />
      <Stack.Screen name="custom-lesson" options={INTENTIONAL_EXIT_SCREEN_OPTIONS} />
      <Stack.Screen name="test-session" options={INTENTIONAL_EXIT_SCREEN_OPTIONS} />
      <Stack.Screen name="meaning-reading-session" options={INTENTIONAL_EXIT_SCREEN_OPTIONS} />
      <Stack.Screen name="kana-kanji-session" options={INTENTIONAL_EXIT_SCREEN_OPTIONS} />
      <Stack.Screen name="writing-practice-session" options={INTENTIONAL_EXIT_SCREEN_OPTIONS} />
      <Stack.Screen
        name="writing-practice-freehand-session"
        options={INTENTIONAL_EXIT_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="context-sentence-practice-session"
        options={INTENTIONAL_EXIT_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="listening-practice-session"
        options={INTENTIONAL_EXIT_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="crossword-session"
        options={INTENTIONAL_EXIT_SCREEN_OPTIONS}
      />
      <Stack.Screen
        name="wordle-session"
        options={INTENTIONAL_EXIT_SCREEN_OPTIONS}
      />
      <Stack.Screen 
        name="tip-developer" 
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
