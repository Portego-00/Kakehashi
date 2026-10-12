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
import {ThemeProvider} from '../../../src/utils/theme';
import {saveToPermanentStorage, PERMANENT_KEYS} from '../../../src/utils/permanentStorage';
import {catalog, subject} from './fixtures';
const Stack = createNativeStackNavigator();
function Heartbeat() {
  const [beat, setBeat] = useState(0);
  useEffect(() => {const timer = setInterval(() => setBeat(value => value + 1), 100); return () => clearInterval(timer);}, []);
  return <Text accessibilityLabel={`Heartbeat ${beat}`} style={{fontSize: 10}}>{beat}</Text>;
}
function Content() {
  const [view, setView] = useState('details');
  const [revision, setRevision] = useState(0);

  const button = (label: string, next: string) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => {setView(next); setRevision(value => value + 1);}} style={{padding: 12}}><Text>{label}</Text></Pressable>;
  return <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}><StatusBar barStyle="dark-content"/>
    <View style={{flexDirection: 'row'}}>{button('Open details', 'details')}{button('Wrong review', 'review')}<Heartbeat/></View>
    <View style={{flex: 1}}>{view === 'details' ? <SubjectDetailsScreen key={revision}/> : <ReviewQuestionScreen key={revision} item={{id: subject.id, subject} as any} questionType="reading" totalItems={10} currentItem={3} completedCount={3} correctAnswersCount={3} onAnswer={() => {}} onSkip={() => {}} onExit={() => setView('details')}/>}</View>
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
