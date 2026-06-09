import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const LAST_SESSION_KEY = 'analytics_last_session';
const SESSION_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between sessions

function getLocalDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

class AnalyticsService {
  private isLogging = false;

  /**
   * Log a new app session for the user.
   * Only logs if enough time has passed since the last session to avoid duplicates.
   */
  async logSession(
    userId: string,
    username?: string | null,
    userLevel?: number | null
  ): Promise<void> {
    if (this.isLogging) return;

    try {
      this.isLogging = true;
      const now = Date.now();
      const currentDayKey = getLocalDayKey(now);

      // Check if we recently logged a session
      const lastSession = await AsyncStorage.getItem(LAST_SESSION_KEY);
      if (lastSession) {
        const lastTime = parseInt(lastSession, 10);
        if (!Number.isNaN(lastTime)) {
          const isSameDay = getLocalDayKey(lastTime) === currentDayKey;
          if (isSameDay && now - lastTime < SESSION_COOLDOWN_MS) {
            console.log('📊 Session already logged recently, skipping');
            return;
          }
        }
      }

      const appVersion = Constants.expoConfig?.version ?? null;
      const platform = Platform.OS;

      const { error } = await supabase.from('app_sessions').insert({
        user_id: userId,
        user_name: username ?? null,
        user_level: userLevel ?? null,
        app_version: appVersion,
        platform: platform,
      });

      if (error) {
        // Table might not exist yet - this is fine, just log and continue
        console.log('📊 Could not log session:', error.message);
        return;
      }

      // Store timestamp of this session
      await AsyncStorage.setItem(LAST_SESSION_KEY, now.toString());
      console.log('📊 Session logged successfully');
    } catch (error) {
      console.error('Error logging session:', error);
    } finally {
      this.isLogging = false;
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
