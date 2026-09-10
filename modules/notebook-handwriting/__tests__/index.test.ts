const mockModule = {
  isAvailable: jest.fn(() => true),
  edit: jest.fn(),
  clearDraft: jest.fn(),
  cancel: jest.fn(),
};
const mockPlatform = { OS: 'ios', isPad: true };
let mockInstalled = true;

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => mockInstalled ? mockModule : null,
}));
jest.mock('react-native', () => ({ Platform: mockPlatform }));

describe('optional iPad handwriting module', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockInstalled = true;
    mockPlatform.OS = 'ios';
    mockPlatform.isPad = true;
    mockModule.isAvailable.mockReturnValue(true);
  });

  it('safely reports unavailable in older binaries', async () => {
    mockInstalled = false;
    const api = jest.requireActual<typeof import('..')>('..');
    expect(api.isHandwritingAvailable()).toBe(false);
    await expect(api.editHandwriting()).rejects.toThrow('iPad app version');
    await expect(api.cancelHandwriting()).resolves.toBeUndefined();
    await expect(api.clearHandwritingDraft('account/page')).resolves.toBeUndefined();
  });

  it.each(['android', 'web'])('does not load PencilKit on %s', (platform) => {
    mockPlatform.OS = platform;
    const api = jest.requireActual<typeof import('..')>('..');
    expect(api.isHandwritingAvailable()).toBe(false);
    expect(mockModule.isAvailable).not.toHaveBeenCalled();
  });

  it('keeps handwriting unavailable on iPhone', () => {
    mockPlatform.isPad = false;
    expect(jest.requireActual<typeof import('..')>('..').isHandwritingAvailable()).toBe(false);
  });

  it('forwards the scoped drawing and distinguishes cancellation from export', async () => {
    const api = jest.requireActual<typeof import('..')>('..');
    const input = { inkBase64: 'ink', width: 768, height: 1024, theme: 'dark', draftKey: 'account/page/block' };
    const result = { inkBase64: 'updated', previewBase64: 'preview', width: 768, height: 1024 };
    mockModule.edit.mockResolvedValueOnce(result).mockResolvedValueOnce(null);
    expect(api.isHandwritingAvailable()).toBe(true);
    await expect(api.editHandwriting(input)).resolves.toEqual(result);
    expect(mockModule.edit).toHaveBeenCalledWith(input);
    await expect(api.editHandwriting(input)).resolves.toBeNull();
  });

  it('separates privacy dismissal from draft acknowledgment', async () => {
    const api = jest.requireActual<typeof import('..')>('..');
    await api.cancelHandwriting();
    expect(mockModule.cancel).toHaveBeenCalledTimes(1);
    expect(mockModule.clearDraft).not.toHaveBeenCalled();
    await api.clearHandwritingDraft('account/page/block');
    expect(mockModule.clearDraft).toHaveBeenCalledWith('account/page/block');
  });
});
