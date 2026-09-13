import type { Subject } from "@/types/wanikani";
import { matchVocabularyToKanjiReading, uniqueKanjiReadings } from "./reading-examples";

export type ConstellationNodeKind = "center" | "component" | "vocabulary";
export type ConstellationConnectionKind = "component" | "reading" | "vocabulary";
export type ConstellationNodePosition = { subject: Subject; x: number; y: number; kind: ConstellationNodeKind };
export type ConstellationAnchor = { key: string; reading: string; x: number; y: number };
export type ConstellationConnection = { key: string; x1: number; y1: number; x2: number; y2: number; kind: ConstellationConnectionKind };
export type ConstellationBounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
export type ConstellationLayout = { nodes: ConstellationNodePosition[]; anchors: ConstellationAnchor[]; connections: ConstellationConnection[]; bounds: ConstellationBounds };

export const CONSTELLATION_NODE_GAP = 24;
export const constellationNodeRadius = (kind: ConstellationNodeKind) => kind === "center" ? 58 : 44;

export function constellationNodeFontSize(value: string, options: { center?: boolean; reading?: boolean } = {}) {
  const units = Array.from(value).reduce((width, character) => width + (/^[\x20-\x7E]$/.test(character) ? 0.58 : 1), 0);
  const availableWidth = options.center ? 96 : 68;
  const maximumSize = options.reading ? 14 : options.center ? 32 : 24;
  return Math.round(Math.min(maximumSize, availableWidth / Math.max(units, 1)) * 100) / 100;
}

const CENTER = { x: 0, y: 0 };
const ANCHOR_RADIUS = 48;
const WORLD_PADDING = 132;
const MIN_WORLD_SIZE = 620;

type LayoutBody = { x: number; y: number; idealX: number; idealY: number; radius: number; fixed?: boolean };

function pointOnRing(index: number, count: number, radius: number, phase = -Math.PI / 2) {
  const angle = phase + (index / Math.max(count, 1)) * Math.PI * 2;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle };
}

