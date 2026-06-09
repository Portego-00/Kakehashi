import { Stack } from 'expo-router';
import { useTheme } from '../../src/utils/theme';

export default function AuthLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.backgroundColor },
        gestureEnabled: false, // Disable swipe back gesture on login
      }}
    >
      <Stack.Screen name="login" />
    </Stack>
  );
}
