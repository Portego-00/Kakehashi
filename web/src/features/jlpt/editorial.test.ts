import { describe, expect, it } from "vitest";
import {
  buildJlptEditorialReviewQueue,
  jlptQuestionSemanticKey,
  summarizeJlptEditorialCoverage,
} from "./editorial";
import type { JlptQuestion } from "./types";

const baseQuestion: JlptQuestion = {
  id: "legacy",
  level: "N5",
  skill: "grammar",
  officialType: "grammar-form",
  instruction: "Choose the best grammar form.",
  stem: "これは＿＿です。",
  options: [
    { id: "1", label: "本" },
    { id: "2", label: "駅" },
    { id: "3", label: "雨" },
    { id: "4", label: "朝" },
  ],
  correctOptionId: "1",
  explanation: "The sentence context identifies the correct form.",
};

function controlledQuestion(
  id: string,
  semanticKey: string,
  editorialStatus: "machine-validated" | "human-approved",
): JlptQuestion {
  return {
    ...baseQuestion,
    id,
    provenance: {
      semanticKey,
      variantIndex: Number(id.at(-1)) || 0,
      authorship: "controlled-variant",
      editorialStatus,
      contentVersion: 1,
    },
  };
}

describe("JLPT editorial provenance", () => {
  it("falls back to a stable per-question semantic key for legacy items", () => {
    expect(jlptQuestionSemanticKey(baseQuestion)).toBe("legacy");
  });

  it("counts semantic items rather than inflating coverage with renderings", () => {
    const coverage = summarizeJlptEditorialCoverage([
      controlledQuestion("a1", "grammar:a", "machine-validated"),
      controlledQuestion("a2", "grammar:a", "machine-validated"),
      controlledQuestion("b1", "grammar:b", "human-approved"),
    ]);

    expect(coverage).toMatchObject({
      records: 3,
      semanticItems: 2,
      humanApprovedSemanticItems: 1,
      mixedStatusSemanticItems: 0,
      mixedVersionSemanticItems: 0,
      releaseReady: false,
      byStatus: {
        "machine-validated": { records: 2, semanticItems: 1 },
        "human-approved": { records: 1, semanticItems: 1 },
      },
    });
  });

  it("is release-ready only when every semantic item is human approved", () => {
    const coverage = summarizeJlptEditorialCoverage([
      controlledQuestion("a1", "grammar:a", "human-approved"),
      controlledQuestion("a2", "grammar:a", "human-approved"),
      controlledQuestion("b1", "grammar:b", "human-approved"),
    ]);
    expect(coverage.releaseReady).toBe(true);
  });

  it("does not treat one approved variant as approval for mixed-status or stale variants", () => {
    const approved = controlledQuestion("a1", "grammar:a", "human-approved");
    const machineChecked = controlledQuestion(
      "a2",
      "grammar:a",
      "machine-validated",
    );
    const stale = {
      ...controlledQuestion("b1", "grammar:b", "human-approved"),
      provenance: {
        ...controlledQuestion("b1", "grammar:b", "human-approved").provenance!,
        contentVersion: 2,
      },
    };
    const current = controlledQuestion("b2", "grammar:b", "human-approved");

    const coverage = summarizeJlptEditorialCoverage([
      approved,
      machineChecked,
      stale,
      current,
    ]);

    expect(coverage).toMatchObject({
      semanticItems: 2,
      humanApprovedSemanticItems: 0,
      mixedStatusSemanticItems: 1,
      mixedVersionSemanticItems: 1,
      releaseReady: false,
    });
  });

  it("builds one review-queue entry per semantic item", () => {
    const queue = buildJlptEditorialReviewQueue([
      controlledQuestion("a1", "grammar:a", "machine-validated"),
      controlledQuestion("a2", "grammar:a", "machine-validated"),
      controlledQuestion("b1", "grammar:b", "human-approved"),
    ]);

    expect(queue).toHaveLength(2);
    expect(
      queue.find((item) => item.semanticKey === "grammar:a"),
    ).toMatchObject({
      representativeQuestionId: "a1",
      renderedQuestionIds: ["a1", "a2"],
      contentVersions: [1],
      statuses: ["machine-validated"],
    });
  });
});
