import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const SUPABASE_NOT_CONFIGURED_ERROR_CODE = 'SUPABASE_NOT_CONFIGURED';
export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable Supabase-backed features.';

type SupabaseDisabledError = Error & {
  code: typeof SUPABASE_NOT_CONFIGURED_ERROR_CODE;
};

type SupabaseDisabledResponse = {
  data: null;
  error: SupabaseDisabledError;
  count: null;
  status: 0;
  statusText: string;
};

function createSupabaseDisabledError(): SupabaseDisabledError {
  const error = new Error(SUPABASE_NOT_CONFIGURED_MESSAGE) as SupabaseDisabledError;
  error.name = 'SupabaseDisabledError';
  error.code = SUPABASE_NOT_CONFIGURED_ERROR_CODE;
  return error;
}

function createSupabaseDisabledResponse(): SupabaseDisabledResponse {
  return {
    data: null,
    error: createSupabaseDisabledError(),
    count: null,
    status: 0,
    statusText: 'Supabase not configured',
  };
}

function createDisabledQueryBuilder() {
  let proxy: unknown;
  const resolveResponse = () => Promise.resolve(createSupabaseDisabledResponse());

  proxy = new Proxy(function disabledSupabaseQueryBuilder() {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (
          onFulfilled?: (value: SupabaseDisabledResponse) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => resolveResponse().then(onFulfilled, onRejected);
      }

      if (prop === 'catch') {
        return (onRejected?: (reason: unknown) => unknown) =>
          resolveResponse().catch(onRejected);
      }

      if (prop === 'finally') {
        return (onFinally?: () => void) => resolveResponse().finally(onFinally);
      }

      if (prop === Symbol.toStringTag) {
        return 'Promise';
      }

      return proxy;
    },
    apply() {
      return proxy;
    },
  });

  return proxy;
}

function createDisabledStorageBucket() {
  return {
    upload: async () => createSupabaseDisabledResponse(),
    update: async () => createSupabaseDisabledResponse(),
    remove: async () => createSupabaseDisabledResponse(),
    download: async () => createSupabaseDisabledResponse(),
    list: async () => createSupabaseDisabledResponse(),
    move: async () => createSupabaseDisabledResponse(),
    copy: async () => createSupabaseDisabledResponse(),
    createSignedUrl: async () => createSupabaseDisabledResponse(),
    createSignedUrls: async () => createSupabaseDisabledResponse(),
    getPublicUrl: () => ({
      data: { publicUrl: '' },
      error: createSupabaseDisabledError(),
    }),
  };
}

function createDisabledRealtimeChannel() {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: async () => 'ok',
    send: async () => 'ok',
    track: async () => 'ok',
    untrack: async () => 'ok',
  };

  return channel;
}

function createDisabledSupabaseClient(): SupabaseClient {
  const queryBuilder = createDisabledQueryBuilder();
  const disabledAuthResponse = async () => createSupabaseDisabledResponse();

  return {
    from: () => queryBuilder,
    rpc: () => queryBuilder,
    channel: () => createDisabledRealtimeChannel(),
    removeChannel: async () => 'ok',
    removeAllChannels: async () => ['ok'],
    getChannels: () => [],
    storage: {
      from: () => createDisabledStorageBucket(),
    },
    auth: {
      getSession: async () => ({
        data: { session: null },
        error: createSupabaseDisabledError(),
      }),
      getUser: async () => ({
        data: { user: null },
        error: createSupabaseDisabledError(),
      }),
      signOut: disabledAuthResponse,
      signInWithPassword: disabledAuthResponse,
      signInWithOAuth: disabledAuthResponse,
      signUp: disabledAuthResponse,
      onAuthStateChange: () => ({
        data: {
          subscription: {
            id: 'supabase-disabled',
            callback: () => {},
            unsubscribe: () => {},
          },
        },
      }),
    },
  } as unknown as SupabaseClient;
}

if (!isSupabaseConfigured && typeof __DEV__ !== 'undefined' && __DEV__) {
  console.warn(SUPABASE_NOT_CONFIGURED_MESSAGE);
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : createDisabledSupabaseClient();
