import { requireNativeViewManager, requireOptionalNativeModule } from "expo-modules-core";
import type { ComponentType, Ref } from "react";
import { Platform, type NativeSyntheticEvent, type ViewProps } from "react-native";
import type { NotebookDrawingPayload } from "./handwriting-api";
import type { NativeInkSize } from "./native-inline-contract";

export type NativeCanvasState = NativeInkSize & { sessionId: string; revision: number; minimumWidth: number; minimumHeight: number; canUndo: boolean; canRedo: boolean; hasInk: boolean; recovered?: boolean };
export type NativeCanvasExport = NotebookDrawingPayload & { sessionId: string; revision: number };
export type NativeCanvasHandle = {
  exportDrawing(): Promise<NativeCanvasExport>;
  flushDraft(): Promise<void>;
  acknowledgeSave(revision: number, drawingId: string): Promise<boolean>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  resizePaper(width: number, height: number): Promise<NativeCanvasState>;
  setToolsVisible(visible: boolean): Promise<void>;
};
export type NativeCanvasProps = ViewProps & {
  ref?: Ref<NativeCanvasHandle>;
  document: NativeInkSize & { sessionId: string; draftKey: string; sourceId: string; acceptedRecoverySourceId?: string; inkBase64?: string; inkFormat: "pencilkit-v1" | "strokes-v1" };
  paperSize: NativeInkSize;
  paperColor: string;
  paperStyle: "light" | "dark";
  active: boolean;
  inputEnabled: boolean;
  fingerDrawing: boolean;
  onReady: (event: NativeSyntheticEvent<NativeCanvasState>) => void;
  onChange: (event: NativeSyntheticEvent<NativeCanvasState>) => void;
  onError: (event: NativeSyntheticEvent<{ sessionId: string; message: string }>) => void;
  onToolActivity?: (event: NativeSyntheticEvent<{ sessionId: string; drawing: boolean }>) => void;
};
const module = Platform.OS === "ios" ? requireOptionalNativeModule<{ isInlineAvailable?: () => boolean }>("NotebookHandwriting") : null;
export function isNativeInlineHandwritingAvailable() {
  return Platform.OS === "ios" && Platform.isPad === true && module?.isInlineAvailable?.() === true;
}
let component: ComponentType<NativeCanvasProps> | undefined;
export function getNativeInlineCanvas() {
  if (!isNativeInlineHandwritingAvailable()) return null;
  component ??= requireNativeViewManager<NativeCanvasProps>("NotebookHandwriting", "InlineHandwritingView");
  return component;
}
