import WaniKaniBackgroundFetch from '../modules/WaniKaniBackgroundFetch';

// Debug helper functions for background fetch
export const BackgroundFetchDebug = {
  // Check current status
  getStatus: () => {
    if (!WaniKaniBackgroundFetch) {
      return null;
    }

    const status = WaniKaniBackgroundFetch.getBackgroundFetchStatus();
    return status;
  },

  // Manually trigger fetch
  triggerFetch: async () => {
    if (!WaniKaniBackgroundFetch) {
      return;
    }

    try {
      const result = await WaniKaniBackgroundFetch.triggerBackgroundFetchManually();
      return result;
    } catch (error) {
      throw error;
    }
  },

  // Check logs in console
  showInstructions: () => {
    // No-op - debug function disabled
  }
};

// Make it available globally in DEV mode
if (__DEV__) {
  (global as any).BackgroundFetchDebug = BackgroundFetchDebug;
}