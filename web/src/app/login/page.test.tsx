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

  it("uses one brand mark and the compact phone-login artwork in a static composition", () => {
    const { container } = render(<LoginPage />);
    const artwork = container.querySelector('img[src*="kakehashi-login-hd.png"]');

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Kakehashi");
    expect(screen.getByRole("heading", { level: 2, name: "Review. Read. Keep going." })).toBeInTheDocument();
    expect(screen.getByText("A focused companion for your WaniKani study.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Connect your WaniKani account" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Kakehashi feature preview" })).not.toBeInTheDocument();
    expect(container.querySelector("video")).not.toBeInTheDocument();
    expect(container.querySelector('img[src*="kakehashi-login.png"]')).not.toBeInTheDocument();
    expect(artwork).toBeInTheDocument();
    expect(artwork).toHaveAttribute("alt", "");
    expect(container.querySelectorAll('img[src*="kakehashi-mark.png"]')).toHaveLength(1);
  });

  it("keeps the login presentation free of gradients, device chrome, dividers, and decorative motion", () => {
    const css = readFileSync("src/app/login/login.module.css", "utf8");
    const pageSource = readFileSync("src/app/login/page.tsx", "utf8");
    const showcase = readFileSync("src/app/login/LoginFeatureShowcase.tsx", "utf8");
    const formRules = css.match(/\.form\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

    expect(css).not.toContain("linear-gradient(");
    expect(css).not.toContain("radial-gradient(");
    expect(css).toContain(".artwork");
    expect(css).toContain("width: min(12rem, 100%)");
    expect(css).toContain("width: min(14rem, 100%)");
    expect(css).toContain("width: min(16rem, 100%)");
    expect(css).not.toContain(".device");
    expect(css).not.toContain(".showcase");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toContain("animation:");
    expect(pageSource).not.toContain("LoginFeatureShowcase");
    expect(pageSource).not.toContain("<video");
    expect(pageSource).toContain("kakehashi-login-hd.png");
    expect(pageSource).toContain('loading="eager"');
    expect(showcase).not.toContain("setTimeout");
    expect(showcase).not.toContain("FEATURES");
    expect(showcase).toContain("return null");
    expect(formRules).not.toContain("border-block-start");
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

  it("uses static session-checking feedback without a progress reel", () => {
    const formSource = readFileSync("src/app/login/LoginForm.tsx", "utf8");

    expect(formSource).not.toContain("loadingTrack");
    expect(formSource).not.toContain("video");
  });
});
