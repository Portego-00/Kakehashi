import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MixedPreviousBadge } from "./MixedPreviousBadge";
afterEach(cleanup);
it("does not replay the previous answer animation when skipping into another lane", async () => {
  let pending = true;
  const claim = () => { const value = pending; pending = false; return value; };
  const answer = { id: "bunpro:10", source: "bunpro" as const, title: "の", correct: false };
  const first = render(<MixedPreviousBadge answer={answer} animate claimAnimation={claim} />);
  await waitFor(() => expect(screen.getByLabelText(/Previous Bunpro/)).toHaveAttribute("data-animate", "true"));
  first.unmount();
  const second = render(<MixedPreviousBadge answer={answer} animate claimAnimation={claim} />);
  await waitFor(() => expect(screen.getByLabelText(/Previous Bunpro/)).toHaveAttribute("data-animate", "false"));
  pending = true;
  second.rerender(<MixedPreviousBadge answer={{ ...answer, correct: true }} animate claimAnimation={claim} />);
  await waitFor(() => expect(screen.getByLabelText(/Previous Bunpro/)).toHaveAttribute("data-animate", "true"));
});
it.each(["grammar", "vocab"] as const)("opens previous Bunpro %s details in a new tab", kind => {
  render(<MixedPreviousBadge answer={{ id: "bunpro:10", source: "bunpro", title: "です", correct: true, bunproSubject: { kind, slug: "desu polite" } }} animate={false} />);
  const link = screen.getByRole("link", { name: /Previous Bunpro answer/ });
  expect(link).toHaveAttribute("href", `/bunpro/${kind}/desu%20polite`);
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
});
