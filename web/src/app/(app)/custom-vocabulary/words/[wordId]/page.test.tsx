import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CustomVocabularyWordPage, { metadata } from "./page";

const notFoundMock = vi.hoisted(() => vi.fn(() => { throw new Error("not found"); }));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

vi.mock("@/features/custom-srs/CustomVocabularyDetail", () => ({
  CustomVocabularyDetail: ({ word, packTitle }: { word: { characters: string; meanings: string[] }; packTitle: string }) => <main><h1>{word.meanings[0]}</h1><p>{word.characters}</p><p>{packTitle}</p></main>,
}));

describe("custom vocabulary word route", () => {
  it("resolves a stable catalog word id into its word and pack", async () => {
    render(await CustomVocabularyWordPage({ params: Promise.resolve({ wordId: "conversation-douzo" }) }));

    expect(screen.getByRole("heading", { name: "Please" })).toBeInTheDocument();
    expect(screen.getByText("どうぞ")).toBeInTheDocument();
    expect(screen.getByText("Conversation Glue")).toBeInTheDocument();
    expect(metadata).toMatchObject({ title: "Custom vocabulary details" });
  });

  it("returns the app not-found page for an unknown word id", async () => {
    await expect(CustomVocabularyWordPage({ params: Promise.resolve({ wordId: "not-in-the-catalog" }) })).rejects.toThrow("not found");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
