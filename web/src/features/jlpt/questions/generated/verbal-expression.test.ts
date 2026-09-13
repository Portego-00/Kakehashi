import { describe, expect, it } from "vitest";
import type { JlptLevel, JlptQuestion } from "../../types";
import { N3_GENERATED_QUESTIONS } from "./n3.generated";
import { N4_GENERATED_QUESTIONS } from "./n4.generated";
import { N5_GENERATED_QUESTIONS } from "./n5.generated";

const BANKS: Record<"N5" | "N4" | "N3", readonly JlptQuestion[]> = {
  N5: N5_GENERATED_QUESTIONS,
  N4: N4_GENERATED_QUESTIONS,
  N3: N3_GENERATED_QUESTIONS,
};

function verbalQuestions(level: JlptLevel) {
  return BANKS[level as keyof typeof BANKS].filter(
    (question) => question.officialType === "listening-verbal",
  );
}

describe("generated N5–N3 verbal-expression listening", () => {
  it.each(["N5", "N4", "N3"] as const)(
    "gives every %s record an illustration and an authentic audio sequence",
    (level) => {
      const questions = verbalQuestions(level);
      expect(questions).toHaveLength(200);
      expect(
        new Set(questions.map((question) => question.provenance?.semanticKey))
          .size,
      ).toBe(10);

      for (const question of questions) {
        const listening = question.listening!;
        const scene = listening.verbalScene!;
        const questionOffset = listening.script.indexOf("何と言いますか。");
        const firstChoiceOffset = listening.script.indexOf("一、");

        expect(question.options).toHaveLength(3);
        expect(listening.audioOnlyOptions).toBe(true);
        expect(
          listening.script.startsWith("絵を見てください。\n"),
          question.id,
        ).toBe(true);
        expect(listening.script.slice(0, questionOffset).trimEnd()).toMatch(
          /話します。$/u,
        );
        expect(listening.script.slice(0, questionOffset)).not.toMatch(
          /シャツ|えんぴつ|機械|水|写真|窓を|メニュー|かさ|箱|領収書|荷物|料理|充電器/u,
        );
        expect(listening.script.match(/何と言いますか。/gu)).toHaveLength(1);
        expect(questionOffset).toBeGreaterThan(5);
        expect(firstChoiceOffset).toBeGreaterThan(questionOffset);
        expect(listening.script).toMatch(
          /一、[^\n]+\n二、[^\n]+\n三、[^\n]+$/u,
        );
        expect(scene.speaker.side).not.toBe(scene.partner.side);
        expect(scene.description.length).toBeGreaterThan(30);
      }
    },
  );

  it.each(["N5", "N4", "N3"] as const)(
    "uses multiple independent scene structures at %s",
    (level) => {
      const structures = verbalQuestions(level).map((question) => {
        const scene = question.listening!.verbalScene!;
        return [
          scene.setting,
          scene.speaker.pose,
          scene.partner.pose,
          scene.prop?.kind,
        ].join("|");
      });
      expect(new Set(structures).size).toBeGreaterThanOrEqual(9);
    },
  );

  it("keeps level-specific social register in the keyed expressions", () => {
    const correctLabels = (level: "N5" | "N4" | "N3") =>
      verbalQuestions(level).map(
        (question) =>
          question.options.find(
            (option) => option.id === question.correctOptionId,
          )!.label,
      );

    expect(correctLabels("N5")).toContain("使い方を教えてください");
    expect(correctLabels("N4")).toContain(
      "領収書の出し方を教えてもらえませんか",
    );
    expect(correctLabels("N3")).toContain(
      "この表示の意味を教えていただけますか",
    );
  });

  it("does not recycle the same keyed interaction as a politeness swap across levels", () => {
    const semanticInteractions = (level: "N5" | "N4" | "N3") =>
      verbalQuestions(level)
        .filter((question) => question.provenance?.variantIndex === 0)
        .map(
          (question) =>
            question.options.find(
              (option) => option.id === question.correctOptionId,
            )!.label,
        );

    const n5 = new Set(semanticInteractions("N5"));
    const n4 = new Set(semanticInteractions("N4"));
    const n3 = new Set(semanticInteractions("N3"));
    expect([...n5].filter((label) => n4.has(label) || n3.has(label))).toEqual(
      [],
    );
    expect([...n4].filter((label) => n3.has(label))).toEqual([]);
  });

  it("keeps the audited image-dependent interactions unambiguous", () => {
    const question = (level: "N5" | "N4" | "N3", suffix: string) => {
      const item = verbalQuestions(level).find((candidate) =>
        candidate.id.endsWith(suffix),
      );
      expect(item, `${level} ${suffix}`).toBeDefined();
      return item!;
    };
    const correctLabel = (item: JlptQuestion) =>
      item.options.find((option) => option.id === item.correctOptionId)!.label;

    const hotWindow = question("N5", "-007");
    expect(hotWindow.listening?.verbalScene?.prop?.kind).toBe("window");
    expect(correctLabel(hotWindow)).toBe("窓を開けてもいいですか");
    expect(hotWindow.options.map((option) => option.label)).toEqual(
      expect.arrayContaining(["窓を閉めてもいいですか", "窓を閉めてください"]),
    );

    const heldDocument = question("N4", "-004");
    expect(heldDocument.listening?.verbalScene?.partner.pose).toBe("holding");
    expect(correctLabel(heldDocument)).toBe("その資料を見せてもらえますか");

    const appointment = question("N4", "-007");
    expect(appointment.listening?.verbalScene?.prop?.kind).toBe("calendar");
    expect(correctLabel(appointment)).toBe("予約の時間を変えてもらえますか");
  });
});
