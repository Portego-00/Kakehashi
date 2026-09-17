import { customSrsStatePatch } from "./state-patch";
import type { CustomSrsState } from "./types";

export type CustomSrsConfirmed = { state: CustomSrsState; revision: number };
type Delta = ReturnType<typeof customSrsStatePatch> & { baseRevision: number };
export type CustomSrsWireResult = { available: true; revision: number } & ({ state: CustomSrsState } | { delta: Delta });

/** Delta responses are safe only when the client has the exact state we read. */
export function customSrsWireResult(result: CustomSrsConfirmed, previous?: CustomSrsConfirmed, knownRevision?: number): CustomSrsWireResult {
  if (previous && knownRevision === previous.revision) {
    return { available: true, revision: result.revision, delta: { baseRevision: previous.revision, ...customSrsStatePatch(previous.state, result.state) } };
  }
  return { available: true, ...result };
}

export function expandCustomSrsWireResult(value: unknown, previous?: CustomSrsConfirmed): unknown {
  if (!value || typeof value !== "object") return value;
  if ("unchanged" in value) {
    if (value.unchanged !== true || !("revision" in value) || !previous || value.revision !== previous.revision
      || !("available" in value) || value.available !== true) throw new Error("Cloud sync returned an invalid revision. Refresh and retry.");
    return { available: true, ...previous };
  }
  if (!("delta" in value)) return value;
  const wire = value as { available: boolean; revision: number; delta: Delta };
  const delta = wire.delta;
  if (wire.available !== true || !Number.isSafeInteger(wire.revision) || !previous || delta?.baseRevision !== previous.revision
    || wire.revision < previous.revision || !delta.p_metadata || typeof delta.p_metadata !== "object"
    || !delta.p_assignments || typeof delta.p_assignments !== "object" || Array.isArray(delta.p_assignments)
    || !Array.isArray(delta.p_reviews)) throw new Error("Cloud sync returned an invalid update. Refresh and retry.");
  const events = new Set(delta.p_reviews.map((entry) => entry.eventId));
  return {
    available: true, revision: wire.revision,
    state: {
      ...delta.p_metadata,
      assignments: { ...previous.state.assignments, ...delta.p_assignments },
      reviewLog: [...previous.state.reviewLog.filter((entry) => !events.has(entry.eventId)), ...delta.p_reviews].slice(-2000),
    },
  };
}
