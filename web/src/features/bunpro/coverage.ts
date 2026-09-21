import type { BunproJsonApiResource } from "../../../../src/types/bunpro";

export type CoverageItem = { id: number; resource: BunproJsonApiResource; learned: boolean; streak: number };
export const coverageStages = [
  { name: "Master", min: 12, color: "#c64949" },
  { name: "Expert", min: 10, color: "#9c3a52" },
  { name: "Seasoned", min: 7, color: "#55386e" },
  { name: "Adept", min: 4, color: "#153456" },
  { name: "Beginner", min: 0, color: "#082630" },
];
export function coverageItems(vocabulary: BunproJsonApiResource[], reviews: BunproJsonApiResource[]): CoverageItem[] {
  const byId = new Map(reviews.filter(item => ["Vocab", "Vocabulary"].includes(String(item.attributes.reviewable_type))).map(item => [Number(item.attributes.reviewable_id), item.attributes]));
  return vocabulary.map(resource => {
    const id = Number(resource.attributes.id ?? resource.id);
    const review = byId.get(id);
    return { id, resource, learned: review?.complete === true, streak: Number(review?.streak ?? 0) };
  });
}
export function coverageStage(streak: number) { return coverageStages.find(stage => streak >= stage.min) ?? coverageStages[4]; }
