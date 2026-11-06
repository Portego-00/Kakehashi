import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MediaContextSource } from "./MediaContextSource";

const session = vi.hoisted(() => ({ user: { data: { username: "Portego" } }, isDemo: false }));
vi.mock("@/lib/session", () => ({ useSession: () => session }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));

beforeEach(() => { session.user.data.username = "Portego"; session.isDemo = false; });

it.each([[false, "Portego", false], [true, "Other", false], [true, "Portego", true]])("hides the source switcher without both opt-in and account access (%s, %s, demo %s)", (enabled, username, isDemo) => {
  session.user.data.username = username; session.isDemo = isDemo;
  const view = render(<MediaContextSource query="家族" enabled={enabled}><p>Anime examples</p></MediaContextSource>);
  expect(screen.queryByRole("tab", { name: "YouGlish" })).toBeNull();
  expect(view.container.querySelector("iframe")).toBeNull();
  expect(screen.getByText("Anime examples")).toBeInTheDocument();
});

it("searches each current word, loads only on selection, and destroys playback when leaving Context", () => {
  const view = (query: string, active = true) => <MediaContextSource query={query} enabled active={active}><p>Anime examples</p></MediaContextSource>;
  const { container, rerender } = render(view("家族"));
  expect(container.querySelector("iframe")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "YouGlish" }));
  let frame = screen.getByTitle("YouGlish Japanese examples for 家族");
  const html = decodeURIComponent(frame.getAttribute("src")!.split(",").slice(1).join(","));
  expect(html).toContain('"query":"家族"');
  expect(html).toContain('widget.fetch(config.query,"japanese")');
  expect(frame).toHaveAttribute("sandbox", expect.stringContaining("allow-same-origin"));
  expect(frame.getAttribute("src")).toMatch(/^data:text\/html/);
  expect(screen.queryByText("Anime examples")).toBeNull();
  rerender(view("やっぱり"));
  frame = screen.getByTitle("YouGlish Japanese examples for やっぱり");
  expect(decodeURIComponent(frame.getAttribute("src")!)).toContain('"query":"やっぱり"');
  rerender(view("やっぱり", false));
  expect(container.querySelector("iframe")).toBeNull();
  rerender(view("やっぱり"));
  fireEvent.keyDown(screen.getByRole("tab", { name: "YouGlish" }), { key: "ArrowLeft" });
  expect(screen.getByRole("tab", { name: "ImmersionKit" })).toHaveAttribute("aria-selected", "true");
  expect(container.querySelector("iframe")).toBeNull();
});

it("handles no results and retries while ignoring unrelated frame messages", () => {
  render(<MediaContextSource query="家族" enabled><p>Anime examples</p></MediaContextSource>);
  fireEvent.click(screen.getByRole("tab", { name: "YouGlish" }));
  const frame = screen.getByTitle("YouGlish Japanese examples for 家族") as HTMLIFrameElement;
  const data = { channel: "kakehashi-youglish", type: "results", value: 0 };
  act(() => window.dispatchEvent(new MessageEvent("message", { data, source: window })));
  expect(screen.queryByText(/No YouGlish examples/)).toBeNull();
  act(() => window.dispatchEvent(new MessageEvent("message", { data, source: frame.contentWindow! })));
  expect(screen.getByText("No YouGlish examples found for “家族”.")).toBeInTheDocument();
  expect(screen.queryByTitle("YouGlish Japanese examples for 家族")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry YouGlish" }));
  expect(screen.getByTitle("YouGlish Japanese examples for 家族")).toBeInTheDocument();
});
