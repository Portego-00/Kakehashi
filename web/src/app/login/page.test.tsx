import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginFallback, LoginForm } from "./LoginForm";
import LoginPage from "./page";

const mocks = vi.hoisted(() => ({
  next: "/dashboard",
  replace: vi.fn(),
  signIn: vi.fn(),
  status: "anonymous",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams({ next: mocks.next }),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ status: mocks.status, signIn: mocks.signIn }),
}));

describe("login feedback", () => {
  beforeEach(() => {
    mocks.next = "/dashboard";
    mocks.status = "anonymous";
    mocks.replace.mockReset();
    mocks.signIn.mockReset();
  });

  it("uses the native Kakehashi artwork and real crab-on-bridge mark", () => {
    const { container } = render(<LoginPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Kakehashi");
    expect(container.querySelector('img[src*="kakehashi-login-hd.png"]')).toBeInTheDocument();
    expect(container.querySelectorAll('img[src*="kakehashi-mark.png"]')).toHaveLength(2);
  });

  it("shows verification and success states during the real sign-in transition", async () => {
    let finishSignIn: (() => void) | undefined;
    mocks.signIn.mockImplementation(() => new Promise<void>((resolve) => { finishSignIn = resolve; }));

    render(<LoginForm />);
    const input = screen.getByLabelText("API token");
    fireEvent.change(input, { target: { value: "a".repeat(32) } });
    fireEvent.click(screen.getByRole("button", { name: /Open Kakehashi/ }));

    expect(screen.getByRole("button", { name: "Verifying token…" })).toHaveAttribute("aria-busy", "true");
    expect(input).toBeDisabled();
    expect(mocks.replace).not.toHaveBeenCalled();

    await act(async () => finishSignIn?.());

    expect(screen.getByRole("button", { name: "Connected. Opening…" })).toHaveAttribute("data-state", "success");
    expect(screen.getByText("Token verified. Opening your workspace…")).toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("returns the form to an actionable state and announces verification errors", async () => {
    mocks.signIn.mockRejectedValueOnce(new Error("WaniKani rejected that token."));

    render(<LoginForm />);
    const input = screen.getByLabelText("API token");
    fireEvent.change(input, { target: { value: "b".repeat(32) } });
    fireEvent.click(screen.getByRole("button", { name: /Open Kakehashi/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("WaniKani rejected that token.");
    expect(input).toBeEnabled();
    expect(screen.getByRole("button", { name: /Open Kakehashi/ })).toBeEnabled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("redirects an existing session once using the sanitized next path", async () => {
    mocks.status = "authenticated";
    mocks.next = "https://malicious.example/leave";

    const { rerender } = render(<LoginForm />);
    rerender(<LoginForm />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledTimes(1));
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("provides an accessible session-checking fallback", () => {
    render(<LoginFallback />);

    expect(screen.getByRole("status")).toHaveTextContent("Checking for an existing secure session…");
  });

  it("turns off entrance, feedback, and loading motion when reduced motion is requested", () => {
    const css = readFileSync("src/app/login/login.module.css", "utf8");
    const reducedMotionRules = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(reducedMotionRules).toContain(".heroBrand");
    expect(reducedMotionRules).toContain(".artwork");
    expect(reducedMotionRules).toContain('.form[data-phase="error"]');
    expect(reducedMotionRules).toContain('.submit[data-state="success"] svg');
    expect(reducedMotionRules).toContain(".loadingTrack > span");
    expect(reducedMotionRules).toContain("animation: none");
  });
});
