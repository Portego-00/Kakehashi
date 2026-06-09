import * as Linking from 'expo-linking';
import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

interface RateAppData {
  userId?: string | null;
  userEmail?: string | null;
  userUsername?: string | null;
  userLevel?: number | null;
  source: 'settings' | 'tip-developer' | 'Streak';
}

class RateAppService {
  private getReviewUrls(): string[] {
    const defaultReviewUrl = Platform.select({
      ios: 'https://apps.apple.com/app/id6757765444?action=write-review',
      android:
        'market://details?id=com.portego00.kakehashi&showAllReviews=true',
      default: 'https://apps.apple.com/app/id6757765444?action=write-review',
    });

    return [defaultReviewUrl, StoreReview.storeUrl()].filter(
      (url): url is string => Boolean(url),
    );
  }

  private async openReviewUrl(): Promise<boolean> {
    const reviewUrls = this.getReviewUrls();

    for (const reviewUrl of reviewUrls) {
      try {
        const canOpenReviewUrl = await Linking.canOpenURL(reviewUrl);
        if (!canOpenReviewUrl) {
          continue;
        }

        await Linking.openURL(reviewUrl);
        return true;
      } catch (error) {
        console.error('❌ Failed to open review URL:', reviewUrl, error);
      }
    }

    return false;
  }

  async openRateAppFlow(): Promise<boolean> {
    const didOpenReviewUrl = await this.openReviewUrl();
    if (didOpenReviewUrl) {
      return true;
    }

    try {
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
        return true;
      }
    } catch (error) {
      console.error('❌ Store review request failed after URL fallback:', error);
    }

    return false;
  }

  async logRateAppClick(data: RateAppData): Promise<void> {
    if (!data.userId) {
      console.warn('⚠️ Skipping rate-app log because user identity is missing');
      return;
    }

    const payload = {
      user_id: data.userId,
      user_email: data.userEmail ?? null,
      user_username: data.userUsername ?? null,
      user_level: data.userLevel ?? null,
      source: data.source,
      platform: Platform.OS,
    };

    try {
      const { error } = await supabase.from('rate_app_clicks').insert(payload);

      if (error) {
        console.error('❌ Failed to log rate app click:', error.message);
        return;
      }

      console.log('⭐ Rate app click logged successfully');
    } catch (error) {
      console.error('❌ Error logging rate app click:', error);
    }
  }
}

export const rateAppService = new RateAppService();
