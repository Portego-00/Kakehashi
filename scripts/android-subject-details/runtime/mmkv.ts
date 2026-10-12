// Keep the production native storage and decoder, with isolated fixture IDs.
export * from 'react-native-mmkv/issue-110-original';
import {MMKV as NativeMMKV} from 'react-native-mmkv/issue-110-original';
export class MMKV extends NativeMMKV {
  constructor(configuration: any = {}) {
    super({...configuration, id: `issue-110-${configuration.id ?? 'default'}`});
  }
}
