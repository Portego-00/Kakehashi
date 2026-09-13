const mockPlatform = { OS: "ios", isPad: true };
let mockModule: { isInlineAvailable?: () => boolean } | null;
const mockOptional = jest.fn((_name: string) => mockModule);
const mockViewManager = jest.fn((_module: string, _view: string) => () => null);
jest.mock("react-native", () => ({ Platform: mockPlatform }));
jest.mock("expo-modules-core", () => ({ requireOptionalNativeModule: (name: string) => mockOptional(name), requireNativeViewManager: (module: string, view: string) => mockViewManager(module, view) }));
function load() {
  let api!: typeof import("../native-inline-view");
  // Re-evaluate optional native capability once per simulated installed binary.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  jest.isolateModules(() => { api = require("../native-inline-view"); });
  return api;
}
beforeEach(() => { jest.clearAllMocks(); mockPlatform.OS = "ios"; mockPlatform.isPad = true; mockModule = null; });

it.each([null, {}, { isInlineAvailable: () => false }])("does not look up the native view in older binaries: %p", (module) => {
  mockModule = module;
  const api = load();
  expect(api.isNativeInlineHandwritingAvailable()).toBe(false);
  expect(api.getNativeInlineCanvas()).toBeNull();
  expect(mockViewManager).not.toHaveBeenCalled();
});

it.each([["ios", false], ["android", false]] as const)("does not mount the iPad canvas on %s with isPad=%s", (os, isPad) => {
  mockPlatform.OS = os; mockPlatform.isPad = isPad; mockModule = { isInlineAvailable: () => true };
  const api = load();
  expect(api.getNativeInlineCanvas()).toBeNull();
  expect(mockViewManager).not.toHaveBeenCalled();
  if (os === "android") expect(mockOptional).not.toHaveBeenCalled();
});

it("only resolves the view manager on demand after the native capability succeeds", () => {
  mockModule = { isInlineAvailable: () => true };
  const api = load();
  expect(api.isNativeInlineHandwritingAvailable()).toBe(true);
  expect(mockViewManager).not.toHaveBeenCalled();
  expect(api.getNativeInlineCanvas()).toBe(api.getNativeInlineCanvas());
  expect(mockViewManager).toHaveBeenCalledTimes(1);
  expect(mockViewManager).toHaveBeenCalledWith("NotebookHandwriting", "InlineHandwritingView");
});