function settleCollisions(bodies: LayoutBody[]) {
  const settle = (withAttraction: boolean) => {
    if (withAttraction) {
      for (const body of bodies) {
        if (body.fixed) continue;
        body.x += (body.idealX - body.x) * 0.018;
        body.y += (body.idealY - body.y) * 0.018;
      }
    }

    for (let firstIndex = 0; firstIndex < bodies.length; firstIndex += 1) {
      const first = bodies[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < bodies.length; secondIndex += 1) {
        const second = bodies[secondIndex];
        let dx = second.x - first.x;
        let dy = second.y - first.y;
        let distance = Math.hypot(dx, dy);
        const minimumDistance = first.radius + second.radius + CONSTELLATION_NODE_GAP;
        if (distance >= minimumDistance) continue;
        if (distance < 0.001) {
          const angle = ((firstIndex + 1) * 1.618 + secondIndex) * Math.PI * 0.5;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const overlap = minimumDistance - distance + 0.1;
        const unitX = dx / distance;
        const unitY = dy / distance;
        if (first.fixed) {
          second.x += unitX * overlap;
          second.y += unitY * overlap;
        } else if (second.fixed) {
          first.x -= unitX * overlap;
          first.y -= unitY * overlap;
        } else {
          first.x -= unitX * overlap * 0.5;
          first.y -= unitY * overlap * 0.5;
          second.x += unitX * overlap * 0.5;
          second.y += unitY * overlap * 0.5;
        }
      }
    }
  };

  for (let iteration = 0; iteration < 220; iteration += 1) settle(true);
  for (let iteration = 0; iteration < 24; iteration += 1) settle(false);
}

function calculateBounds(bodies: LayoutBody[]): ConstellationBounds {
  const rawMinX = Math.min(...bodies.map((body) => body.x - body.radius)) - WORLD_PADDING;
  const rawMinY = Math.min(...bodies.map((body) => body.y - body.radius)) - WORLD_PADDING;
  const rawMaxX = Math.max(...bodies.map((body) => body.x + body.radius)) + WORLD_PADDING;
  const rawMaxY = Math.max(...bodies.map((body) => body.y + body.radius)) + WORLD_PADDING;
  const width = Math.max(rawMaxX - rawMinX, MIN_WORLD_SIZE);
  const height = Math.max(rawMaxY - rawMinY, MIN_WORLD_SIZE);
  const centerX = (rawMinX + rawMaxX) / 2;
  const centerY = (rawMinY + rawMaxY) / 2;
  return { minX: centerX - width / 2, minY: centerY - height / 2, maxX: centerX + width / 2, maxY: centerY + height / 2, width, height };
}

export function buildConstellationLayout(center: Subject, relations: Subject[]): ConstellationLayout {
  const relationById = new Map(relations.map((subject) => [subject.id, subject]));
  const usedIds = new Set<number>([center.id]);
  const takeRelations = (ids: number[] | undefined, limit: number) => (ids ?? [])
    .map((id) => relationById.get(id))
    .filter((subject): subject is Subject => subject !== undefined && !usedIds.has(subject.id))
    .slice(0, limit)
    .filter((subject) => {
      usedIds.add(subject.id);
      return true;
    });

  const components = takeRelations(center.data.component_subject_ids, 16);
  const vocabulary = takeRelations(center.data.amalgamation_subject_ids, 28);
  const nodes: ConstellationNodePosition[] = [{ subject: center, ...CENTER, kind: "center" }];
  const anchors: ConstellationAnchor[] = [];
  const vocabularyAnchorById = new Map<number, string>();

  const innerRelations = components.map((subject) => ({ subject, kind: "component" as const }));
  innerRelations.forEach(({ subject, kind }, index) => {
    const ring = Math.floor(index / 10);
    const indexInRing = index % 10;
    const countInRing = Math.min(10, innerRelations.length - ring * 10);
    const point = pointOnRing(indexInRing, countInRing, 178 + ring * 118, Math.PI / 10);
    nodes.push({ subject, kind, x: point.x, y: point.y });
  });

  const readings = center.object === "kanji" ? uniqueKanjiReadings(center.data.readings ?? []) : [];
  if (readings.length && vocabulary.length) {
    const grouped = new Map(readings.map((reading) => [reading.normalizedReading, [] as Subject[]]));
    const preferred = readings.some((reading) => reading.type !== "nanori") ? readings.filter((reading) => reading.type !== "nanori") : readings;
    const fallbackReading = preferred[0] ?? readings[0];
    for (const subject of vocabulary) {
      const match = matchVocabularyToKanjiReading(center, subject);
      const target = match ?? preferred.reduce((least, candidate) => (grouped.get(candidate.normalizedReading)?.length ?? 0) < (grouped.get(least.normalizedReading)?.length ?? 0) ? candidate : least, fallbackReading);
      grouped.get(target.normalizedReading)?.push(subject);
    }

    readings.forEach((reading, readingIndex) => {
      const anchorPoint = pointOnRing(readingIndex, readings.length, readings.length === 1 ? 292 : 342);
      anchors.push({ key: reading.normalizedReading, reading: reading.reading, x: anchorPoint.x, y: anchorPoint.y });
      const subjects = grouped.get(reading.normalizedReading) ?? [];
      subjects.forEach((subject, subjectIndex) => {
        const ring = Math.floor(subjectIndex / 7);
        const indexInRing = subjectIndex % 7;
        const countInRing = Math.min(7, subjects.length - ring * 7);
        const spread = Math.min(Math.PI * 0.92, Math.max(Math.PI * 0.28, countInRing * 0.31));
        const offset = countInRing === 1 ? 0 : -spread / 2 + (indexInRing / (countInRing - 1)) * spread;
        const distance = 162 + ring * 126;
        const angle = anchorPoint.angle + offset;
        nodes.push({ subject, kind: "vocabulary", x: anchorPoint.x + Math.cos(angle) * distance, y: anchorPoint.y + Math.sin(angle) * distance });
        vocabularyAnchorById.set(subject.id, reading.normalizedReading);
      });
    });
  } else {
    vocabulary.forEach((subject, index) => {
      const ring = Math.floor(index / 12);
      const indexInRing = index % 12;
      const countInRing = Math.min(12, vocabulary.length - ring * 12);
      const point = pointOnRing(indexInRing, countInRing, 332 + ring * 128);
      nodes.push({ subject, kind: "vocabulary", x: point.x, y: point.y });
    });
  }

  const bodies: LayoutBody[] = [
    ...nodes.map((node) => ({ x: node.x, y: node.y, idealX: node.x, idealY: node.y, radius: constellationNodeRadius(node.kind), fixed: node.kind === "center" })),
    ...anchors.map((anchor) => ({ x: anchor.x, y: anchor.y, idealX: anchor.x, idealY: anchor.y, radius: ANCHOR_RADIUS })),
  ];
  settleCollisions(bodies);
  nodes.forEach((node, index) => Object.assign(node, { x: bodies[index].x, y: bodies[index].y }));
  anchors.forEach((anchor, index) => Object.assign(anchor, { x: bodies[nodes.length + index].x, y: bodies[nodes.length + index].y }));

  const nodeById = new Map(nodes.map((node) => [node.subject.id, node]));
  const anchorByKey = new Map(anchors.map((anchor) => [anchor.key, anchor]));
  const connections: ConstellationConnection[] = [];
  for (const component of components) {
    const node = nodeById.get(component.id);
    if (node) connections.push({ key: `component-${component.id}`, x1: 0, y1: 0, x2: node.x, y2: node.y, kind: "component" });
  }
  for (const anchor of anchors) connections.push({ key: `reading-${anchor.key}`, x1: 0, y1: 0, x2: anchor.x, y2: anchor.y, kind: "reading" });
  for (const item of vocabulary) {
    const node = nodeById.get(item.id);
    if (!node) continue;
    const anchor = anchorByKey.get(vocabularyAnchorById.get(item.id) ?? "");
    connections.push({ key: `vocabulary-${item.id}`, x1: anchor?.x ?? 0, y1: anchor?.y ?? 0, x2: node.x, y2: node.y, kind: "vocabulary" });
  }

  return { nodes, anchors, connections, bounds: calculateBounds(bodies) };
}
