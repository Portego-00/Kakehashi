import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDelayedDeletion } from "../useDelayedDeletion";

describe("useDelayedDeletion", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows a pending removal to be undone before persistence", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useDelayedDeletion({ delay: 7_000, onCommit: commit }));
    act(() => result.current.requestDeletion({ id: "book-1" }));
    expect(result.current.pending).toEqual({ id: "book-1" });
    act(() => result.current.undoDeletion());
    act(() => vi.advanceTimersByTime(7_000));
    expect(result.current.pending).toBeNull();
    expect(commit).not.toHaveBeenCalled();
  });

  it("persists after the undo window and commits an older pending item before replacing it", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useDelayedDeletion({ delay: 7_000, onCommit: commit }));
    act(() => result.current.requestDeletion({ id: "video-1" }));
    act(() => result.current.requestDeletion({ id: "video-2" }));
    expect(commit).toHaveBeenCalledWith({ id: "video-1" });
    act(() => vi.advanceTimersByTime(7_000));
    expect(commit).toHaveBeenCalledWith({ id: "video-2" });
    expect(result.current.pending).toBeNull();
  });

  it("persists a pending removal when the library is closed", () => {
    const commit = vi.fn();
    const { result, unmount } = renderHook(() => useDelayedDeletion({ delay: 7_000, onCommit: commit }));
    act(() => result.current.requestDeletion({ id: "manga-1" }));
    unmount();
    expect(commit).toHaveBeenCalledWith({ id: "manga-1" });
  });
});
