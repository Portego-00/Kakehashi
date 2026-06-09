import { NativeModules } from 'react-native';

interface AudioSessionManagerInterface {
  overrideSpeaker(): Promise<string>;
}

const { AudioSessionManager } = NativeModules;

export default AudioSessionManager as AudioSessionManagerInterface;