import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type HandwritingInput = {
  inkBase64?: string;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  /** Stable account/page/block scope, containing no credentials. */
  draftKey?: string;
};

export type HandwritingResult = {
  inkBase64: string;
  previewBase64: string;
  width: number;
  height: number;
};

type NativeHandwritingModule = {
  isAvailable(): boolean;
  edit(input: HandwritingInput): Promise<HandwritingResult | null>;
  clearDraft(draftKey: string): Promise<void>;
  cancel(): Promise<void>;
};

const nativeModule = Platform.OS === 'ios'
  ? requireOptionalNativeModule<NativeHandwritingModule>('NotebookHandwriting')
  : null;

/** Older binaries and non-iPad devices can still display the saved preview. */
export function isHandwritingAvailable(): boolean {
  return Platform.OS === 'ios' && Platform.isPad === true && nativeModule?.isAvailable() === true;
}

/** null means cancellation; errors do not modify the caller's existing drawing. */
export async function editHandwriting(input: HandwritingInput = {}): Promise<HandwritingResult | null> {
  if (!isHandwritingAvailable() || !nativeModule) {
    throw new Error('Handwriting requires an iPad app version with handwriting support.');
  }
  return nativeModule.edit(input);
}

/** Call only after the notebook reference has been durably saved. */
export async function clearHandwritingDraft(draftKey: string): Promise<void> {
  await nativeModule?.clearDraft(draftKey);
}

/** Dismiss on account changes or unmount; retain the scoped recovery draft. */
export async function cancelHandwriting(): Promise<void> {
  await nativeModule?.cancel();
}
