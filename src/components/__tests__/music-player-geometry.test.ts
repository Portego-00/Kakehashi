import {
  getFoldedPlayerFrames,
  getFullBleedPlayerVideoGeometry,
} from "../music-player-geometry";

const foldedVertical = {
  container: { x: 12, y: 30, width: 669, height: 951 },
  primary: { x: 12, y: 30, width: 669, height: 455.5 },
  secondary: { x: 12, y: 525.5, width: 669, height: 455.5 },
};

describe("folded player frames", () => {
  it("converts measured top and bottom panes to container-relative positions", () => {
    expect(getFoldedPlayerFrames(foldedVertical)).toEqual({
      primary: { x: 0, y: 0, width: 669, height: 455.5 },
      secondary: { x: 0, y: 495.5, width: 669, height: 455.5 },
    });
  });

  it("converts measured side-by-side panes without assuming a portrait fold", () => {
    expect(getFoldedPlayerFrames({
      container: { x: 100, y: 42, width: 951, height: 669 },
      primary: { x: 100, y: 42, width: 455.5, height: 669 },
      secondary: { x: 595.5, y: 42, width: 455.5, height: 669 },
    })).toEqual({
      primary: { x: 0, y: 0, width: 455.5, height: 669 },
      secondary: { x: 495.5, y: 0, width: 455.5, height: 669 },
    });
  });

  it.each([
    {},
    { container: foldedVertical.container },
    { container: foldedVertical.container, primary: foldedVertical.primary },
    { container: foldedVertical.container, secondary: foldedVertical.secondary },
    { primary: foldedVertical.primary, secondary: foldedVertical.secondary },
  ])("waits until the container and both panes are available: %j", (frames) => {
    expect(getFoldedPlayerFrames(frames)).toBeNull();
  });

  it.each([0, 0.5, 1])("does not mistake a flat split or rounding gap of %s for a division", (gap) => {
    expect(getFoldedPlayerFrames({
      ...foldedVertical,
      secondary: { ...foldedVertical.secondary, y: 485.5 + gap },
    })).toBeNull();
  });

  it("does not treat a flat horizontal split as a fold", () => {
    expect(getFoldedPlayerFrames({
      container: { x: 10, y: 20, width: 951, height: 669 },
      primary: { x: 10, y: 20, width: 475.5, height: 669 },
      secondary: { x: 485.5, y: 20, width: 475.5, height: 669 },
    })).toBeNull();
  });

  it.each([
    { ...foldedVertical, container: { ...foldedVertical.container, x: NaN } },
    { ...foldedVertical, container: { ...foldedVertical.container, height: Infinity } },
    { ...foldedVertical, container: { ...foldedVertical.container, width: 0 } },
    { ...foldedVertical, primary: { ...foldedVertical.primary, y: -Infinity } },
    { ...foldedVertical, primary: { ...foldedVertical.primary, width: NaN } },
    { ...foldedVertical, primary: { ...foldedVertical.primary, height: -1 } },
    { ...foldedVertical, secondary: { ...foldedVertical.secondary, x: Infinity } },
    { ...foldedVertical, secondary: { ...foldedVertical.secondary, height: 0 } },
  ])("rejects non-finite or non-positive measurements: %j", (frames) => {
    expect(getFoldedPlayerFrames(frames)).toBeNull();
  });

  it("rejects panes from different rotation layouts", () => {
    expect(getFoldedPlayerFrames({
      ...foldedVertical,
      secondary: { x: 507.5, y: 30, width: 455.5, height: 669 },
    })).toBeNull();
  });

  it("rejects portrait panes with a stale landscape container", () => {
    expect(getFoldedPlayerFrames({
      ...foldedVertical,
      container: { ...foldedVertical.container, width: 951, height: 669 },
    })).toBeNull();
  });

  it("rejects overlapping panes", () => {
    expect(getFoldedPlayerFrames({
      ...foldedVertical,
      secondary: { ...foldedVertical.secondary, y: 480 },
    })).toBeNull();
  });

  it("rejects aligned panes extending beyond the container", () => {
    expect(getFoldedPlayerFrames({
      ...foldedVertical,
      primary: { ...foldedVertical.primary, width: 671 },
      secondary: { ...foldedVertical.secondary, width: 671 },
    })).toBeNull();
  });

  it("rejects panes preceding the container", () => {
    expect(getFoldedPlayerFrames({
      ...foldedVertical,
      primary: { ...foldedVertical.primary, y: 28 },
    })).toBeNull();
  });

  it("rejects panes whose cross-axis edges do not align", () => {
    expect(getFoldedPlayerFrames({
      ...foldedVertical,
      secondary: { ...foldedVertical.secondary, x: 14, width: 667 },
    })).toBeNull();
  });

  it("allows one-point native rounding differences without altering the measured frames", () => {
    expect(getFoldedPlayerFrames({
      ...foldedVertical,
      primary: { ...foldedVertical.primary, x: 11.5, width: 669.5 },
      secondary: { ...foldedVertical.secondary, x: 12.5 },
    })).toEqual({
      primary: { x: -0.5, y: 0, width: 669.5, height: 455.5 },
      secondary: { x: 0.5, y: 495.5, width: 669, height: 455.5 },
    });
  });
});

it("places the visible video boundary at the center of the native division margins", () => {
  const geometry = getFullBleedPlayerVideoGeometry({
    primary: { x: 0, y: 0, width: 669, height: 455.5 },
    secondary: { x: 0, y: 495.5, width: 669, height: 455.5 },
  });
  expect(geometry?.stageHeight).toBe(475.5);
  expect(geometry?.videoWidth).toBeGreaterThan(669);
  expect(geometry?.videoHeight).toBe(475.5);
});

it("uses measured global frames rather than assuming the window's midpoint", () => {
  const geometry = getFullBleedPlayerVideoGeometry({
    primary: { x: 10, y: 30, width: 669, height: 400 },
    secondary: { x: 10, y: 470, width: 669, height: 440 },
  });
  expect(geometry?.stageHeight).toBe(420);
});

it("keeps the native boundary when there is no reserved division band", () => {
  const geometry = getFullBleedPlayerVideoGeometry({
    primary: { x: 0, y: 0, width: 669, height: 475.5 },
    secondary: { x: 0, y: 475.5, width: 669, height: 475.5 },
  });
  expect(geometry?.stageHeight).toBe(475.5);
  expect(geometry?.videoHeight).toBe(475.5);
});

it("does not apply portrait cover sizing to a horizontal split", () => {
  expect(getFullBleedPlayerVideoGeometry({
    primary: { x: 0, y: 0, width: 455.5, height: 669 },
    secondary: { x: 495.5, y: 0, width: 455.5, height: 669 },
  })).toBeNull();
});
