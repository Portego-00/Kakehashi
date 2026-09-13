import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AppRouteLoading from "./(app)/loading";
import AppRouteTemplate from "./(app)/template";

describe("app route motion", () => {
  it("wraps each route in the entrance surface", () => {
    const { container } = render(<AppRouteTemplate><span>Page content</span></AppRouteTemplate>);
    expect(container.firstElementChild).toHaveClass("route-enter");
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("provides an accessible instant loading state", () => {
    render(<AppRouteLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Opening your workspace");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });
});
