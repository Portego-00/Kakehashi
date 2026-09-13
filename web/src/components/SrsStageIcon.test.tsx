import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SrsStageIcon, srsStageLabel } from "./SrsStageIcon";

describe("SrsStageIcon", () => {
  it("maps every WaniKani stage to the native mobile artwork", () => {
    const { container } = render(<>{Array.from({ length: 9 }, (_, index) => <SrsStageIcon key={index} stage={index + 1} />)}</>);
    expect([...container.querySelectorAll("use")].map((node) => node.getAttribute("href"))).toEqual([
      "/srs/srs-icons.svg#apprentice-1", "/srs/srs-icons.svg#apprentice-2", "/srs/srs-icons.svg#apprentice-3", "/srs/srs-icons.svg#apprentice-4",
      "/srs/srs-icons.svg#guru-1", "/srs/srs-icons.svg#guru-2", "/srs/srs-icons.svg#master", "/srs/srs-icons.svg#enlightened", "/srs/srs-icons.svg#burned",
    ]);
  });

  it("supports grouped labels and an accessible title", () => {
    render(<SrsStageIcon level="Guru" title="Guru SRS stage" />);
    expect(screen.getByRole("img", { name: "Guru SRS stage" }).querySelector("use")).toHaveAttribute("href", "/srs/srs-icons.svg#guru-1");
    expect(srsStageLabel(6)).toBe("Guru II");
  });
});
