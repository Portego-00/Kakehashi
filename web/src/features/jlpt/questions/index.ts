import type { JlptLevel, JlptQuestion } from "../types";

const levelLoaders: Record<JlptLevel, () => Promise<readonly JlptQuestion[]>> =
  {
    N5: () => import("./n5").then((module) => module.N5_QUESTIONS),
    N4: () => import("./n4").then((module) => module.N4_QUESTIONS),
    N3: () => import("./n3").then((module) => module.N3_QUESTIONS),
    N2: () => import("./n2").then((module) => module.N2_QUESTIONS),
    N1: () => import("./n1").then((module) => module.N1_QUESTIONS),
  };

export function loadJlptQuestionBank(level: JlptLevel) {
  return levelLoaders[level]();
}
