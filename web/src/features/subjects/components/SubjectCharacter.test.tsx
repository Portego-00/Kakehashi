import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Subject } from "@/types/wanikani";
import { SubjectCharacter } from "./SubjectCharacter";

function radical(overrides: Partial<Subject["data"]> = {}): Subject {
  return {
    id: 876,
    object: "radical",
    url: "https://api.wanikani.com/v2/subjects/876",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: {
      level: 4,
      created_at: "2026-01-01T00:00:00.000Z",
      slug: "rib-cage",
      document_url: "https://www.wanikani.com/radicals/rib-cage",
      hidden_at: null,
      characters: null,
      meanings: [{ meaning: "Rib Cage", primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      ...overrides,
    },
  };
}

afterEach(cleanup);

describe("SubjectCharacter", () => {
  it("prefers an SVG even when WaniKani returns a PNG first", () => {
    render(<SubjectCharacter subject={radical({ character_images: [
      { url: "https://files.wanikani.com/rib-cage-256.png", content_type: "image/png", metadata: { dimensions: "256x256" } },
      { url: "https://files.wanikani.com/rib-cage.svg", content_type: "image/svg+xml" },
    ] })} />);

    expect(screen.getByRole("img", { name: "Rib Cage radical" })).toHaveAttribute("src", "https://files.wanikani.com/rib-cage.svg");
    expect(screen.queryByText("rib-cage")).not.toBeInTheDocument();
  });

  it("uses the PNG closest to 256 pixels when no SVG exists", () => {
    render(<SubjectCharacter subject={radical({ character_images: [
      { url: "https://files.wanikani.com/rib-cage-64.png", content_type: "image/png", metadata: { dimensions: "64x64" } },
      { url: "https://files.wanikani.com/rib-cage-256.png", content_type: "image/png", metadata: { style_name: "256px" } },
      { url: "https://files.wanikani.com/rib-cage-512.png", content_type: "image/png", metadata: { dimensions: "512x512" } },
    ] })} />);

    expect(screen.getByRole("img", { name: "Rib Cage radical" })).toHaveAttribute("src", "https://files.wanikani.com/rib-cage-256.png");
  });

  it("falls through broken assets before showing the text fallback", () => {
    render(<SubjectCharacter subject={radical({ character_images: [
      { url: "https://files.wanikani.com/rib-cage-256.png", content_type: "image/png", metadata: { dimensions: "256x256" } },
      { url: "https://files.wanikani.com/rib-cage.svg", content_type: "image/svg+xml" },
    ] })} />);

    fireEvent.error(screen.getByRole("img", { name: "Rib Cage radical" }));
    expect(screen.getByRole("img", { name: "Rib Cage radical" })).toHaveAttribute("src", "https://files.wanikani.com/rib-cage-256.png");

    fireEvent.error(screen.getByRole("img", { name: "Rib Cage radical" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Rib Cage")).toBeInTheDocument();
  });

  it("uses the inherited subject color for both SVG and PNG artwork", () => {
    const { container } = render(<SubjectCharacter imageTone="subject" subject={radical({ character_images: [
      { url: "https://files.wanikani.com/rib-cage-256.png", content_type: "image/png", metadata: { dimensions: "256x256" } },
      { url: "https://files.wanikani.com/rib-cage.svg", content_type: "image/svg+xml" },
    ] })} />);

    const tintFilter = container.querySelector("filter[data-subject-image-tint]");
    const svgArtwork = screen.getByRole("img", { name: "Rib Cage radical" });
    expect(tintFilter?.querySelector("feFlood")).toHaveAttribute("flood-color", "currentColor");
    expect(svgArtwork.style.filter).toMatch(/^url\("#[^"]+"\)$/);

    fireEvent.error(svgArtwork);
    const pngArtwork = screen.getByRole("img", { name: "Rib Cage radical" });
    expect(pngArtwork).toHaveAttribute("src", "https://files.wanikani.com/rib-cage-256.png");
    expect(pngArtwork.style.filter).toBe(svgArtwork.style.filter);
  });

  it("keeps real characters ahead of image metadata", () => {
    render(<SubjectCharacter subject={radical({
      characters: "一",
      character_images: [{ url: "https://files.wanikani.com/unused.svg", content_type: "image/svg+xml" }],
    })} />);

    expect(screen.getByText("一")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
