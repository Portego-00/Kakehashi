import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingState, Skeleton } from "./States";

describe("shared loading states", () => {
  it("keeps skeletons out of the accessibility tree while accepting layout dimensions", () => {
    const { container } = render(<Skeleton height="12rem" width="70%" />);
    const skeleton = container.firstElementChild;

    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton).toHaveStyle({ minHeight: "12rem", width: "70%" });
  });

  it("announces a full loading state politely and atomically", () => {
    render(<LoadingState label="Loading subjects" detail="Matching assignments and SRS stages…" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading subjects");
    expect(status).toHaveTextContent("Matching assignments and SRS stages…");
  });

  it("offers an inline form without changing status semantics", () => {
    render(<LoadingState compact label="Refreshing items" />);

    expect(screen.getByRole("status")).toHaveAttribute("data-compact", "true");
  });
});
