import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { data: { username: "Viewer" } } }),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({ profile: { gravatarEmail: "myemailaddress@example.com" } }),
}));

import { CommunityWorkspace, IssueDetailWorkspace, NewIssueWorkspace } from "./community";

const CREATED_AT = "2026-08-30T10:00:00.000Z";
const ISSUE_GRAVATAR_HASH = "b58996c504c5638798eb6b511e6f49af";
const COMMENT_GRAVATAR_HASH = "0bc83cb571cd1c50ba6f3e8a78ef1346";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function authorAvatar(container: HTMLElement, hash: string) {
  return container.querySelector<HTMLImageElement>(`img[src*="${hash}"]`);
}

describe("community author identity", () => {
  beforeEach(() => {
    window.localStorage.clear();
    router.push.mockReset();
    router.replace.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the issue author's Gravatar and server-provided DEV and Supporter flags", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => jsonResponse({
      configured: true,
      writable: true,
      counts: { open: 1, closed: 0 },
      hasMore: false,
      items: [{
        id: "issue-1",
        user_username: "Portego",
        user_level: 60,
        user_gravatar_hash: ISSUE_GRAVATAR_HASH,
        is_developer: true,
        is_patreon_supporter: true,
        title: "Profile identity issue",
        content: "The issue author should retain their public community identity.",
        status: "open",
        labels: [],
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
        likes_count: 0,
        reply_count: 0,
      }],
    })));

    render(<CommunityWorkspace />);

    const issue = (await screen.findByRole("heading", { name: "Profile identity issue" })).closest("article");
    expect(issue).not.toBeNull();
    const issueView = within(issue!);

    expect.soft(authorAvatar(issue!, ISSUE_GRAVATAR_HASH)).not.toBeNull();
    expect.soft(issueView.queryByText("DEV", { exact: true })).toBeInTheDocument();
    expect.soft(issueView.queryByText("Supporter", { exact: true })).toBeInTheDocument();
  });

  it("shows the author's initial placeholder when no Gravatar is available", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => jsonResponse({
      configured: true,
      writable: true,
      counts: { open: 1, closed: 0 },
      hasMore: false,
      items: [{
        id: "issue-1",
        user_username: "Learner",
        user_level: 12,
        user_gravatar_hash: null,
        is_developer: false,
        is_patreon_supporter: false,
        title: "Issue without a Gravatar",
        content: "The author should keep the original neutral placeholder.",
        status: "open",
        labels: [],
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
        likes_count: 0,
        reply_count: 0,
      }],
    })));

    render(<CommunityWorkspace />);

    const issue = (await screen.findByRole("heading", { name: "Issue without a Gravatar" })).closest("article");
    expect(issue).not.toBeNull();
    const authorMark = issue!.firstElementChild as HTMLElement;
    const avatar = authorMark.firstElementChild as HTMLElement;

    expect.soft(avatar).toHaveTextContent("L");
    expect.soft(authorMark.querySelector('img[src*="kakehashi-mark.png"]')).not.toBeInTheDocument();
    expect.soft(authorMark.querySelector('img[src*="gravatar.com"]')).not.toBeInTheDocument();
  });

  it("shows a comment author's Gravatar and server-provided DEV and Supporter flags", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => jsonResponse({
      configured: true,
      writable: true,
      canManage: false,
      commentsHasMore: false,
      issue: {
        id: "issue-1",
        user_username: "Learner",
        user_level: 12,
        user_gravatar_hash: null,
        is_developer: false,
        is_patreon_supporter: false,
        title: "Comment identity issue",
        content: "The reply author metadata is returned with the thread.",
        status: "open",
        labels: [],
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
        likes_count: 0,
        reply_count: 1,
      },
      comments: [{
        id: "comment-1",
        issue_id: "issue-1",
        user_username: "Portego",
        user_level: 60,
        user_gravatar_hash: COMMENT_GRAVATAR_HASH,
        is_developer: true,
        is_patreon_supporter: true,
        content: "This reply should show the author's community identity.",
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
        likes_count: 0,
        reply_to_comment_id: null,
      }],
    })));

    render(<IssueDetailWorkspace id="issue-1" />);

    const comment = (await screen.findByText("This reply should show the author's community identity.")).closest("article");
    expect(comment).not.toBeNull();
    const commentView = within(comment!);

    expect.soft(authorAvatar(comment!, COMMENT_GRAVATAR_HASH)).not.toBeNull();
    expect.soft(commentView.queryByText("DEV", { exact: true })).toBeInTheDocument();
    expect.soft(commentView.queryByText("Supporter", { exact: true })).toBeInTheDocument();
  });

  it("attaches the saved Gravatar email when creating an issue", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ item: { id: "new-issue" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<NewIssueWorkspace />);
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Profile identity issue" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Details" }), { target: { value: "The post should retain its Gravatar identity." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit issue" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/community/new-issue"));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeDefined();
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      action: "createIssue",
      gravatarEmail: "myemailaddress@example.com",
    });
  });

  it("attaches the saved Gravatar email when creating a comment", async () => {
    const thread = {
      id: "issue-1",
      user_username: "Learner",
      user_level: 12,
      user_gravatar_hash: null,
      is_developer: false,
      is_patreon_supporter: false,
      title: "Comment identity issue",
      content: "The reply author metadata is returned with the thread.",
      status: "open",
      labels: [],
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
      likes_count: 0,
      reply_count: 0,
    };
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => init?.method === "POST"
      ? jsonResponse({ item: { id: "new-comment", issue_id: thread.id, user_username: "Viewer", content: "Keep my avatar on this reply.", created_at: CREATED_AT, likes_count: 0 } })
      : jsonResponse({ configured: true, writable: true, canManage: false, commentsHasMore: false, issue: thread, comments: [] }));
    vi.stubGlobal("fetch", fetchMock);

    render(<IssueDetailWorkspace id={thread.id} />);
    const reply = await screen.findByRole("textbox", { name: "Reply as Viewer" });
    fireEvent.change(reply, { target: { value: "Keep my avatar on this reply." } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      action: "addComment",
      gravatarEmail: "myemailaddress@example.com",
    });
  });
});
