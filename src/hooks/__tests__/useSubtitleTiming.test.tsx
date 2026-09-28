import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubtitleTiming } from '../useSubtitleTiming';
import { normalizeSubtitleOffset, subtitlePlaybackTime } from '../../../shared/subtitleTiming';

beforeEach(() => jest.clearAllMocks());
it('saves an offset per video and resets timing', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue('500');
  const { result } = renderHook(() => useSubtitleTiming('video-a'));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.offsetMs).toBe(500);
  act(() => result.current.setOffsetMs(700));
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('video-subtitle-offset:video-a', '700'));
  act(() => result.current.setOffsetMs(0));
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('video-subtitle-offset:video-a', '0'));
});
it('does not carry an offset to a new video or accept a stale load', async () => {
  let finishFirst!: (value: string) => void;
  jest.mocked(AsyncStorage.getItem).mockImplementation(key => key.endsWith('a') ? new Promise(resolve => { finishFirst = resolve; }) : Promise.resolve('-300'));
  const { result, rerender } = renderHook(({ video }) => useSubtitleTiming(video), { initialProps: { video: 'a' } });
  await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
  rerender({ video: 'b' });
  await waitFor(() => expect(result.current.offsetMs).toBe(-300));
  await act(async () => finishFirst('900'));
  expect(result.current.offsetMs).toBe(-300);
});
it('clamps offsets and shifted seeks to valid times', () => {
  expect(normalizeSubtitleOffset(NaN)).toBe(0);
  expect(normalizeSubtitleOffset(100000)).toBe(60000);
  expect(normalizeSubtitleOffset(-100000)).toBe(-60000);
  expect(subtitlePlaybackTime(1000, -2000)).toBe(0);
  expect(subtitlePlaybackTime(1000, 500)).toBe(1500);
  expect(subtitlePlaybackTime(9000, 2000, 10000)).toBe(10000);
});
