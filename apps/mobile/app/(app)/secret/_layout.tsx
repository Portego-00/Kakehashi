import { Stack } from "expo-router";
import { useTheme } from "../../../src/utils/theme";

export default function SecretLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.backgroundColor },
      }}
    />
  );
}
