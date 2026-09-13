import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VocabularyFrequencyBadge } from "./VocabularyFrequencyBadge";
import type { VocabularyFrequencySubject } from "./vocabulary-frequency";

const subject: VocabularyFrequencySubject = {
  id: 99,
  object: "vocabulary",
  data: {
    characters: "川",
    readings: [{ reading: "かわ", accepted_answer: true }],
  },
};

function renderBadge(enabled = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VocabularyFrequencyBadge subject={subject} enabled={enabled} />
    </QueryClientProvider>,
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("VocabularyFrequencyBadge", () => {
  it("does not render or fetch when the setting prop is disabled", () => {
    const remote = vi.fn();
    vi.stubGlobal("fetch", remote);
    const { container } = renderBadge(false);
    expect(container).toBeEmptyDOMElement();
    expect(remote).not.toHaveBeenCalled();
  });

  it("shows the mobile loading placeholder and then the formatted Jiten rank", async () => {
    let resolveResponse!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(() => new Promise((resolve) => {
      resolveResponse = resolve;
    })));
    renderBadge();

    expect(screen.getByLabelText("Vocabulary frequency loading")).toHaveTextContent("#---");

    await act(async () => {
      resolveResponse(new Response(JSON.stringify({ result: {
        provider: "jiten",
        frequencyRank: 12_345,
        wordId: 1390020,
        readingIndex: 0,
        matchedText: "川",
        matchedReading: "かわ",
        sourceUrl: "https://jiten.moe/search?query=%E5%B7%9D",
      } }), { status: 200 }));
    });

    expect(await screen.findByLabelText(`Vocabulary frequency #${(12_345).toLocaleString()}`))
      .toHaveTextContent(`#${(12_345).toLocaleString()}`);
  });

  it("keeps #--- and announces unavailable when Jiten has no exact match", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ result: null }), { status: 200 })));
    renderBadge();
    expect(await screen.findByLabelText("Vocabulary frequency unavailable")).toHaveTextContent("#---");
  });

  it("accepts a direct request and shares its query with the matching subject", async () => {
    const remote = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ result: {
      provider: "jiten",
      frequencyRank: 12_345,
      wordId: 1390020,
      readingIndex: 0,
      matchedText: "川",
      matchedReading: "かわ",
      sourceUrl: "https://jiten.moe/search?query=%E5%B7%9D",
    } }), { status: 200 }));
    vi.stubGlobal("fetch", remote);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={client}>
        <VocabularyFrequencyBadge subject={subject} enabled />
        <VocabularyFrequencyBadge request={{ expression: " ～ 川 ", readings: ["カワ", "かわ"] }} enabled />
      </QueryClientProvider>,
    );

    expect(await screen.findAllByLabelText(`Vocabulary frequency #${(12_345).toLocaleString()}`))
      .toHaveLength(2);
    expect(remote).toHaveBeenCalledOnce();
    expect(JSON.parse(String(remote.mock.calls[0]?.[1]?.body))).toEqual({
      expression: "川",
      readings: ["かわ"],
    });
  });
});
