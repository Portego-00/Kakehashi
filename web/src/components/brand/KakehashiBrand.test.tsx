import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KakehashiBrand } from "./KakehashiBrand";

describe("KakehashiBrand", () => {
  it("renders the canonical mark with the Kakehashi name by default", () => {
    const { container } = render(<KakehashiBrand />);

    expect(screen.getByText("Kakehashi")).toBeInTheDocument();
    expect(container.querySelector('img[src*="kakehashi-mark.png"]')).toBeInTheDocument();
  });

  it("can render the mark alone inside an already-labelled control", () => {
    const { container } = render(<KakehashiBrand showName={false} />);

    expect(screen.queryByText("Kakehashi")).not.toBeInTheDocument();
    expect(container.querySelector('img[src*="kakehashi-mark.png"]')).toBeInTheDocument();
  });
});
