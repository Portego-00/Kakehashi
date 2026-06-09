import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

interface ErrorLog {
  message: string;
  stack?: string;
  component_stack?: string;
  is_fatal: boolean;
  app_version: string | null;
  platform: string;
  user_id?: string;
  username?: string;
  email?: string;
  extra?: Record<string, unknown>;
}

class ErrorService {
  private isLogging = false;
  private userId: string | null = null;
  private username: string | null = null;
  private email: string | null = null;

  /**
   * Set the current user info for error attribution
   */
  setUser(user: { id?: string | null; username?: string | null; email?: string | null }) {
    this.userId = user.id ?? null;
    this.username = user.username ?? null;
    this.email = user.email ?? null;
  }

  /**
   * Log an error to Supabase
   */
  async logError(
    error: Error,
    options: {
      isFatal?: boolean;
      componentStack?: string;
      extra?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    // Prevent concurrent logging
    if (this.isLogging) return;

    try {
      this.isLogging = true;

      const errorLog: ErrorLog = {
        message: error.message || 'Unknown error',
        stack: error.stack,
        component_stack: options.componentStack,
        is_fatal: options.isFatal ?? false,
        app_version: Constants.expoConfig?.version ?? null,
        platform: Platform.OS,
        user_id: this.userId ?? undefined,
        username: this.username ?? undefined,
        email: this.email ?? undefined,
        extra: options.extra,
      };

      const { error: dbError } = await supabase.from('error_logs').insert(errorLog);

      if (dbError) {
        // Table might not exist yet - log locally and continue
        console.log('❌ Could not log error to Supabase:', dbError.message);
        console.log('❌ Original error:', error.message);
        return;
      }

      console.log('❌ Error logged to Supabase');
    } catch (loggingError) {
      // Don't let error logging errors crash the app
      console.error('Failed to log error:', loggingError);
    } finally {
      this.isLogging = false;
    }
  }

  /**
   * Initialize global error handlers for uncaught JS errors
   */
  initializeGlobalHandlers() {
    // Handle uncaught JS errors
    const originalHandler = ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler((error, isFatal) => {
      // Log to our service
      this.logError(error, { isFatal }).catch(() => {
        // Ignore logging errors
      });

      // Call the original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });

    console.log('❌ Global error handlers initialized');
  }
}

// Export singleton instance
export const errorService = new ErrorService();
