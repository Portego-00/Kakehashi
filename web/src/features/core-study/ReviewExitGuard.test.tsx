import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ReviewExitGuard } from "./ReviewExitGuard";
afterEach(cleanup);
it("shows the exit confirmation even when WaniKani is hidden in mixed reviews", async () => {
  render(<><div hidden inert><ReviewExitGuard pendingSubjects={1} /></div><a href="/dashboard">Exit Bunpro</a></>);
  fireEvent.click(screen.getByRole("link", { name: "Exit Bunpro" }));
  expect(await screen.findByRole("dialog", { name: "Leave this session?" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Keep reviewing" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
