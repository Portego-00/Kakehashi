import {registerRootComponent} from 'expo';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import React, {useEffect, useState} from 'react';
import {Pressable, StatusBar, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Ionicons} from '@expo/vector-icons';
import SubjectDetailsScreen from '../../../app/(app)/subject/[id]';
import ReviewQuestionScreen from '../../../src/components/ReviewQuestionScreen';
import LessonDetailScreen from '../../../src/components/LessonDetailScreen';
import {ThemeProvider} from '../../../src/utils/theme';
import {saveToPermanentStorage, PERMANENT_KEYS} from '../../../src/utils/permanentStorage';
import {catalog, subject} from './fixtures';
const Stack = createNativeStackNavigator();
// Harness-only timing survives native Modals hiding the background heartbeat.
const responsiveness = {lastTick: 0, latestGap: 0, maxGap: 0};
function resetResponsiveness() {
  responsiveness.lastTick = performance.now();
  responsiveness.latestGap = 0;
  responsiveness.maxGap = 0;
}
function Heartbeat() {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    resetResponsiveness();
    const timer = setInterval(() => {
      const now = performance.now();
      responsiveness.latestGap = Math.round(now - responsiveness.lastTick);
      responsiveness.maxGap = Math.max(responsiveness.maxGap, responsiveness.latestGap);
      responsiveness.lastTick = now;
      setBeat(value => value + 1);
    }, 100);
    return () => clearInterval(timer);
  }, []);
  return <Text accessibilityLabel={`Heartbeat ${beat}; JS latest gap ${responsiveness.latestGap} ms; JS max gap ${responsiveness.maxGap} ms`} style={{fontSize: 10}}>{beat}</Text>;
}
function Content() {
  const [view, setView] = useState('details');
  const [revision, setRevision] = useState(0);
  const lessonItem = {id: subject.id, subject};
  const relatedSubjects = Object.fromEntries(catalog.filter(item => subject.data.component_subject_ids.includes(item.id)).map(item => [item.id, item]));

  const button = (label: string, next: string) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => {if (next === 'lesson') resetResponsiveness(); setView(next); setRevision(value => value + 1);}} style={{padding: 12}}><Text>{label}</Text></Pressable>;
  return <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}><StatusBar barStyle="dark-content"/>
    <View style={{flexDirection: 'row'}}>{button('Open details', 'details')}{button('Wrong review', 'review')}{button('Open lesson', 'lesson')}<Heartbeat/></View>
    <View style={{flex: 1}}>{view === 'details' ? <SubjectDetailsScreen key={revision}/> : view === 'lesson' ? <LessonDetailScreen key={revision} item={lessonItem} batchItems={[lessonItem]} currentBatchIndex={0} relatedSubjects={relatedSubjects as any} typeCounts={{radical: 0, kanji: 0, vocabulary: 1}} progress={{current: 1, total: 1, batchCurrent: 1, batchTotal: 1}} canGoBack={false} canGoForward={false} onNext={() => setView('lesson-complete')} onPrev={() => {}} onExit={() => setView('lesson-exited')}/> : view === 'lesson-exited' ? <Text>Lesson exited</Text> : view === 'lesson-complete' ? <Text>Lesson completed</Text> : <ReviewQuestionScreen key={revision} item={lessonItem as any} questionType="reading" totalItems={10} currentItem={3} completedCount={3} correctAnswersCount={3} onAnswer={() => {}} onSkip={() => {}} onExit={() => setView('details')}/>}</View>
  </SafeAreaView>;
}
function Preview() {
  const [ready, setReady] = useState(false);
  const [loaded] = useFonts({'SourceHanSansJP-Regular': require('../../../assets/fonts/SourceHanSansJP-Regular.otf'), 'SourceHanSansJP-Bold': require('../../../assets/fonts/SourceHanSansJP-Bold.otf'), ...Ionicons.font});
  useEffect(() => {void saveToPermanentStorage(PERMANENT_KEYS.ALL_SUBJECTS, catalog, new Date().toISOString()).then(() => setReady(true));}, []);
  useEffect(() => {if (ready && loaded) void SplashScreen.hideAsync();}, [ready, loaded]);
  return <SafeAreaProvider><ThemeProvider><NavigationContainer><Stack.Navigator screenOptions={{headerShown: false, animation: 'none'}}><Stack.Screen name="Repro">{() => ready && loaded ? <Content/> : <View/>}</Stack.Screen></Stack.Navigator></NavigationContainer></ThemeProvider></SafeAreaProvider>;
}
registerRootComponent(Preview);
