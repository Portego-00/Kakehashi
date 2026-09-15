import { setIsAudioActiveAsync } from 'expo-audio';
import { Platform } from 'react-native';

import { Audio } from './expoAvCompat';

/** Prepare the shared iOS session even when speech is the app's first audio. */
export async function prepareNativeSpeech(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    playThroughEarpieceAndroid: false,
  });

  // Category configuration does not activate the shared session. Prepare it
  // explicitly instead of relying on an earlier audio player to have done so.
  await setIsAudioActiveAsync(true);
}
