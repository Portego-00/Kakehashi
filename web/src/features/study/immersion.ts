import type { StudyFilters, StudyQuestion } from "./types";

interface ImmersionExample {
  sentence: string;
  translation: string;
  title: string;
  audio?: string;
  imageUrl?: string;
}

async function fetchExample(characters: string, sources: string[]): Promise<ImmersionExample | null> {
  const response = await fetch("/api/study/immersion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: characters, sources }),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { example?: ImmersionExample | null };
  return payload.example ?? null;
}

export async function addAnimeContext(questions: StudyQuestion[], filters: StudyFilters): Promise<StudyQuestion[]> {
  const characterPool = [...new Set(questions.map((question) => question.characters).filter((value): value is string => Boolean(value)))];
  const examples = new Map<string, Promise<ImmersionExample | null>>();
  for (const characters of characterPool) {
    examples.set(characters, fetchExample(characters, filters.animeSources).catch(() => null));
  }
  const enriched = await Promise.all(questions.map(async (question) => {
    if (!question.characters) return null;
    const example = await examples.get(question.characters);
    if (!example?.audio || !example.sentence.includes(question.characters!)) return null;
    const masked = example.sentence.replaceAll(question.characters, "＿＿");
    const characterPhase = question.kind === "listening-characters";
    const distractors = characterPool.filter((value) => value !== question.characters).sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = filters.answerMode === "multiple-choice"
      ? characterPhase
        ? [question.characters, ...distractors].filter((value): value is string => Boolean(value)).sort(() => Math.random() - 0.5)
        : question.choices
      : undefined;
    return {
      ...question,
      prompt: masked,
      promptLabel: `${question.promptLabel} · ${example.title}`,
      choices,
      audioUrl: example.audio,
      imageUrl: example.imageUrl,
      sourceTitle: example.title,
      sentence: { ja: example.sentence, en: example.translation, masked },
    } satisfies StudyQuestion;
  }));
  return enriched.flatMap((question) => question ? [question as StudyQuestion] : []);
}
