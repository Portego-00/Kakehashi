import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

interface TipData {
  userId?: string | null;
  userEmail?: string | null;
  userUsername?: string | null;
  userLevel?: number | null;
  productId: string;
  tipType: string;
  amount?: string | null;
  transactionId?: string | null;
}

class TipService {
  async logTip(data: TipData): Promise<void> {
    if (!data.userId) {
      console.warn('⚠️ Skipping tip log because user identity is missing');
      return;
    }

    const payload = {
      user_id: data.userId,
      user_email: data.userEmail ?? null,
      user_username: data.userUsername ?? null,
      user_level: data.userLevel ?? null,
      product_id: data.productId,
      tip_type: data.tipType,
      amount: data.amount ?? null,
      platform: Platform.OS,
      transaction_id: data.transactionId ?? null,
    };

    try {
      const { error } = await supabase.from('tips').insert(payload);

      if (error) {
        console.error('❌ Failed to log tip:', error.message);
        return;
      }

      console.log('💰 Tip logged successfully');
    } catch (error) {
      console.error('❌ Error logging tip:', error);
    }
  }
}

export const tipService = new TipService();
