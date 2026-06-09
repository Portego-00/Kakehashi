import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useCallback, useRef, useState } from 'react';
import { Animated, Platform } from 'react-native';
import AudioSessionManager from '../modules/AudioSessionManager';

export function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  
  const micScaleAnim = useRef(new Animated.Value(1)).current;
  const micOpacityAnim = useRef(new Animated.Value(1)).current;

  // Speech recognition event listeners
  useSpeechRecognitionEvent("start", () => {
    console.log("Speech recognition started");
    setIsRecognizing(true);
    startMicAnimation();
  });

  useSpeechRecognitionEvent("end", async () => {
    console.log("Speech recognition ended");
    setIsRecognizing(false);
    setIsRecording(false);
    stopMicAnimation();
    
    // Override audio session to use speaker after microphone usage (iOS only)
    if (Platform.OS === 'ios') {
      try {
        await AudioSessionManager.overrideSpeaker();
        console.log("Audio session overridden to use speaker after speech recognition");
      } catch (error) {
        console.warn("Failed to override audio session:", error);
      }
    }
  });

  useSpeechRecognitionEvent("result", (event) => {
    console.log("Speech recognition result:", event);
    if (event.results && event.results.length > 0) {
      const recognizedText = event.results[0]?.transcript || '';
      const isFinal = event.isFinal || false;
      setSpeechTranscript(recognizedText);
      
      // Store the final state for the component to use
      if (isFinal) {
        setIsRecording(false);
      }
    }
  });

  useSpeechRecognitionEvent("error", async (event) => {
    console.log("Speech recognition error:", event.error, event.message);
    setIsRecognizing(false);
    setIsRecording(false);
    stopMicAnimation();
    setSpeechTranscript('');
    
    // Override audio session to use speaker after microphone usage (iOS only)
    if (Platform.OS === 'ios') {
      try {
        await AudioSessionManager.overrideSpeaker();
        console.log("Audio session overridden to use speaker after speech recognition error");
      } catch (error) {
        console.warn("Failed to override audio session:", error);
      }
    }
  });

  const checkSpeechPermissions = useCallback(async () => {
    try {
      const available = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (available) {
        const result = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        setPermissionsGranted(result.granted);
      }
    } catch (err) {
      console.error('Error checking speech permissions:', err);
    }
  }, []);

  const startMicAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(micScaleAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(micOpacityAnim, {
            toValue: 0.7,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(micScaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(micOpacityAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, [micScaleAnim, micOpacityAnim]);

  const stopMicAnimation = useCallback(() => {
    micScaleAnim.stopAnimation();
    micOpacityAnim.stopAnimation();
    Animated.parallel([
      Animated.timing(micScaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(micOpacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [micScaleAnim, micOpacityAnim]);

  const startSpeechRecognition = useCallback(async () => {
    if (!permissionsGranted) {
      try {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!result.granted) {
          return;
        }
        setPermissionsGranted(true);
      } catch (err) {
        console.error('Error requesting permissions:', err);
        return;
      }
    }

    try {
      setIsRecording(true);
      setSpeechTranscript('');
      
      await ExpoSpeechRecognitionModule.start({
        lang: "ja-JP", // Japanese language for Japanese conversation
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setIsRecording(false);
    }
  }, [permissionsGranted]);

  const stopSpeechRecognition = useCallback(async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      console.error('Error stopping speech recognition:', err);
    }
  }, []);

  const handleMicPress = useCallback(() => {
    if (isRecording) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  }, [isRecording, startSpeechRecognition, stopSpeechRecognition]);

  const clearTranscript = useCallback(() => {
    setSpeechTranscript('');
  }, []);

  return {
    isRecording,
    isRecognizing,
    speechTranscript,
    permissionsGranted,
    micScaleAnim,
    micOpacityAnim,
    checkSpeechPermissions,
    handleMicPress,
    clearTranscript,
  };
} 