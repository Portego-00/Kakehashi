// The native client and web client share one persisted schema and catalog.
export type * from "../../../web/src/features/custom-srs/types";

export type CustomSrsMutation =
  | { action: "enroll_pack"; packId: string; eventId: string }
  | { action: "complete_lesson"; wordId: string; eventId: string }
  | { action: "submit_review"; wordId: string; incorrectAnswers: number; eventId: string };
