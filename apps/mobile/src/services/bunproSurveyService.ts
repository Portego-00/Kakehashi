import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "../lib/supabase";

interface BunproSurveyResponseData {
  userId?: string | null;
  userUsername?: string | null;
  userLevel?: number | null;
  usesBunpro: boolean;
  wantsBunproInApp?: boolean | null;
  requestedFeatures?: string | null;
}

class BunproSurveyService {
  async logResponse(data: BunproSurveyResponseData): Promise<boolean> {
    const normalizedRequestedFeatures =
      data.usesBunpro && data.requestedFeatures?.trim()
        ? data.requestedFeatures.trim()
        : null;

    const payload = {
      user_id: data.userId ?? null,
      user_username: data.userUsername ?? null,
      user_level: data.userLevel ?? null,
      platform: Platform.OS,
      os_version: String(Platform.Version ?? ""),
      app_version: Constants.expoConfig?.version ?? null,
      uses_bunpro: data.usesBunpro,
      wants_bunpro_in_app: data.usesBunpro ? data.wantsBunproInApp ?? null : null,
      requested_features: normalizedRequestedFeatures,
    };

    try {
      const { error } = await supabase
        .from("bunpro_survey_responses")
        .insert(payload);

      if (error) {
        console.error("Failed to log Bunpro survey response:", error.message);
        return false;
      }

      console.log("Bunpro survey response logged successfully");
      return true;
    } catch (error) {
      console.error("Error logging Bunpro survey response:", error);
      return false;
    }
  }
}

export const bunproSurveyService = new BunproSurveyService();
