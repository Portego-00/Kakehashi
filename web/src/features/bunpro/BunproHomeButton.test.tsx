import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BunproHomeButton } from "./BunproHomeButton";
import { bunpro } from "./client";
const session = vi.hoisted(() => ({ user: { data: { username: "Learner" } }, isDemo: false }));
vi.mock("@/lib/session", () => ({ useSession: () => session }));
vi.mock("./client", () => ({ bunpro: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  session.user.data.username = "Learner";
  session.isDemo = false;
  vi.mocked(bunpro).mockReset().mockImplementation(async (query) => {
    if (query === "action=connection") return { connected: false };
    if (query === "action=due") return { total_due_grammar: 3, total_due_vocab: 4 };
    if (query === "action=lesson-queue") return {};
    return { connected: true };
  });
});
afterEach(cleanup);
function setup() {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={cache}><BunproHomeButton wanikaniCount={2} /></QueryClientProvider>);
}
it.each([{ username: "", demo: false }, { username: "Learner", demo: true }])("hides setup for $username with demo=$demo", ({ username, demo }) => {
  session.user.data.username = username;
  session.isDemo = demo;
  setup();
  expect(screen.queryByRole("heading", { name: "Connect Bunpro" })).not.toBeInTheDocument();
  expect(bunpro).not.toHaveBeenCalled();
});
it("checks a key and replaces setup with live review cards", async () => {
  setup();
  const input = await screen.findByLabelText("Bunpro API key");
  expect(screen.getByRole("link", { name: "Get your API key" })).toHaveAttribute("href", "https://bunpro.jp/settings/api");
  expect(screen.getByRole("button", { name: "Check API key" })).toBeDisabled();
  fireEvent.change(input, { target: { value: "  valid-key  " } });
  fireEvent.click(screen.getByRole("button", { name: "Check API key" }));
  expect(await screen.findByLabelText("7 reviews due")).toBeVisible();
  expect(bunpro).toHaveBeenCalledWith("", { method: "POST", body: JSON.stringify({ action: "connect", token: "valid-key" }) });
  expect(screen.queryByLabelText("Bunpro API key")).not.toBeInTheDocument();
  expect(localStorage.getItem("kakehashi:bunpro-connect-dismissed:learner")).toBeNull();
});
it("keeps an invalid key editable and allows retry", async () => {
  setup();
  const input = await screen.findByLabelText("Bunpro API key");
  vi.mocked(bunpro).mockRejectedValueOnce(new Error("Invalid Bunpro API key."));
  fireEvent.change(input, { target: { value: "bad-key" } });
  fireEvent.click(screen.getByRole("button", { name: "Check API key" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid Bunpro API key.");
  expect(input).toBeEnabled();
  fireEvent.change(input, { target: { value: "valid-key" } });
  fireEvent.click(screen.getByRole("button", { name: "Check API key" }));
  expect(await screen.findByLabelText("7 reviews due")).toBeVisible();
});
it("remembers dismissal across mounts without hiding connected review cards", async () => {
  const view = setup();
  fireEvent.click(await screen.findByRole("button", { name: "Dismiss Bunpro setup" }));
  view.unmount();
  const remount = setup();
  await waitFor(() => expect(bunpro).toHaveBeenCalledTimes(2));
  expect(screen.queryByLabelText("Bunpro API key")).not.toBeInTheDocument();
  remount.unmount();
  vi.mocked(bunpro).mockResolvedValueOnce({ connected: true });
  setup();
  expect(await screen.findByLabelText("7 reviews due")).toBeVisible();
});
it("does not offer setup on a connection error", async () => {
  vi.mocked(bunpro).mockRejectedValue(new Error("Unavailable"));
  setup();
  await waitFor(() => expect(bunpro).toHaveBeenCalled());
  expect(screen.queryByLabelText("Bunpro API key")).not.toBeInTheDocument();
});

it("recovers a temporary first lesson-queue failure after connecting without a page refresh", async () => {
  let attempts = 0;
  vi.mocked(bunpro).mockImplementation(async (query) => {
    if (query === "action=connection") return { connected: false };
    if (query === "action=due") return { total_due_grammar: 3, total_due_vocab: 4 };
    if (query === "action=lesson-queue") {
      if (++attempts === 1) throw Object.assign(new Error("Temporary authorization failure"), { status: 401 });
      return {};
    }
    return { connected: true };
  });
  setup();
  fireEvent.change(await screen.findByLabelText("Bunpro API key"), { target: { value: "valid-key" } });
  fireEvent.click(screen.getByRole("button", { name: "Check API key" }));
  await screen.findByLabelText("7 reviews due");
  await waitFor(() => expect(attempts).toBe(2), { timeout: 3000 });
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
});

it("retries only the failed counts and clears Retry after recovery", async () => {
  let lessonAttempts = 0;
  let dueAttempts = 0;
  vi.mocked(bunpro).mockImplementation(async (query) => {
    if (query === "action=connection") return { connected: true };
    if (query === "action=due") {
      if (++dueAttempts > 1) throw new Error("Healthy counts were unnecessarily refetched");
      return { total_due_grammar: 3, total_due_vocab: 4 };
    }
    if (query === "action=lesson-queue") {
      if (++lessonAttempts === 1) throw Object.assign(new Error("Request failed"), { status: 400 });
      return {};
    }
    return {};
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  await waitFor(() => expect(lessonAttempts).toBe(2));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument());
  expect(dueAttempts).toBe(1);
});

it("stops automatic retries for a persistent rejection and reports the affected card", async () => {
  let attempts = 0;
  vi.mocked(bunpro).mockImplementation(async (query) => {
    if (query === "action=connection") return { connected: true };
    if (query === "action=due") return { total_due_grammar: 3, total_due_vocab: 4 };
    if (query === "action=lesson-queue") {
      attempts++;
      throw Object.assign(new Error("Rejected"), { status: 401 });
    }
    return {};
  });
  setup();
  await screen.findByRole("button", { name: "Retry" }, { timeout: 4000 });
  expect(attempts).toBe(3);
  expect(screen.getByRole("status")).toHaveTextContent("Bunpro lessons could not be refreshed.");
  expect(screen.getByRole("status")).not.toHaveTextContent("Bunpro review counts");
  expect(screen.getByLabelText("7 reviews due")).toBeVisible();
});
