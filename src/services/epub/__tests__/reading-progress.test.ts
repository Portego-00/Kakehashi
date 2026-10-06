import { createReadingProgressSaver } from "../reading-progress";

describe("EPUB progress saving", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("flushes the final page when leaving before the debounce expires", async () => {
    const persist = jest.fn(async () => {});
    const saver = createReadingProgressSaver(persist, jest.fn());
    saver.queue({ bookId: "book", page: 5, totalPages: 100 });
    saver.queue({ bookId: "book", page: 6, totalPages: 100 });
    await saver.flush();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({ bookId: "book", page: 6, totalPages: 100 });
    jest.runAllTimers();
    await saver.flush();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("serializes slow writes so an older save cannot overwrite a newer page", async () => {
    let release!: () => void;
    const persist = jest.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; })).mockResolvedValue(undefined);
    const saver = createReadingProgressSaver(persist, jest.fn());
    saver.queue({ bookId: "book", page: 2, totalPages: 20 });
    const first = saver.flush();
    await Promise.resolve();
    saver.queue({ bookId: "book", page: 3, totalPages: 20 });
    const final = saver.flush();
    expect(persist).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, final]);
    expect(persist.mock.calls.map(([progress]) => progress.page)).toEqual([2, 3]);
  });

  it("retries a failed final save on the next lifecycle flush", async () => {
    const persist = jest.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(undefined);
    const onError = jest.fn();
    const saver = createReadingProgressSaver(persist, onError);
    saver.queue({ bookId: "book", page: 7, totalPages: 10 });
    await saver.flush();
    await saver.flush();
    expect(persist).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("never retries an older failed page after a newer page has been saved", async () => {
    let rejectOld!: (error: Error) => void;
    const persist = jest.fn().mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectOld = reject; })).mockResolvedValue(undefined);
    const saver = createReadingProgressSaver(persist, jest.fn());
    saver.queue({ bookId: "book", page: 2, totalPages: 20 });
    void saver.flush();
    await Promise.resolve();
    saver.queue({ bookId: "book", page: 3, totalPages: 20 });
    const final = saver.flush();
    rejectOld(new Error("write failed"));
    await final;
    await saver.flush();
    expect(persist.mock.calls.map(([progress]) => progress.page)).toEqual([2, 3]);
  });
});
