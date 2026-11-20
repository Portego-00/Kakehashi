import { File, Paths } from "expo-file-system";
import { deleteAsync, StorageAccessFramework } from "expo-file-system/legacy";
import { Platform, Share } from "react-native";

import { MAX_SETTINGS_FILE_BYTES, parseSettingsBackup } from "./settings-transfer";

const FILE_NAME = "kakehashi-settings";

export async function pickSettingsBackup() {
  let picked: File | File[];
  try {
    // Accept JSON even when a document provider reports a generic MIME type.
    picked = await File.pickFileAsync(undefined, "*/*");
  } catch (error) {
    if (error instanceof Error && /cancel(?:l)?ed by the user/i.test(error.message)) return null;
    throw new Error("The file picker couldn’t open. Try again.");
  }
  const file = Array.isArray(picked) ? picked[0] : picked;
  if (!file) return null;

  if (file.size > MAX_SETTINGS_FILE_BYTES) {
    throw new Error("Settings files must be 1 MB or smaller.");
  }
  const contents = await file.text().catch(() => {
    throw new Error("Kakehashi couldn’t read that file.");
  });
  return parseSettingsBackup(contents);
}

export async function exportSettingsFile(contents: string) {
  if (Platform.OS === "android") {
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) return;

    const uri = await StorageAccessFramework.createFileAsync(
      permissions.directoryUri, FILE_NAME, "application/json",
    );
    try {
      await StorageAccessFramework.writeAsStringAsync(uri, contents);
    } catch (error) {
      await deleteAsync(uri, { idempotent: true }).catch(() => {});
      throw error;
    }
    return "saved";
  }

  const file = new File(Paths.cache, `${FILE_NAME}.json`);
  await file.write(contents);
  await Share.share({ url: file.uri });
}
