import { router } from 'expo-router';
import React from 'react';
import { Keyboard } from 'react-native';
import { supportsNativeTabs } from '../../utils/nativeTabs';
import { ConversationScreen, type ConversationPage } from './conversation-screen';
import { useConversationRuntime } from './conversation-runtime';

const destinations = { talk: '/(app)/conversation', themes: '/(app)/conversation/themes', words: '/(app)/conversation/words' } as const;
export function ConversationTabPage({ page }: { page: ConversationPage }) {
  const runtime = useConversationRuntime();
  if (!runtime) throw new Error('Conversation tabs require a shared session.');
  return <ConversationScreen accountId={runtime.controller.accountId} page={page} navigationMode={supportsNativeTabs() ? 'native' : 'tabs'} onNavigate={destination => {
    Keyboard.dismiss(); router.navigate(destinations[destination]);
  }} />;
}
