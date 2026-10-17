import { File } from "expo-file-system";
import { MAX_PACKAGE_BYTES, parsePackageText } from "./resolver";

export async function selectTranslationPackage() {
  try {
    // JSON can be reported as text/plain by Android providers; validate contents ourselves.
    const picked = await File.pickFileAsync();
    const file = Array.isArray(picked) ? picked[0] : picked;
    if (!file) return null;
    if (file.size > MAX_PACKAGE_BYTES) throw new Error("Translation files must be 20 MB or smaller.");
    return parsePackageText(await file.text());
  } catch (error) {
    if (/cancel|abort/i.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
}
