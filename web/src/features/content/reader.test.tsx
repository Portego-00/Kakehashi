import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReaderWorkspace } from "./reader";

vi.mock("./JapaneseReader", () => ({
  JapaneseReader: ({ text }: { text: string }) => <article aria-label="Japanese reading text" lang="ja">{text}</article>,
}));

describe("ReaderWorkspace", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("replaces the setup header with a focused reading toolbar after opening text", () => {
    render(<ReaderWorkspace />);

    expect(screen.getByRole("heading", { level: 1, name: "Reading desk" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Short reading" } });
    fireEvent.change(screen.getByLabelText("Japanese text"), { target: { value: "学校" } });
    fireEvent.click(screen.getByRole("button", { name: "Open reader" }));

    expect(screen.queryByRole("heading", { level: 1, name: "Reading desk" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Short reading" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to imports" })).toBeInTheDocument();
    expect(screen.getByText("2 characters")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Japanese reading text" })).toHaveTextContent("学校");

    fireEvent.click(screen.getByRole("button", { name: "Back to imports" }));
    expect(screen.getByRole("heading", { level: 1, name: "Reading desk" })).toBeInTheDocument();
  });
});
