import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { useFirstProgressReveal } from "./useFirstProgressReveal";

function RevealHarness() {
  const reveal = useFirstProgressReveal();
  return <section data-testid="reveal" {...reveal}><span data-testid="child" /></section>;
}

it("finishes the progress reveal only when the container animation completes", () => {
  const { rerender } = render(<RevealHarness />);
  const container = screen.getByTestId("reveal");

  expect(container).toHaveAttribute("data-first-reveal");
  fireEvent.animationEnd(screen.getByTestId("child"));
  expect(container).toHaveAttribute("data-first-reveal");

  fireEvent.animationEnd(container);
  expect(container).not.toHaveAttribute("data-first-reveal");
  rerender(<RevealHarness />);
  expect(container).not.toHaveAttribute("data-first-reveal");
});
