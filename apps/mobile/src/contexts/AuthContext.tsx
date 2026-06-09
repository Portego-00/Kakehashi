import React, { createContext, useContext, useEffect, useRef, type PropsWithChildren } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../utils/store';
import { router, useSegments } from 'expo-router';

type AuthContextType = {
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  session: string | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function useSession() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const { apiToken, isLoading, isAuthenticated, setApiToken, logout, loadStoredToken } = useAuthStore();
  const segments = useSegments();
  const appState = useRef(AppState.currentState);
  const hasInitiallyLoaded = useRef(false);
  const hasReloadedThisForeground = useRef(false);
  const isReloadingToken = useRef(false);
  const hasRouteRecoveryAttempted = useRef(false);

  // Load stored token on mount
  useEffect(() => {
    loadStoredToken().finally(() => {
      hasInitiallyLoaded.current = true;
    });
  }, [loadStoredToken]);

  // Reload token when app returns from background (only if not already authenticated)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // Skip if initial load hasn't completed yet to prevent race condition
      if (!hasInitiallyLoaded.current) {
        appState.current = nextAppState;
        return;
      }

      // Reset the reload flag when going to background
      if (nextAppState.match(/inactive|background/) && appState.current === 'active') {
        hasReloadedThisForeground.current = false;
      }

      // If app is coming to foreground from background
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Only reload once per foreground return if not authenticated
        // (Zustand state may have been lost while in background)
        const currentState = useAuthStore.getState();
        if (
          (!currentState.isAuthenticated || !currentState.apiToken) &&
          !hasReloadedThisForeground.current &&
          !isReloadingToken.current
        ) {
          hasReloadedThisForeground.current = true;
          isReloadingToken.current = true;
          console.log('📱 App returned from background, reloading authentication...');
          loadStoredToken()
            .catch((error) => {
              console.error('Failed to reload token on app foreground:', error);
            })
            .finally(() => {
              isReloadingToken.current = false;
            });
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [loadStoredToken]);

  // Handle navigation based on authentication state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    if (isAuthenticated) {
      hasRouteRecoveryAttempted.current = false;
      if (inAuthGroup) {
        // Redirect to app if authenticated and in auth group
        router.replace('/(app)/(tabs)');
      }
      return;
    }

    if (inAuthGroup) {
      hasRouteRecoveryAttempted.current = false;
      return;
    }

    // Try one recovery pass before redirecting to login.
    // This avoids false redirects when auth state is briefly empty after resume.
    if (!hasRouteRecoveryAttempted.current && !isReloadingToken.current) {
      hasRouteRecoveryAttempted.current = true;
      isReloadingToken.current = true;
      loadStoredToken()
        .catch((error) => {
          console.error('Failed to recover token during route guard:', error);
        })
        .finally(() => {
          isReloadingToken.current = false;
        });
      return;
    }

    // Redirect to login if not authenticated and not in auth group
    router.replace('/(auth)/login');
  }, [isAuthenticated, segments, isLoading, loadStoredToken]);

  const signIn = async (token: string) => {
    await setApiToken(token);
  };

  const signOut = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <AuthContext.Provider
      value={{
        signIn,
        signOut,
        session: apiToken,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
