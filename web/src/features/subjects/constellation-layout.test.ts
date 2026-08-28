import { describe, expect, it } from "vitest";
import type { Subject } from "@/types/wanikani";
import { buildConstellationLayout, CONSTELLATION_NODE_GAP, constellationNodeFontSize, constellationNodeRadius } from "./constellation-canvas-layout";

function subject(id: number, object: Subject["object"], characters: string, reading = ""): Subject {
  return { id, object, url: "", data_updated_at: "", data: { level: 1, created_at: "", slug: characters, document_url: "", hidden_at: null, characters, meanings: [{ meaning: characters, primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: reading ? [{ reading, primary: true, accepted_answer: true }] : [] } };
}

describe("subject constellation layout", () => {
  it("scales longer labels down to fit instead of truncating them", () => {
    expect(constellationNodeFontSize("売り上げる")).toBeLessThan(constellationNodeFontSize("上げる"));
    expect(constellationNodeFontSize("めしあがる", { reading: true })).toBeLessThanOrEqual(14);
    expect(constellationNodeFontSize("出来上がる") * 5).toBeLessThanOrEqual(68);
  });

  it("clusters kanji vocabulary around the matching reading anchors", () => {
    const center = subject(440, "kanji", "一");
    center.data.readings = [
      { reading: "いち", type: "onyomi", primary: true, accepted_answer: true },
      { reading: "ひと", type: "kunyomi", primary: false, accepted_answer: true },
    ];
    center.data.component_subject_ids = [1];
    center.data.amalgamation_subject_ids = [2, 3];
    const layout = buildConstellationLayout(center, [subject(1, "radical", "一"), subject(2, "vocabulary", "一日", "いちにち"), subject(3, "vocabulary", "一人", "ひとり")]);

    expect(layout.anchors.map((anchor) => anchor.reading)).toEqual(["いち", "ひと"]);
    expect(layout.nodes.filter((node) => node.kind === "vocabulary")).toHaveLength(2);
    expect(layout.connections.filter((connection) => connection.kind === "reading")).toHaveLength(2);
  });

  it("keeps every circle separated in dense constellations", () => {
    const center = subject(440, "kanji", "三");
    center.data.readings = [
      { reading: "さん", type: "onyomi", primary: true, accepted_answer: true },
      { reading: "み", type: "kunyomi", primary: false, accepted_answer: true },
    ];
    center.data.component_subject_ids = [1, 2, 3];
    center.data.amalgamation_subject_ids = Array.from({ length: 36 }, (_, index) => index + 10);
    const relations = [
      ...Array.from({ length: 3 }, (_, index) => subject(index + 1, "radical", `部${index}`)),
      ...Array.from({ length: 36 }, (_, index) => subject(index + 10, "vocabulary", `三語${index}`, index % 2 ? "みご" : "さんご")),
    ];

    const layout = buildConstellationLayout(center, relations);

    for (let firstIndex = 0; firstIndex < layout.nodes.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < layout.nodes.length; secondIndex += 1) {
        const first = layout.nodes[firstIndex];
        const second = layout.nodes[secondIndex];
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        expect(distance).toBeGreaterThanOrEqual(constellationNodeRadius(first.kind) + constellationNodeRadius(second.kind) + CONSTELLATION_NODE_GAP - 0.01);
      }
    }
  });

  it("excludes visually similar kanji and bounds every positioned node", () => {
    const center = subject(20, "kanji", "土", "ど");
    center.data.visually_similar_subject_ids = [21];
    const layout = buildConstellationLayout(center, [subject(21, "kanji", "士", "し")]);

    expect(layout.nodes.map((node) => node.subject.id)).toEqual([20]);
    for (const node of layout.nodes) {
      const radius = constellationNodeRadius(node.kind);
      expect(node.x - radius).toBeGreaterThanOrEqual(layout.bounds.minX);
      expect(node.x + radius).toBeLessThanOrEqual(layout.bounds.maxX);
      expect(node.y - radius).toBeGreaterThanOrEqual(layout.bounds.minY);
      expect(node.y + radius).toBeLessThanOrEqual(layout.bounds.maxY);
    }
  });
});
