import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { useFirstSubjectReveal } from "./useFirstSubjectReveal";

function RevealHarness() {
  const reveal = useFirstSubjectReveal();
  return <section data-testid="reveal" {...reveal}><span data-testid="child" /></section>;
}

it("does not replay the subject reveal after its container settles", () => {
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
