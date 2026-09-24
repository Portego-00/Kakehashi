import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { BunproDetails } from "./BunproDetails";

vi.mock("./BunproContext", () => ({ BunproContext: ({ query }: { query: string }) => <div>Anime scenes for {query}</div> }));
afterEach(cleanup);

function setup(kind: "grammar" | "vocab") {
  return render(<QueryClientProvider client={new QueryClient()}><BunproDetails kind={kind} slug="outside" content={{ data: { id: "1", type: "vocab", attributes: { id: 1, slug: "outside", title: "<ruby>外側<rt>そとがわ</rt></ruby>", meaning: "outside" } }, included: [] }} /></QueryClientProvider>);
}

it("adds Context third for vocabulary and searches without ruby annotations", async () => {
  setup("vocab");
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Details", "Examples", "Context"]);
  expect(screen.queryByText("Anime scenes for 外側")).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("tab", { name: "Details" }), { key: "ArrowLeft" });
  expect(screen.getByRole("tab", { name: "Context" })).toHaveFocus();
  expect(await screen.findByText("Anime scenes for 外側")).toBeVisible();
  fireEvent.keyDown(screen.getByRole("tab", { name: "Context" }), { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Details" })).toHaveFocus();
  expect(screen.queryByText("Anime scenes for 外側")).not.toBeInTheDocument();
});

it("retains two tabs for grammar", () => {
  setup("grammar");
  expect(screen.queryByRole("tab", { name: "Context" })).not.toBeInTheDocument();
});
