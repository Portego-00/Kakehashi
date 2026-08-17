describe("offlineVocabularyAudioService", () => {
  const loadService = ({
    getDirectoryInfo,
    queueCandidates = [],
    downloadAsync = jest.fn(async () => ({})),
  }: {
    getDirectoryInfo: jest.Mock;
    queueCandidates?: any[];
    downloadAsync?: jest.Mock;
  }) => {
    jest.resetModules();

    const getInfoAsync = jest.fn(async (uri: string) => {
      if (uri.endsWith("offline-vocabulary-audio")) {
        return getDirectoryInfo();
      }
      return { exists: false, isDirectory: false };
    });
    const db = {
      execAsync: jest.fn(async () => {}),
      getFirstAsync: jest.fn(async () => ({ value: "2026-08-10" })),
      getAllAsync: jest.fn(async () => queueCandidates),
    };

    jest.doMock("react-native", () => ({
      Platform: { OS: "android" },
    }));
    jest.doMock("expo-file-system/legacy", () => ({
      documentDirectory: "file:///documents/",
      getInfoAsync,
      makeDirectoryAsync: jest.fn(async () => {}),
      readDirectoryAsync: jest.fn(async () => []),
      downloadAsync,
      deleteAsync: jest.fn(async () => {}),
    }));
    jest.doMock("expo-sqlite", () => ({
      openDatabaseAsync: jest.fn(async () => db),
    }));
    jest.doMock("../../utils/cache", () => ({
      getAllSubjects: jest.fn(async () => []),
    }));
    jest.doMock("../../utils/permanentStorage", () => ({
      getSubjectsMetadata: jest.fn(() => ({ dataUpdatedAt: "2026-08-10" })),
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const service = require("../offlineVocabularyAudioService");
    return { service, getInfoAsync, downloadAsync };
  };

  it("deduplicates matching queue requests before initialization completes", async () => {
    let resolveDirectoryInfo: ((value: any) => void) | null = null;
    const directoryInfoPromise = new Promise((resolve) => {
      resolveDirectoryInfo = resolve;
    });
    const getDirectoryInfo = jest.fn(() => directoryInfoPromise);
    const { service, getInfoAsync } = loadService({ getDirectoryInfo });
    const options = {
      enabled: true,
      currentLevel: 12,
      voicePreference: "both" as const,
    };

    const firstQueue = service.queueOfflineVocabularyAudioDownloads(options);
    const secondQueue = service.queueOfflineVocabularyAudioDownloads(options);

    expect(getInfoAsync).toHaveBeenCalledTimes(1);
    resolveDirectoryInfo?.({ exists: true, isDirectory: true });
    await Promise.all([firstQueue, secondQueue]);
    expect(getInfoAsync).toHaveBeenCalledTimes(1);
  });

  it("limits Android background audio downloads to two workers", async () => {
    let activeDownloads = 0;
    let maximumActiveDownloads = 0;
    const downloadAsync = jest.fn(async () => {
      activeDownloads += 1;
      maximumActiveDownloads = Math.max(maximumActiveDownloads, activeDownloads);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      activeDownloads -= 1;
      return {};
    });
    const queueCandidates = Array.from({ length: 6 }, (_, index) => ({
      subject_id: index + 1,
      level: 12,
      url: `https://example.com/${index + 1}.mp3`,
      cache_filename: `audio-${index + 1}.mp3`,
    }));
    const { service } = loadService({
      getDirectoryInfo: jest.fn(async () => ({
        exists: true,
        isDirectory: true,
      })),
      queueCandidates,
      downloadAsync,
    });

    await service.queueOfflineVocabularyAudioDownloads({
      enabled: true,
      currentLevel: 12,
      voicePreference: "both",
    });

    expect(downloadAsync).toHaveBeenCalledTimes(queueCandidates.length);
    expect(maximumActiveDownloads).toBe(2);
  });
});
