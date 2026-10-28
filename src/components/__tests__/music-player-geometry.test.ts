import { getFullBleedPlayerVideoGeometry } from "../music-player-geometry";

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
