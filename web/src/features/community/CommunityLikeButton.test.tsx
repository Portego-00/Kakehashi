import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ username: "Portego" as string | null, isDemo: false }));
vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: session.username ? { data: { username: session.username } } : null, isDemo: session.isDemo }),
}));

import { CommunityLikeButton } from "./CommunityLikeButton";

const props = { kind: "comment" as const, targetId: "comment-1", count: 2, writable: true, label: "Like reply, 2 likes", onClick: vi.fn() };
const people = [{ id: "like-1", username: "Portego" }, { id: "like-2", username: "Learner" }];
function response(items = people, hasMore = false) { return Response.json({ items, hasMore }); }

afterEach(() => { cleanup(); vi.unstubAllGlobals(); props.onClick.mockClear(); session.username = "Portego"; session.isDemo = false; });

describe("community like tooltips", () => {
  it.each(["Viewer", "PortegoFan", null])("preserves ordinary liking without exposing a tooltip to %s", (username) => {
    session.username = username;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CommunityLikeButton {...props} />);
    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);
    fireEvent.focus(button);
    fireEvent.click(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(button).not.toHaveAttribute("aria-describedby");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(props.onClick).toHaveBeenCalledOnce();
  });

  it("does not expose the tooltip in a demo session, even with the Portego name", () => {
    session.isDemo = true;
    render(<CommunityLikeButton {...props} />);
    fireEvent.mouseEnter(screen.getByRole("button"));
    fireEvent.focus(screen.getByRole("button"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes the tooltip and cancels its request when the account changes", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => response());
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<CommunityLikeButton {...props} />);
    fireEvent.mouseEnter(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Portego"));
    session.username = "Viewer";
    rerender(<CommunityLikeButton {...props} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("loads every page on hover, keeps click-to-like, and dismisses with Escape", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => new URL(String(url), "http://localhost").searchParams.get("page") === "0"
      ? response(people.slice(0, 1), true) : response(people.slice(1)));
    vi.stubGlobal("fetch", fetchMock);
    render(<CommunityLikeButton {...props} />);
    const button = screen.getByRole("button", { name: props.label });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(button);
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Portego"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Learner");
    expect(button).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url), "http://localhost").searchParams.toString())).toEqual([
      "action=likes&kind=comment&id=comment-1&page=0", "action=likes&kind=comment&id=comment-1&page=1",
    ]);
    fireEvent.click(button);
    expect(props.onClick).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows an empty tooltip on keyboard focus without loading names", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CommunityLikeButton {...props} count={0} />);
    const button = screen.getByRole("button");
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("No likes yet");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.blur(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("keeps Escape dismissal when removing the popup causes another mouse-enter event", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response()));
    render(<CommunityLikeButton {...props} />);
    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Portego"));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseEnter(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.mouseLeave(button);
    await act(() => new Promise((resolve) => setTimeout(resolve, 180)));
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("also exposes names for read-only counts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response()));
    const { container } = render(<CommunityLikeButton {...props} writable={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    fireEvent.focus(container.querySelector('[tabindex="0"]')!);
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Portego"));
  });

  it("refreshes the list after a like finishes saving", async () => {
    const fetchMock = vi.fn(async () => response(people.slice(0, 1)));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<CommunityLikeButton {...props} />);
    fireEvent.mouseEnter(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Portego"));
    rerender(<CommunityLikeButton {...props} count={3} liked pending />);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Updating likes…");
    fetchMock.mockImplementation(async () => response([...people, { id: "like-3", username: "Viewer" }]));
    rerender(<CommunityLikeButton {...props} count={3} liked />);
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Viewer"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports loading errors and retries when reopened", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CommunityLikeButton {...props} />);
    const button = screen.getByRole("button");
    fireEvent.focus(button);
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Could not load likes"));
    fireEvent.blur(button);
    fetchMock.mockImplementation(async () => response());
    fireEvent.focus(button);
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Portego"));
  });

  it("keeps a long list open while the pointer moves into the tooltip", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response()));
    render(<CommunityLikeButton {...props} />);
    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Portego"));
    fireEvent.mouseLeave(button);
    fireEvent.mouseEnter(screen.getByRole("tooltip"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 180)));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole("tooltip"));
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });
});
