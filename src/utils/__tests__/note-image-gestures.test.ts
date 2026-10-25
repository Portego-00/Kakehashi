import { containNoteImageTransform, noteImageTouchGeometry, pinchNoteImage } from "../../../shared/note-image-gestures";

describe("note image gestures", () => {
  it("keeps the same image point beneath an off-center pinch", () => {
    const origin = { scale: 1, x: 0, y: 0 };
    const anchor = { x: 30, y: -60 };
    const zoomed = pinchNoteImage(origin, 2, anchor);
    expect((anchor.x - zoomed.x) / zoomed.scale).toBe(anchor.x);
    expect((anchor.y - zoomed.y) / zoomed.scale).toBe(anchor.y);
    expect(pinchNoteImage(zoomed, 1, anchor)).toEqual(origin);
  });
  it("tracks movement of the fingers while pinching", () => {
    expect(pinchNoteImage({ scale: 1, x: 0, y: 0 }, 2, { x: 0, y: 0 }, { x: 40, y: -20 })).toEqual({ scale: 2, x: 40, y: -20 });
    expect(noteImageTouchGeometry([{ x: 10, y: 20 }, { x: 30, y: 20 }])).toEqual({ count: 2, x: 20, y: 20, distance: 20 });
  });
  it("centers a portrait on the axis that fits and keeps panning within its edges", () => {
    const bounds = { width: 300, height: 400, imageWidth: 200, imageHeight: 800 };
    expect(containNoteImageTransform({ scale: 2, x: 999, y: -999 }, bounds)).toEqual({ scale: 2, x: 0, y: -200 });
    expect(containNoteImageTransform({ scale: 1, x: 99, y: 99 }, bounds)).toEqual({ scale: 1, x: 0, y: 0 });
  });
  it("keeps a landscape image centered vertically and limits zoom", () => {
    const bounds = { width: 300, height: 400, imageWidth: 1200, imageHeight: 200 };
    expect(containNoteImageTransform({ scale: 2, x: 999, y: 999 }, bounds)).toEqual({ scale: 2, x: 150, y: 0 });
    expect(pinchNoteImage({ scale: 1, x: 0, y: 0 }, 20, { x: 0, y: 0 }).scale).toBe(5);
    expect(pinchNoteImage({ scale: 2, x: 0, y: 0 }, 0.1, { x: 0, y: 0 }).scale).toBe(1);
  });
});
