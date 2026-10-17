import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const session = vi.hoisted(() => ({ user: { id: 1, data: { username: "Learner" } } }));
vi.mock("@/lib/session", () => ({ useSession: () => session }));
import { StudyHub } from "./study-hub";
afterEach(cleanup);
it.each(["Portego", " PORTEGO ", "Learner", "Portego2"])("shows the Bunpro section only for Portego: %j", username => {
  session.user.data.username = username;
  render(<StudyHub />);
  if (username.trim().toLowerCase() === "portego") {
    expect(screen.getByRole("heading", { name: "Bunpro grammar practice" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Mastery loop/ })).toHaveAttribute("href", "/bunpro-practice/mastery-loop");
  } else expect(screen.queryByRole("heading", { name: "Bunpro grammar practice" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Custom review/i })).toBeVisible();
});
it("removes every practice link when switching away from Portego", () => {
  session.user.data.username = "Portego";
  const view = render(<StudyHub />);
  expect(screen.getAllByRole("link").filter(link => link.getAttribute("href")?.startsWith("/bunpro-practice/"))).toHaveLength(4);
  session.user.data.username = "Learner";
  view.rerender(<StudyHub />);
  expect(screen.queryByRole("heading", { name: "Bunpro grammar practice" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("link").filter(link => link.getAttribute("href")?.startsWith("/bunpro-practice/"))).toHaveLength(0);
});
