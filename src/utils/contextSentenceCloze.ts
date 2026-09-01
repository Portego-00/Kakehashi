const JAPANESE_TEXT_PATTERN = /[\u3040-\u309F\u30A0-\u30FF\u3400-\u9FFF]+/;
const LEADING_OR_TRAILING_TILDE_PATTERN = /^[〜～~]+|[〜～~]+$/g;
const ALL_TILDE_PATTERN = /[〜～~]/g;
const KANA_ENDING_PATTERN = /[\u3040-\u30FF]$/;
const VERB_CONJUGATION_SUFFIX_PATTERN =
  "(?:ませんでした|ません|ました|ます|られない|られた|られる|れない|れた|れる|させない|させた|させる|たくない|たかった|たい|らなかった|らない|なかった|ない|っていた|っている|ってる|ていた|ている|てる|でいた|でいる|でる|りました|ります|んで|んだ|った|って|いた|いて|いだ|した|して|たら|れば|よう|ろう|ろ|よ|ば|だ|で|た|て|る|う|く|ぐ|す|つ|ぬ|ぶ|む)";
const I_ADJECTIVE_SUFFIX_PATTERN =
  "(?:くなかった|くない|かった|くて|ければ|い)";
const GODAN_CONJUGATION_SUFFIX_PATTERNS: Record<string, string> = {
  う: "(?:いませんでした|いません|いました|います|いたくない|いたかった|いたい|わなかった|わない|っていた|っている|ってる|った|って|えば|おう)",
  く: "(?:きませんでした|きません|きました|きます|きたくない|きたかった|きたい|かなかった|かない|いていた|いている|いてる|いた|いて|けば|こう|った|って)",
  ぐ: "(?:ぎませんでした|ぎません|ぎました|ぎます|ぎたくない|ぎたかった|ぎたい|がなかった|がない|いでいた|いでいる|いでる|いだ|いで|げば|ごう)",
  す: "(?:しませんでした|しません|しました|します|したくない|したかった|したい|さなかった|さない|していた|している|してる|した|して|せない|せた|せる|せば|そう)",
  つ: "(?:ちませんでした|ちません|ちました|ちます|ちたくない|ちたかった|ちたい|たなかった|たない|っていた|っている|ってる|った|って|てば|とう)",
  ぬ: "(?:にませんでした|にません|にました|にます|にたくない|にたかった|にたい|ななかった|なない|んでいた|んでいる|んでる|んだ|んで|ねば|のう)",
  ぶ: "(?:びませんでした|びません|びました|びます|びたくない|びたかった|びたい|ばなかった|ばない|んでいた|んでいる|んでる|んだ|んで|べば|ぼう)",
  む: "(?:みませんでした|みません|みました|みます|みたくない|みたかった|みたい|まなかった|まない|んでいた|んでいる|んでる|んだ|んで|めば|もう)",
  る: "(?:りませんでした|りません|りました|ります|りたくない|りたかった|りたい|らなかった|らない|っていた|っている|ってる|った|って|れば|ろう)",
};

export type ContextSentenceClozeOptions = {
  /**
   * One-kana stems such as のむ -> のみました are inherently ambiguous in
   * unsegmented kana. Only enable this after the kanji form of the same saved
   * sentence has independently confirmed the attached vocabulary.
   */
  allowShortKanaConjugation?: boolean;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMatchCandidates(forms: readonly string[]): string[] {
  const candidates = new Set<string>();

  for (const rawForm of forms) {
    const trimmed = rawForm.trim();
    if (!trimmed) {
      continue;
    }

    candidates.add(trimmed);

    const withoutEdgeTildes = trimmed.replace(
      LEADING_OR_TRAILING_TILDE_PATTERN,
      "",
    );
    if (withoutEdgeTildes) {
      candidates.add(withoutEdgeTildes);
    }

    const withoutAnyTildes = trimmed.replace(ALL_TILDE_PATTERN, "");
    if (withoutAnyTildes) {
      candidates.add(withoutAnyTildes);
    }
  }

  return Array.from(candidates).sort((a, b) => b.length - a.length);
}

function tryBlankUsingConjugationMatch(
  sentence: string,
  candidates: readonly string[],
  options: ContextSentenceClozeOptions,
): string | null {
  for (const candidate of candidates) {
    if (candidate.length < 2 || !KANA_ENDING_PATTERN.test(candidate)) {
      continue;
    }

    const stem = candidate.slice(0, -1);
    if (!stem) {
      continue;
    }

    const isKanaOnlyStem = /^[\u3040-\u30FF]+$/.test(stem);
    if (
      isKanaOnlyStem &&
      stem.length < 2 &&
      !options.allowShortKanaConjugation
    ) {
      continue;
    }

    const escapedStem = escapeRegExp(stem);

    if (candidate.endsWith("い")) {
      const adjectiveRegex = new RegExp(
        `${escapedStem}${I_ADJECTIVE_SUFFIX_PATTERN}`,
      );
      const adjectiveBlanked = sentence.replace(adjectiveRegex, "＿＿＿");
      if (adjectiveBlanked !== sentence) {
        return adjectiveBlanked;
      }
    }

    const finalCharacter = candidate[candidate.length - 1] ?? "";
    const godanSuffixPattern = GODAN_CONJUGATION_SUFFIX_PATTERNS[finalCharacter];
    if (godanSuffixPattern) {
      const godanRegex = new RegExp(`${escapedStem}${godanSuffixPattern}`);
      const godanBlanked = sentence.replace(godanRegex, "＿＿＿");
      if (godanBlanked !== sentence) {
        return godanBlanked;
      }
    }

    const conjugationRegex = new RegExp(
      `${escapedStem}${VERB_CONJUGATION_SUFFIX_PATTERN}`,
    );
    const conjugationBlanked = sentence.replace(conjugationRegex, "＿＿＿");
    if (conjugationBlanked !== sentence) {
      return conjugationBlanked;
    }
  }

  return null;
}

/**
 * Blanks only when one of the supplied vocabulary forms can be found. This is
 * the safe path for user-authored sentences, where blanking an arbitrary word
 * would produce a misleading review question.
 */
export function tryBlankContextSentence(
  sentence: string,
  vocabularyForms: readonly string[],
  options: ContextSentenceClozeOptions = {},
): string | null {
  const candidates = getMatchCandidates(vocabularyForms);

  for (const candidate of candidates) {
    const exactRegex = new RegExp(escapeRegExp(candidate));
    const exactBlanked = sentence.replace(exactRegex, "＿＿＿");
    if (exactBlanked !== sentence) {
      return exactBlanked;
    }
  }

  return tryBlankUsingConjugationMatch(sentence, candidates, options);
}

/** Preserve the legacy fallback used by WaniKani-provided context sentences. */
export function blankContextSentence(
  sentence: string,
  vocabularyForms: readonly string[],
): string {
  return (
    tryBlankContextSentence(sentence, vocabularyForms) ??
    sentence.replace(JAPANESE_TEXT_PATTERN, "＿＿＿")
  );
}
