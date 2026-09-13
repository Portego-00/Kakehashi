import {
  JLPT_APPROXIMATE_ITEM_COUNTS,
  JLPT_MOCK_STRUCTURES,
  OFFICIAL_TYPE_LABELS,
  OFFICIAL_TYPES_BY_LEVEL,
  SKILL_LABELS,
  testSectionIdForQuestion,
} from "./structure";
import { jlptQuestionSemanticKey } from "./editorial";
import {
  JLPT_BANK_VERSION,
  type JlptAnswer,
  type JlptLevel,
  type JlptPerformanceSlice,
  type JlptQuestion,
  type JlptQuizMode,
  type JlptSession,
  type JlptSessionResult,
  type JlptSkill,
} from "./types";

const QUICK_QUESTION_COUNT = 10;
const QUICK_SKILL_ORDER: readonly JlptSkill[] = [
  "kanji",
  "vocabulary",
  "grammar",
  "reading",
  "listening",
];

function iso(date: Date) {
  return date.toISOString();
}

function makeId(level: JlptLevel, mode: JlptQuizMode, now: Date) {
  return `jlpt-${level.toLocaleLowerCase()}-${mode}-${now.getTime()}`;
}

function shuffled<T>(values: readonly T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/** Interleave semantic groups before repeating a controlled rendering. */
function semanticallyInterleaved(
  questions: readonly JlptQuestion[],
  random: () => number,
) {
  const groups = new Map<string, JlptQuestion[]>();
  for (const question of shuffled(questions, random)) {
    const key = jlptQuestionSemanticKey(question);
    groups.set(key, [...(groups.get(key) ?? []), question]);
  }
  const queues = shuffled([...groups.values()], random).map((group) =>
    shuffled(group, random),
  );
  const result: JlptQuestion[] = [];
  for (
    let round = 0;
    queues.some((queue) => round < queue.length);
    round += 1
  ) {
    for (const queue of queues) if (queue[round]) result.push(queue[round]);
  }
  return result;
}

function unseenFirstSample(
  questions: readonly JlptQuestion[],
  count: number,
  excludedQuestionIds: ReadonlySet<string>,
  excludedSemanticKeys: ReadonlySet<string>,
  random: () => number,
  preferred: (question: JlptQuestion) => boolean = () => true,
) {
  const unseen = questions.filter(
    (question) => !excludedQuestionIds.has(question.id),
  );
  const seen = questions.filter((question) =>
    excludedQuestionIds.has(question.id),
  );
  const hasUnseenSemantic = (question: JlptQuestion) =>
    !excludedSemanticKeys.has(jlptQuestionSemanticKey(question));
  const tiers = [
    unseen.filter(
      (question) => hasUnseenSemantic(question) && preferred(question),
    ),
    unseen.filter(
      (question) => hasUnseenSemantic(question) && !preferred(question),
    ),
    unseen.filter(
      (question) => !hasUnseenSemantic(question) && preferred(question),
    ),
    unseen.filter(
      (question) => !hasUnseenSemantic(question) && !preferred(question),
    ),
    seen.filter(
      (question) => hasUnseenSemantic(question) && preferred(question),
    ),
    seen.filter(
      (question) => hasUnseenSemantic(question) && !preferred(question),
    ),
    seen.filter(
      (question) => !hasUnseenSemantic(question) && preferred(question),
    ),
    seen.filter(
      (question) => !hasUnseenSemantic(question) && !preferred(question),
    ),
  ];
  return tiers
    .flatMap((tier) => semanticallyInterleaved(tier, random))
    .slice(0, Math.min(count, questions.length));
}

function groupedTextGrammarSample(
  questions: readonly JlptQuestion[],
  count: number,
  excludedQuestionIds: ReadonlySet<string>,
  excludedSemanticKeys: ReadonlySet<string>,
  random: () => number,
) {
  const groups = new Map<string, JlptQuestion[]>();
  for (const question of questions) {
    const groupId = question.passage?.groupId;
    if (groupId)
      groups.set(groupId, [...(groups.get(groupId) ?? []), question]);
  }
  const candidates = shuffled(
    [...groups.values()].filter(
      (group) => group.length > 1 && group.length <= count,
    ),
    random,
  ).sort((left, right) => {
    const rank = (group: readonly JlptQuestion[]) => {
      const unseenIds = group.every(
        (question) => !excludedQuestionIds.has(question.id),
      );
      const unseenSemantics = group.every(
        (question) =>
          !excludedSemanticKeys.has(jlptQuestionSemanticKey(question)),
      );
      return (unseenSemantics ? 2 : 0) + (unseenIds ? 1 : 0);
    };
    return rank(right) - rank(left);
  });
  const selectedGroup = [...(candidates[0] ?? [])].sort(
    (left, right) =>
      (left.passage?.blankOrder ?? 0) - (right.passage?.blankOrder ?? 0),
  );
  if (selectedGroup.length === 0) {
    return unseenFirstSample(
      questions,
      count,
      excludedQuestionIds,
      excludedSemanticKeys,
      random,
    );
  }

  const selectedIds = new Set(selectedGroup.map((question) => question.id));
  const selectedSemantics = new Set([
    ...excludedSemanticKeys,
    ...selectedGroup.map(jlptQuestionSemanticKey),
  ]);
  const remainder = unseenFirstSample(
    questions.filter((question) => !selectedIds.has(question.id)),
    count - selectedGroup.length,
    new Set([...excludedQuestionIds, ...selectedIds]),
    selectedSemantics,
    random,
  );
  return [...selectedGroup, ...remainder];
}

/**
 * Select complete multi-question reading sources before individual items.
 * A rendered group ID includes its controlled variant, while semantic keys
 * prevent a second rendering of that same source's questions entering a form.
 */
function groupedReadingSample(
  questions: readonly JlptQuestion[],
  count: number,
  excludedQuestionIds: ReadonlySet<string>,
  excludedSemanticKeys: ReadonlySet<string>,
  random: () => number,
) {
  const groups = new Map<string, JlptQuestion[]>();
  for (const question of questions) {
    const groupId = question.passage?.groupId;
    if (groupId && question.passage?.groupQuestionIndex) {
      groups.set(groupId, [...(groups.get(groupId) ?? []), question]);
    }
  }
  const rank = (group: readonly JlptQuestion[]) => {
    const unseenIds = group.every(
      (question) => !excludedQuestionIds.has(question.id),
    );
    const unseenSemantics = group.every(
      (question) =>
        !excludedSemanticKeys.has(jlptQuestionSemanticKey(question)),
    );
    return (unseenSemantics ? 2 : 0) + (unseenIds ? 1 : 0);
  };
  const candidates = shuffled(
    [...groups.values()].filter(
      (group) => group.length > 1 && group.length <= count,
    ),
    random,
  ).sort((left, right) => rank(right) - rank(left));
  const selected: JlptQuestion[] = [];
  const selectedIds = new Set<string>();
  const selectedInFormSemantics = new Set<string>();
  const hasAnyUnseenSemantic = questions.some(
    (question) => !excludedSemanticKeys.has(jlptQuestionSemanticKey(question)),
  );

  for (const candidate of candidates) {
    if (selected.length + candidate.length > count) continue;
    if (
      candidate.some((question) =>
        selectedInFormSemantics.has(jlptQuestionSemanticKey(question)),
      )
    )
      continue;
    if (
      hasAnyUnseenSemantic &&
      candidate.some((question) =>
        excludedSemanticKeys.has(jlptQuestionSemanticKey(question)),
      )
    )
      continue;
    const ordered = [...candidate].sort(
      (left, right) =>
        (left.passage?.groupQuestionIndex ?? 0) -
        (right.passage?.groupQuestionIndex ?? 0),
    );
    for (const question of ordered) {
      selected.push(question);
      selectedIds.add(question.id);
      selectedInFormSemantics.add(jlptQuestionSemanticKey(question));
    }
    if (selected.length === count) break;
  }

  const remainder = unseenFirstSample(
    questions.filter(
      (question) =>
        !selectedIds.has(question.id) &&
        !selectedInFormSemantics.has(jlptQuestionSemanticKey(question)),
    ),
    count - selected.length,
    new Set([...excludedQuestionIds, ...selectedIds]),
    new Set([...excludedSemanticKeys, ...selectedInFormSemantics]),
    random,
  );
  return [...selected, ...remainder];
}

function selectedQuickQuestions(
  questions: readonly JlptQuestion[],
  skills: readonly JlptSkill[] | undefined,
  excludedQuestionIds: ReadonlySet<string>,
  excludedSemanticKeys: ReadonlySet<string>,
  random: () => number,
) {
  const allowed = skills?.length ? new Set(skills) : null;
  const eligible = allowed
    ? questions.filter((question) => allowed.has(question.skill))
    : [...questions];
  if (allowed)
    return unseenFirstSample(
      eligible,
      QUICK_QUESTION_COUNT,
      excludedQuestionIds,
      excludedSemanticKeys,
      random,
      (question) => Boolean(question.shortQuiz),
    );

  const selected: JlptQuestion[] = [];
  const selectedIds = new Set<string>();
  const representedSkills = QUICK_SKILL_ORDER.filter((skill) =>
    eligible.some((question) => question.skill === skill),
  );
  const perSkill = representedSkills.length
    ? Math.floor(QUICK_QUESTION_COUNT / representedSkills.length)
    : 0;
  for (const skill of representedSkills) {
    const choices = unseenFirstSample(
      eligible.filter((question) => question.skill === skill),
      perSkill,
      excludedQuestionIds,
      excludedSemanticKeys,
      random,
      (question) => Boolean(question.shortQuiz),
    );
    for (const question of choices) {
      selected.push(question);
      selectedIds.add(question.id);
    }
  }
  const remaining = unseenFirstSample(
    eligible.filter((question) => !selectedIds.has(question.id)),
    QUICK_QUESTION_COUNT - selected.length,
    excludedQuestionIds,
    excludedSemanticKeys,
    random,
    (question) => Boolean(question.shortQuiz),
  );
  return shuffled([...selected, ...remaining], random);
}

function mockSectionQuestions(
  level: JlptLevel,
  questions: readonly JlptQuestion[],
  excludedQuestionIds: ReadonlySet<string>,
  excludedSemanticKeys: ReadonlySet<string>,
  random: () => number,
) {
  const structure = JLPT_MOCK_STRUCTURES[level];
  return structure.sections.map((section) =>
    OFFICIAL_TYPES_BY_LEVEL[level].flatMap((officialType) => {
      const pool = questions.filter(
        (question) =>
          question.officialType === officialType &&
          testSectionIdForQuestion(level, question) === section.id,
      );
      const count = JLPT_APPROXIMATE_ITEM_COUNTS[level][officialType] ?? 0;
      return officialType === "text-grammar"
        ? groupedTextGrammarSample(
            pool,
            count,
            excludedQuestionIds,
            excludedSemanticKeys,
            random,
          )
        : pool.some((question) => question.passage?.groupQuestionIndex)
          ? groupedReadingSample(
              pool,
              count,
              excludedQuestionIds,
              excludedSemanticKeys,
              random,
            )
          : unseenFirstSample(
              pool,
              count,
              excludedQuestionIds,
              excludedSemanticKeys,
              random,
            );
    }),
  );
}

export function createJlptSession({
  level,
  mode,
  questions,
  immediateFeedback = true,
  weakSkills,
  now = new Date(),
  random = Math.random,
  excludedQuestionIds = new Set<string>(),
  excludedSemanticKeys = new Set<string>(),
}: {
  level: JlptLevel;
  mode: JlptQuizMode;
  questions: readonly JlptQuestion[];
  immediateFeedback?: boolean;
  weakSkills?: readonly JlptSkill[];
  now?: Date;
  random?: () => number;
  excludedQuestionIds?: ReadonlySet<string> | readonly string[];
  excludedSemanticKeys?: ReadonlySet<string> | readonly string[];
}): JlptSession {
  const structure = JLPT_MOCK_STRUCTURES[level];
  const excluded =
    excludedQuestionIds instanceof Set
      ? excludedQuestionIds
      : new Set(excludedQuestionIds);
  const excludedSemantics =
    excludedSemanticKeys instanceof Set
      ? excludedSemanticKeys
      : new Set(excludedSemanticKeys);
  const sections =
    mode === "mock"
      ? mockSectionQuestions(
          level,
          questions,
          excluded,
          excludedSemantics,
          random,
        )
      : [
          selectedQuickQuestions(
            questions,
            mode === "weak" ? weakSkills : undefined,
            excluded,
            excludedSemantics,
            random,
          ),
        ];
  const durationSeconds =
    mode === "mock" ? structure.sections[0].durationMinutes * 60 : null;
  return {
    version: 1,
    bankVersion: JLPT_BANK_VERSION,
    id: makeId(level, mode, now),
    level,
    mode,
    status: "active",
    immediateFeedback: mode === "mock" ? false : immediateFeedback,
    sectionQuestionIds: sections.map((section) =>
      section.map((question) => question.id),
    ),
    currentSectionIndex: 0,
    currentQuestionIndex: 0,
    answers: [],
    listeningPlays: {},
    deadlineAt:
      durationSeconds === null
        ? null
        : iso(new Date(now.getTime() + durationSeconds * 1000)),
    remainingSeconds: durationSeconds,
    createdAt: iso(now),
    updatedAt: iso(now),
    weakSkills: mode === "weak" ? [...(weakSkills ?? [])] : undefined,
  };
}

export function jlptListeningPlaybackScript(question: JlptQuestion) {
  if (!question.listening) return "";
  const stimulus = question.listening.script
    .replace(/(^|[。！？\n])[^。！？\n：]{1,18}：/gu, "$1")
    .replace(/\n+/g, "　");
  if (
    question.officialType === "listening-task" ||
    question.officialType === "listening-key-points"
  ) {
    return `${question.stem}　${stimulus}　${question.stem}`;
  }
  return stimulus;
}

export function recordJlptListeningPlay(
  session: JlptSession,
  question: JlptQuestion,
  now = new Date(),
): JlptSession {
  if (
    session.status !== "active" ||
    currentJlptQuestionId(session) !== question.id ||
    !question.listening
  )
    return session;
  const allowedPlays =
    session.mode === "mock" ? 1 : question.listening.maxPlays;
  const usedPlays = session.listeningPlays[question.id] ?? 0;
  if (usedPlays >= allowedPlays) return session;
  return {
    ...session,
    listeningPlays: { ...session.listeningPlays, [question.id]: usedPlays + 1 },
    updatedAt: iso(now),
  };
}

export function releaseJlptListeningPlay(
  session: JlptSession,
  questionId: string,
  now = new Date(),
): JlptSession {
  const usedPlays = session.listeningPlays[questionId] ?? 0;
  if (usedPlays <= 0) return session;
  const listeningPlays = { ...session.listeningPlays };
  if (usedPlays === 1) delete listeningPlays[questionId];
  else listeningPlays[questionId] = usedPlays - 1;
  return { ...session, listeningPlays, updatedAt: iso(now) };
}

export function currentJlptQuestionId(session: JlptSession) {
  return (
    session.sectionQuestionIds[session.currentSectionIndex]?.[
      session.currentQuestionIndex
    ] ?? null
  );
}

export function answerForQuestion(session: JlptSession, questionId: string) {
  return session.answers.find((answer) => answer.questionId === questionId);
}

export function answerCurrentJlptQuestion(
  session: JlptSession,
  question: JlptQuestion,
  selectedOptionId: string,
  now = new Date(),
  selectedOrderOptionIds?: readonly string[],
): JlptSession {
  if (
    session.status !== "active" ||
    currentJlptQuestionId(session) !== question.id ||
    answerForQuestion(session, question.id)
  )
    return session;
  if (!question.options.some((option) => option.id === selectedOptionId))
    return session;
  const canonicalOrder = question.sentenceComposition?.canonicalOrderOptionIds;
  if (canonicalOrder && !selectedOrderOptionIds) return session;
  if (selectedOrderOptionIds) {
    const optionIds = new Set(question.options.map((option) => option.id));
    if (
      !canonicalOrder ||
      selectedOrderOptionIds.length !== question.options.length ||
      new Set(selectedOrderOptionIds).size !== selectedOrderOptionIds.length ||
      selectedOrderOptionIds.some((optionId) => !optionIds.has(optionId)) ||
      selectedOrderOptionIds[question.sentenceComposition!.starredPosition] !==
        selectedOptionId
    )
      return session;
  }
  const correct =
    selectedOrderOptionIds && canonicalOrder
      ? selectedOrderOptionIds.every(
          (optionId, index) => optionId === canonicalOrder[index],
        )
      : selectedOptionId === question.correctOptionId;
  const answer: JlptAnswer = {
    questionId: question.id,
    selectedOptionId,
    ...(selectedOrderOptionIds
      ? { selectedOrderOptionIds: [...selectedOrderOptionIds] }
      : {}),
    correct,
    answeredAt: iso(now),
  };
  return {
    ...session,
    answers: [...session.answers, answer],
    updatedAt: iso(now),
  };
}

export function remainingSectionSeconds(
  session: JlptSession,
  now = new Date(),
) {
  if (session.mode !== "mock") return null;
  if (session.status === "paused")
    return Math.max(0, session.remainingSeconds ?? 0);
  if (!session.deadlineAt) return Math.max(0, session.remainingSeconds ?? 0);
  return Math.max(
    0,
    Math.ceil((new Date(session.deadlineAt).getTime() - now.getTime()) / 1000),
  );
}

export function advanceJlptSession(
  session: JlptSession,
  now = new Date(),
): JlptSession {
  if (session.status !== "active") return session;
  const questionIds =
    session.sectionQuestionIds[session.currentSectionIndex] ?? [];
  const currentId = currentJlptQuestionId(session);
  if (currentId && !answerForQuestion(session, currentId)) return session;
  if (session.currentQuestionIndex < questionIds.length - 1) {
    return {
      ...session,
      currentQuestionIndex: session.currentQuestionIndex + 1,
      updatedAt: iso(now),
    };
  }
  const hasNextSection =
    session.currentSectionIndex < session.sectionQuestionIds.length - 1;
  return {
    ...session,
    status: hasNextSection ? "section-complete" : "complete",
    deadlineAt: null,
    remainingSeconds: hasNextSection ? 0 : session.remainingSeconds,
    updatedAt: iso(now),
  };
}

export function expireJlptSection(
  session: JlptSession,
  now = new Date(),
): JlptSession {
  if (session.status !== "active" || session.mode !== "mock") return session;
  const hasNextSection =
    session.currentSectionIndex < session.sectionQuestionIds.length - 1;
  return {
    ...session,
    status: hasNextSection ? "section-complete" : "complete",
    deadlineAt: null,
    remainingSeconds: 0,
    updatedAt: iso(now),
  };
}

export function startNextJlptSection(
  session: JlptSession,
  now = new Date(),
): JlptSession {
  if (session.status !== "section-complete") return session;
  const nextSectionIndex = session.currentSectionIndex + 1;
  const durationSeconds =
    JLPT_MOCK_STRUCTURES[session.level].sections[nextSectionIndex]
      ?.durationMinutes * 60;
  if (!durationSeconds)
    return {
      ...session,
      status: "complete",
      deadlineAt: null,
      updatedAt: iso(now),
    };
  return {
    ...session,
    status: "active",
    currentSectionIndex: nextSectionIndex,
    currentQuestionIndex: 0,
    remainingSeconds: durationSeconds,
    deadlineAt: iso(new Date(now.getTime() + durationSeconds * 1000)),
    updatedAt: iso(now),
  };
}

export function pauseJlptSession(
  session: JlptSession,
  now = new Date(),
): JlptSession {
  if (session.status !== "active") return session;
  return {
    ...session,
    status: "paused",
    remainingSeconds: remainingSectionSeconds(session, now),
    deadlineAt: null,
    updatedAt: iso(now),
  };
}

export function resumeJlptSession(
  session: JlptSession,
  now = new Date(),
): JlptSession {
  if (session.status !== "paused") return session;
  const remaining =
    session.mode === "mock" ? Math.max(1, session.remainingSeconds ?? 1) : null;
  return {
    ...session,
    status: "active",
    remainingSeconds: remaining,
    deadlineAt:
      remaining === null
        ? null
        : iso(new Date(now.getTime() + remaining * 1000)),
    updatedAt: iso(now),
  };
}

function performanceSlice(
  id: string,
  label: string,
  questionIds: readonly string[],
  answers: ReadonlyMap<string, JlptAnswer>,
): JlptPerformanceSlice {
  let correct = 0;
  for (const questionId of questionIds)
    if (answers.get(questionId)?.correct) correct += 1;
  const total = questionIds.length;
  return {
    id,
    label,
    correct,
    total,
    percent: total ? Math.round((correct / total) * 100) : 0,
  };
}

export function scoreJlptSession(
  session: JlptSession,
  questions: readonly JlptQuestion[],
): JlptSessionResult {
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const answers = new Map(
    session.answers.map((answer) => [answer.questionId, answer]),
  );
  const questionIds = session.sectionQuestionIds.flat();
  const usedQuestions = questionIds
    .map((id) => questionById.get(id))
    .filter((question): question is JlptQuestion => Boolean(question));
  const skillIds = [
    "kanji",
    "vocabulary",
    "grammar",
    "reading",
    "listening",
  ] as const;
  const bySkill = skillIds
    .map((skill) =>
      performanceSlice(
        skill,
        SKILL_LABELS[skill],
        usedQuestions
          .filter((question) => question.skill === skill)
          .map((question) => question.id),
        answers,
      ),
    )
    .filter((slice) => slice.total > 0);
  const byType = [
    ...new Set(usedQuestions.map((question) => question.officialType)),
  ].map((type) =>
    performanceSlice(
      type,
      OFFICIAL_TYPE_LABELS[type],
      usedQuestions
        .filter((question) => question.officialType === type)
        .map((question) => question.id),
      answers,
    ),
  );
  const structure = JLPT_MOCK_STRUCTURES[session.level];
  const byScoringSection = structure.scoringSections
    .map((section) =>
      performanceSlice(
        section.id,
        section.title,
        usedQuestions
          .filter((question) => section.skills.includes(question.skill))
          .map((question) => question.id),
        answers,
      ),
    )
    .filter((slice) => slice.total > 0);
  const ranked = bySkill
    .filter((slice) => slice.total > 0)
    .sort(
      (left, right) => right.percent - left.percent || right.total - left.total,
    );
  const correct = questionIds.reduce(
    (total, id) => total + (answers.get(id)?.correct ? 1 : 0),
    0,
  );
  return {
    correct,
    total: questionIds.length,
    percent: questionIds.length
      ? Math.round((correct / questionIds.length) * 100)
      : 0,
    bySkill,
    byType,
    byScoringSection,
    strongest: ranked[0] ?? null,
    weakest: ranked.at(-1) ?? null,
    missedQuestionIds: questionIds.filter((id) => !answers.get(id)?.correct),
  };
}

export function waniKaniKanjiInsight(
  session: JlptSession,
  questions: readonly JlptQuestion[],
  guruKanji: ReadonlySet<string>,
) {
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const relevant = session.sectionQuestionIds
    .flat()
    .map((id) => questionById.get(id))
    .filter((question): question is JlptQuestion =>
      Boolean(question?.relatedKanji?.length),
    );
  const tested = new Set(
    relevant.flatMap((question) => question.relatedKanji ?? []),
  );
  const known = [...tested].filter((kanji) => guruKanji.has(kanji));
  const kanjiAnswers = relevant
    .filter((question) => question.skill === "kanji")
    .map((question) =>
      session.answers.find((answer) => answer.questionId === question.id),
    )
    .filter((answer): answer is JlptAnswer => Boolean(answer));
  const correct = kanjiAnswers.filter((answer) => answer.correct).length;
  return {
    tested: tested.size,
    guru: known.length,
    quizPercent: kanjiAnswers.length
      ? Math.round((correct / kanjiAnswers.length) * 100)
      : null,
  };
}
