import { scheduleIdleTask } from "../scheduleIdleTask";

const originalRequestIdleCallback = global.requestIdleCallback;
const originalCancelIdleCallback = global.cancelIdleCallback;

afterEach(() => {
  global.requestIdleCallback = originalRequestIdleCallback;
  global.cancelIdleCallback = originalCancelIdleCallback;
  jest.useRealTimers();
});

it("defers work until idle and supplies a bounded wait", () => {
  let runIdleTask!: IdleRequestCallback;
  global.requestIdleCallback = jest.fn((callback) => {
    runIdleTask = callback;
    return 42;
  });
  const task = jest.fn();

  scheduleIdleTask(task, 350);

  expect(task).not.toHaveBeenCalled();
  expect(global.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
    timeout: 350,
  });
  runIdleTask({ didTimeout: false, timeRemaining: () => 50 });
  expect(task).toHaveBeenCalledTimes(1);
});

it("cancels work even if an idle callback is delivered after cancellation", () => {
  let runIdleTask!: IdleRequestCallback;
  global.requestIdleCallback = jest.fn((callback) => {
    runIdleTask = callback;
    return 42;
  });
  global.cancelIdleCallback = jest.fn();
  const task = jest.fn();
  const scheduled = scheduleIdleTask(task);

  scheduled.cancel();
  scheduled.cancel();
  runIdleTask({ didTimeout: true, timeRemaining: () => 0 });

  expect(global.cancelIdleCallback).toHaveBeenCalledTimes(1);
  expect(global.cancelIdleCallback).toHaveBeenCalledWith(42);
  expect(task).not.toHaveBeenCalled();
});

it("leaves a completed task alone when its owner cleans up", () => {
  global.requestIdleCallback = jest.fn((callback) => {
    callback({ didTimeout: false, timeRemaining: () => 50 });
    return 42;
  });
  global.cancelIdleCallback = jest.fn();
  const task = jest.fn();

  scheduleIdleTask(task).cancel();

  expect(task).toHaveBeenCalledTimes(1);
  expect(global.cancelIdleCallback).not.toHaveBeenCalled();
});

it("supports browsers without idle callbacks", () => {
  jest.useFakeTimers();
  global.requestIdleCallback = undefined as never;
  const task = jest.fn();
  scheduleIdleTask(task);

  expect(task).not.toHaveBeenCalled();
  jest.runOnlyPendingTimers();
  expect(task).toHaveBeenCalledTimes(1);
});

it("cancels the browser fallback before it runs", () => {
  jest.useFakeTimers();
  global.requestIdleCallback = undefined as never;
  const task = jest.fn();
  scheduleIdleTask(task).cancel();

  jest.runOnlyPendingTimers();
  expect(task).not.toHaveBeenCalled();
});
