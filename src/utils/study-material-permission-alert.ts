import * as Linking from "expo-linking";
import { Alert } from "react-native";
import {
  isStudyMaterialPermissionError,
  STUDY_MATERIAL_PERMISSION_MESSAGE,
  STUDY_MATERIAL_PERMISSION_TITLE,
  STUDY_MATERIAL_TOKEN_SETTINGS_URL,
} from "../../shared/study-material-permissions";

export function showStudyMaterialPermissionAlert(error: unknown): boolean {
  if (!isStudyMaterialPermissionError(error)) return false;
  Alert.alert(STUDY_MATERIAL_PERMISSION_TITLE, STUDY_MATERIAL_PERMISSION_MESSAGE, [
    { text: "Keep editing", style: "cancel" },
    {
      text: "Open API token settings",
      onPress: () => {
        void Linking.openURL(STUDY_MATERIAL_TOKEN_SETTINGS_URL).catch(() => {
          Alert.alert("Unable to open WaniKani", `Open ${STUDY_MATERIAL_TOKEN_SETTINGS_URL} in your browser to update your token permissions. Your changes are still here.`);
        });
      },
    },
  ]);
  return true;
}
