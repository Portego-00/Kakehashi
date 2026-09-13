import type { NotebookDrawingReference, NotebookInkFormat, NotebookPaperColor } from "../../../web/src/features/notebooks/handwriting";

export type NativeInkSize = { width: number; height: number };
export type NativeInkRect = NativeInkSize & { x: number; y: number };
export type NativeInkGeometry = { rect: NativeInkRect; clipRect: NativeInkRect; revision: number; viewport: NativeInkSize };
export type NativeInkStart = NotebookDrawingReference & { blockId: string; geometry: NativeInkGeometry; inkFormat: NotebookInkFormat; paperColor?: NotebookPaperColor };
export type NativeInkState = NativeInkSize & {
  blockId: string; sessionId: string; revision: number; minimumWidth: number; minimumHeight: number;
  canUndo: boolean; canRedo: boolean; hasInk: boolean; busy: boolean; error?: string;
};
export interface NativeInlineHandwritingProps {
  nativeHandwritingAvailable?: boolean;
  nativeHandwritingState?: NativeInkState | null;
  onNativeHandwritingStart?: (input: NativeInkStart) => Promise<void>;
  onNativeHandwritingLayout?: (blockId: string, geometry: NativeInkGeometry) => Promise<void>;
  onNativeHandwritingCommand?: (blockId: string, command: "undo" | "redo" | "tools" | "finger", enabled?: boolean) => Promise<void>;
  onNativeHandwritingResize?: (blockId: string, size: NativeInkSize) => Promise<void>;
  onNativeHandwritingPaperColor?: (blockId: string, paperColor: NotebookPaperColor) => Promise<void>;
  onNativeHandwritingSave?: (blockId: string, sourceId: string) => Promise<NotebookDrawingReference>;
  onNativeHandwritingCommitted?: (blockId: string, drawingId: string) => Promise<void>;
  onNativeHandwritingClose?: (blockId: string) => Promise<void>;
}
