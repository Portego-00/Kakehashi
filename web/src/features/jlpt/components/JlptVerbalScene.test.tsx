import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JlptVerbalScene } from "../types";
import { JlptVerbalSceneIllustration } from "./JlptVerbalScene";

const scene: JlptVerbalScene = {
  setting: "shop",
  speaker: { side: "left", pose: "pointing" },
  partner: { side: "right", pose: "neutral" },
  prop: { kind: "shirt", position: "center" },
  description:
    "A customer points to a shirt while a shop employee waits nearby.",
};

describe("JLPT verbal-expression illustration", () => {
  it("renders an original semantic SVG with an accessible scene description", () => {
    const { container } = render(<JlptVerbalSceneIllustration scene={scene} />);

    expect(
      screen.getByRole("img", { name: scene.description }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Arrow marks the person who will speak."),
    ).toBeInTheDocument();
    expect(container.querySelector("image")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
      "0 0 400 230",
    );
  });

  it("creates unique arrow marker references when more than one scene is rendered", () => {
    const { container } = render(
      <>
        <JlptVerbalSceneIllustration scene={scene} />
        <JlptVerbalSceneIllustration
          scene={{ ...scene, speaker: { side: "right", pose: "requesting" } }}
        />
      </>,
    );
    const markerIds = [...container.querySelectorAll("marker")].map(
      (marker) => marker.id,
    );
    const arrowReferences = [
      ...container.querySelectorAll("path[marker-end]"),
    ].map((arrow) => arrow.getAttribute("marker-end"));

    expect(new Set(markerIds).size).toBe(2);
    expect(arrowReferences).toEqual(markerIds.map((id) => `url(#${id})`));
  });
});
