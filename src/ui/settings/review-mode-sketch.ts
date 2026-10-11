/** Kakehashi's prompt + answer controls, with controls large enough to distinguish at 82 px. */
export type ReviewModeSketchName = "type" | "choice" | "cards";
export function isReviewModeSketch(name: string): name is ReviewModeSketchName {
  return name === "type" || name === "choice" || name === "cards";
}
export const reviewSketch = {
  viewBox: "0 0 160 112",
  frame: "M10 4h140a6 6 0 0 1 6 6v92a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6Z",
  prompt: "M10 4h140a6 6 0 0 1 6 6v26H4V10a6 6 0 0 1 6-6Z",
  strip: "M4 36h152v12H4Z",
  character: "M68 13v8c0 4-1 7-3 9M80 13v16M93 13v17",
  progress: "",
  question: "M60 42h40",
} as const;
export const reviewModeSketches: Record<ReviewModeSketchName, {
  surface: string; outline: string; marks: string; correct: string; wrong: string;
}> = {
  type: {
    surface: "M124 63h23v34h-23Z",
    outline: "M18 63h124a5 5 0 0 1 5 5v24a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V68a5 5 0 0 1 5-5ZM124 63v34",
    marks: "M24 80h34M68 70v20M133 74l6 6-6 6",
    correct: "", wrong: "",
  },
  choice: {
    surface: "M18 55h53a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V60a5 5 0 0 1 5-5Z",
    outline: "M18 55h53a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V60a5 5 0 0 1 5-5ZM89 55h53a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H89a5 5 0 0 1-5-5V60a5 5 0 0 1 5-5ZM18 84h53a5 5 0 0 1 5 5v13H13V89a5 5 0 0 1 5-5ZM89 84h53a5 5 0 0 1 5 5v13H84V89a5 5 0 0 1 5-5Z",
    marks: "M38 66h27M101 66h30M29 95h30M101 95h30",
    correct: "M20 66l5 5 8-10", wrong: "",
  },
  cards: {
    surface: "M18 81h53a5 5 0 0 1 5 5v16H13V86a5 5 0 0 1 5-5ZM89 81h53a5 5 0 0 1 5 5v16H84V86a5 5 0 0 1 5-5Z",
    outline: "", marks: "M51 64h58",
    correct: "M104 91l7 7 13-15", wrong: "M37 86l13 13M50 86l-13 13",
  },
};
