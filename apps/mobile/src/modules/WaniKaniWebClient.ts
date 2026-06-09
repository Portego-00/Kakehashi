import { NativeModules } from 'react-native';

export interface LoginResult {
  cookie: string;
  apiToken: string;
}

export interface WaniKaniWebClientInterface {
  login(email: string, password: string): Promise<LoginResult>;
}

const { WaniKaniWebClientBridge } = NativeModules;

export default WaniKaniWebClientBridge as WaniKaniWebClientInterface;