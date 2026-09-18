import { Redirect, router } from 'expo-router';
import React from 'react';
import { useAuthStore } from '../../../src/utils/store';
import { canAccessConversation } from '../../../src/features/conversation/access';
import { ConversationRuntimeProvider } from '../../../src/features/conversation/conversation-runtime';
import { ConversationTabs } from '../../../src/features/conversation/conversation-tabs';

export default function ConversationLayout() {
  const user = useAuthStore(state => state.userData);
  const token = useAuthStore(state => state.apiToken);
  if (!token || !user?.id || !canAccessConversation(user.username)) return <Redirect href="/(app)/(tabs)" />;
  return <ConversationRuntimeProvider key={String(user.id)} accountId={String(user.id)} onExit={() => router.dismissTo('/(app)/(tabs)')}>
    <ConversationTabs />
  </ConversationRuntimeProvider>;
}
