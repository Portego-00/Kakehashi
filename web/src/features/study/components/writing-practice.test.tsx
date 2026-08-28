import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { getModeDefaultFilters } from "../mode-config";
import { evaluateFreehandDrawing, loadKanjiStrokeData, type KanjiStrokeData } from "../stroke-data";
import type { StudyDataset } from "../types";

const { strokeData } = vi.hoisted(() => ({
  strokeData: {
    strokes: ["M512,368C608,378 744,389 882,368C910,364 934,385 916,404C892,428 853,452 832,458C819,462 803,463 782,458C732,448 674,438 512,420C354,404 207,396 120,393C109,393 99,386 100,376C100,358 123,340 145,329C179,312 206,323 240,329C336,348 430,361 512,368Z"],
    medians: [[[106, 379], [202, 359], [795, 419], [918, 393]]],
  },
}));

vi.mock("../stroke-data", async (importOriginal) => {
  const original = await importOriginal<typeof import("../stroke-data")>();
  return {
    ...original,
    evaluateFreehandDrawing: vi.fn(original.evaluateFreehandDrawing),
    loadKanjiStrokeData: vi.fn(async () => strokeData),
  };
});

vi.mock("../engine", async (importOriginal) => {
  const original = await importOriginal<typeof import("../engine")>();
  return { ...original, shuffle: <T,>(values: T[]) => [...values] };
});

import { WritingPractice } from "./special-modes";

const subject: Subject = {
  id: 2,
  object: "kanji",
  url: "",
  data_updated_at: "2026-08-06T20:00:00.000Z",
  data: {
    level: 1,
    created_at: "2026-08-06T20:00:00.000Z",
    slug: "一",
    document_url: "https://www.wanikani.com/kanji/%E4%B8%80",
    hidden_at: null,
    characters: "一",
    meanings: [{ meaning: "One", primary: true, accepted_answer: true }],
    auxiliary_meanings: [],
    readings: [{ reading: "いち", primary: true, accepted_answer: true, type: "onyomi" }],
    component_subject_ids: [],
    amalgamation_subject_ids: [],
    visually_similar_subject_ids: [],
  },
};

const assignment: Assignment = {
  id: 102,
  object: "assignment",
  url: "",
  data_updated_at: "2026-08-06T20:00:00.000Z",
  data: {
    subject_id: subject.id,
    subject_type: "kanji",
    srs_stage: 2,
    available_at: null,
    started_at: "2026-08-06T20:00:00.000Z",
    unlocked_at: "2026-08-06T20:00:00.000Z",
    passed_at: null,
    burned_at: null,
    resurrected_at: null,
    hidden: false,
    created_at: "2026-08-06T20:00:00.000Z",
  },
};

const secondSubject: Subject = {
  ...subject,
  id: 3,
  data: {
    ...subject.data,
    slug: "二",
    characters: "二",
    document_url: "https://www.wanikani.com/kanji/%E4%BA%8C",
    meanings: [{ meaning: "Two", primary: true, accepted_answer: true }],
    readings: [{ reading: "に", primary: true, accepted_answer: true, type: "onyomi" }],
  },
};

const secondAssignment: Assignment = {
  ...assignment,
  id: 103,
  data: { ...assignment.data, subject_id: secondSubject.id },
};

const threeSubject: Subject = {
  ...subject,
  id: 4,
  data: {
    ...subject.data,
    slug: "三",
    characters: "三",
    document_url: "https://www.wanikani.com/kanji/%E4%B8%89",
    meanings: [{ meaning: "Three", primary: true, accepted_answer: true }],
    readings: [{ reading: "さん", primary: true, accepted_answer: true, type: "onyomi" }],
  },
};

const threeAssignment: Assignment = {
  ...assignment,
  id: 104,
  data: { ...assignment.data, subject_id: threeSubject.id },
};

const threeStrokeData: KanjiStrokeData = {
  strokes: [
    "M298,665C269,663 262,651 284,638C304,626 324,620 346,618C384,616 542,647 651,661C687,666 709,673 715,678C739,703 692,718 679,722C656,729 608,718 541,701C447,679 360,670 298,665Z",
    "M313,411C295,409 293,395 316,382C334,372 357,367 379,371C476,386 572,398 665,406C689,409 697,418 689,430C679,446 660,457 637,462C605,470 537,448 313,411Z",
    "M106,119C129,95 164,84 196,90C407,136 691,148 787,142C821,140 903,120 919,147C931,170 892,192 876,202C842,224 812,231 787,226C661,203 466,175 135,147C99,144 88,138 106,119Z",
  ],
  medians: [
    [[276, 655], [368, 645], [717, 692]],
    [[303, 402], [687, 425]],
    [[109, 132], [195, 121], [791, 185], [917, 162]],
  ],
};

const dataset: StudyDataset = { subjects: [subject], assignments: [assignment] };

function prepareCanvas(canvas: SVGSVGElement) {
  Object.defineProperties(canvas, {
    getBoundingClientRect: {
      configurable: true,
      value: () => ({ bottom: 1024, height: 1024, left: 0, right: 1024, top: 0, width: 1024, x: 0, y: 0, toJSON: () => ({}) }),
    },
    setPointerCapture: { configurable: true, value: vi.fn() },
  });
}

function drawStroke(canvas: SVGSVGElement, points: Array<{ x: number; y: number }>) {
  const [first, ...rest] = points;
  fireEvent.pointerDown(canvas, { clientX: first.x, clientY: first.y, isPrimary: true, pointerId: 1 });
  rest.slice(0, -1).forEach((item) => fireEvent.pointerMove(canvas, { clientX: item.x, clientY: item.y, isPrimary: true, pointerId: 1 }));
  const last = rest.at(-1) ?? first;
  fireEvent.pointerUp(canvas, { clientX: last.x, clientY: last.y, isPrimary: true, pointerId: 1 });
}

function drawOne(canvas: SVGSVGElement) {
  drawStroke(canvas, [{ x: 106, y: 521 }, { x: 202, y: 541 }, { x: 795, y: 481 }, { x: 918, y: 507 }]);
}

function drawOneBackwards(canvas: SVGSVGElement) {
  drawStroke(canvas, [{ x: 918, y: 507 }, { x: 795, y: 481 }, { x: 202, y: 541 }, { x: 106, y: 521 }]);
}

const guidedTransform = {
  offsetX: 68.2666667,
  offsetY: 848.2666667,
  scale: 0.8666667,
};

function rawStrokePoint([x, y]: number[]) {
  return {
    x: guidedTransform.offsetX + guidedTransform.scale * x,
    y: guidedTransform.offsetY - guidedTransform.scale * y,
  };
}

async function guidedWriterSvg() {
  let writerSvg: SVGSVGElement | null = null;
  await waitFor(() => {
    writerSvg = document.querySelector("[data-hanzi-writer-target] svg");
    expect(writerSvg).toBeInTheDocument();
  });
  prepareCanvas(writerSvg!);
  return writerSvg!;
}

function drawGuidedStroke(canvas: SVGSVGElement, median: number[][], backwards = false) {
  const points = (backwards ? median.toReversed() : median).map(rawStrokePoint);
  const [first, ...rest] = points;
  fireEvent.mouseDown(canvas, { clientX: first.x, clientY: first.y });
  rest.forEach((item) => fireEvent.mouseMove(canvas, { clientX: item.x, clientY: item.y }));
  const last = rest.at(-1) ?? first;
  fireEvent.mouseUp(document, { clientX: last.x, clientY: last.y });
}

function drawGuidedTouchStroke(canvas: SVGSVGElement, median: number[][]) {
  const points = median.map(rawStrokePoint);
  const touch = ({ x, y }: { x: number; y: number }) => ({ clientX: x, clientY: y, identifier: 1, pageX: x, pageY: y, screenX: x, screenY: y, target: canvas });
  fireEvent.touchStart(canvas, { touches: [touch(points[0])] });
  points.slice(1).forEach((item) => fireEvent.touchMove(canvas, { touches: [touch(item)] }));
  fireEvent.touchEnd(document, { changedTouches: [touch(points.at(-1)!)], touches: [] });
}

function renderWritingPractice(writingMode: "guided" | "freehand", strokeLeniency = 1.5) {
  return render(
    <WritingPractice
      dataset={dataset}
      filters={{ ...getModeDefaultFilters("kanji-writing", 1), count: 1, strokeLeniency, writingMode }}
      scope={`writing-repro-${writingMode}`}
      onExit={vi.fn()}
    />,
  );
}

describe("kanji writing mobile parity", () => {
  beforeEach(() => {
    vi.mocked(loadKanjiStrokeData).mockReset();
    vi.mocked(loadKanjiStrokeData).mockResolvedValue(strokeData);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("keeps the active kanji stable while the study dataset refreshes", async () => {
    let resolveStrokeData: ((data: KanjiStrokeData) => void) | undefined;
    vi.mocked(loadKanjiStrokeData).mockImplementationOnce(() => new Promise((resolve) => {
      resolveStrokeData = resolve;
    }));
    const filters = { ...getModeDefaultFilters("kanji-writing", 1), count: 2, writingMode: "freehand" as const };
    const firstDataset: StudyDataset = {
      subjects: [subject, secondSubject],
      assignments: [assignment, secondAssignment],
    };
    const refreshedDataset: StudyDataset = {
      subjects: [secondSubject, subject],
      assignments: [secondAssignment, assignment],
    };
    const view = render(
      <WritingPractice dataset={firstDataset} filters={filters} scope="writing-refresh" onExit={vi.fn()} />,
    );

    await waitFor(() => expect(loadKanjiStrokeData).toHaveBeenCalledWith("一"));
    view.rerender(
      <WritingPractice dataset={refreshedDataset} filters={filters} scope="writing-refresh" onExit={vi.fn()} />,
    );

    expect(screen.getByRole("img", { name: /Drawing area for One/ })).toBeVisible();
    expect(loadKanjiStrokeData).toHaveBeenCalledTimes(1);

    resolveStrokeData?.(strokeData);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("submit it for grading"));
  });

  it("still receives and renders pointer strokes", async () => {
    renderWritingPractice("freehand");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("submit it for grading"));
    const canvas = screen.getByRole("img", { name: /Drawing area for One/ }) as unknown as SVGSVGElement;
    prepareCanvas(canvas);
    drawOne(canvas);

    expect(canvas.querySelectorAll("polyline")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Clear" })).toBeEnabled();
  });

  it("keeps captured pointer coordinates inside the writing canvas", async () => {
    renderWritingPractice("freehand");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("submit it for grading"));
    const canvas = screen.getByRole("img", { name: /Drawing area for One/ }) as unknown as SVGSVGElement;
    prepareCanvas(canvas);

    drawStroke(canvas, [{ x: -20, y: 200 }, { x: 1100, y: 200 }]);

    expect(canvas.querySelector("polyline")).toHaveAttribute("points", "0,200 1024,200");
  });

  it("submits and grades a freehand drawing like the mobile app", async () => {
    renderWritingPractice("freehand");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("submit it for grading"));
    const canvas = screen.getByRole("img", { name: /Drawing area for One/ }) as unknown as SVGSVGElement;
    prepareCanvas(canvas);
    drawOne(canvas);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("status")).toHaveTextContent(/Correct|Incorrect/);
    expect(screen.getByText(/Similarity \d+%/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Replay correct" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Redraw" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("You recalled 1 of 1 kanji.")).toBeVisible();
  });

  it("uses the configured strictness for freehand grading", async () => {
    renderWritingPractice("freehand", 0.8);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("submit it for grading"));
    const canvas = screen.getByRole("img", { name: /Drawing area for One/ }) as unknown as SVGSVGElement;
    prepareCanvas(canvas);
    drawOne(canvas);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(evaluateFreehandDrawing).toHaveBeenLastCalledWith(expect.any(Array), strokeData, 0.8);
  });

  it.each(["guided", "freehand"] as const)("toggles the mobile grid control in %s mode", async (writingMode) => {
    renderWritingPractice(writingMode);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(writingMode === "guided" ? "Stroke 1 of 1" : "submit it for grading"));
    const canvas = screen.getByRole("img", { name: /Drawing area for One/ }) as unknown as HTMLElement;
    const gridPath = 'path[d="M512 0V1024M0 512H1024M0 0L1024 1024M1024 0L0 1024"]';
    const gridButton = screen.getByRole("button", { name: "Grid" });

    expect(gridButton).toHaveAttribute("aria-pressed", "true");
    expect(canvas.querySelector(gridPath)).toBeInTheDocument();

    fireEvent.click(gridButton);

    expect(gridButton).toHaveAttribute("aria-pressed", "false");
    expect(canvas.querySelector(gridPath)).not.toBeInTheDocument();
  });

  it("rejects backwards freehand writing and lets the learner retry", async () => {
    renderWritingPractice("freehand");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("submit it for grading"));
    const canvas = screen.getByRole("img", { name: /Drawing area for One/ }) as unknown as SVGSVGElement;
    prepareCanvas(canvas);
    drawOneBackwards(canvas);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByRole("status")).toHaveTextContent("Incorrect");
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("status")).toHaveTextContent("submit it for grading");
    expect(canvas.querySelectorAll("polyline")).toHaveLength(0);
  });

  it("counts guided misses once, reveals a hint after three, and advances only after completion", async () => {
    renderWritingPractice("guided");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stroke 1 of 1"));
    const canvas = screen.getByRole("img", { name: /Drawing area for One/ });
    const writerSvg = await guidedWriterSvg();

    drawGuidedStroke(writerSvg, strokeData.medians[0], true);
    drawGuidedStroke(writerSvg, strokeData.medians[0], true);
    drawGuidedStroke(writerSvg, strokeData.medians[0], true);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("The next stroke is highlighted"));
    expect(canvas.querySelector("[data-hanzi-writer-target] path")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    drawGuidedTouchStroke(writerSvg, strokeData.medians[0]);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Complete · 1 mistake"));
    expect(screen.getByRole("button", { name: "Replay" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("You recalled 0 of 1 kanji.")).toBeVisible();
  });

  it("renders the mobile source stroke path for the guided outline", async () => {
    renderWritingPractice("guided");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stroke 1 of 1"));
    const canvas = screen.getByRole("img", { name: /Drawing area for One/ }) as unknown as SVGSVGElement;

    fireEvent.click(screen.getByRole("button", { name: "Show outline" }));

    expect(canvas.querySelector(`path[d="${strokeData.strokes[0]}"]`)).toBeInTheDocument();
    expect(canvas.querySelector(`path[d="${strokeData.strokes[0]}"]`)?.closest("g"))
      .toHaveAttribute("transform", "translate(68.2666667 848.2666667) scale(0.8666667 -0.8666667)");
  });

  it("uses the same source stroke path for the freehand outline", async () => {
    renderWritingPractice("freehand");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("submit it for grading"));
    const canvas = screen.getByRole("img", { name: /Drawing area for One/ }) as unknown as SVGSVGElement;

    fireEvent.click(screen.getByRole("button", { name: "Show outline" }));

    const sourcePath = canvas.querySelector(`path[d="${strokeData.strokes[0]}"]`);
    expect(sourcePath).toBeInTheDocument();
    expect(sourcePath?.closest("g"))
      .toHaveAttribute("transform", "translate(68.2666667 848.2666667) scale(0.8666667 -0.8666667)");
  });

  it("rejects a later stroke while the first stroke is expected", async () => {
    vi.mocked(loadKanjiStrokeData).mockResolvedValueOnce(threeStrokeData);
    render(
      <WritingPractice
        dataset={{ subjects: [threeSubject], assignments: [threeAssignment] }}
        filters={{ ...getModeDefaultFilters("kanji-writing", 1), count: 1, writingMode: "guided" }}
        scope="writing-guided-later-stroke"
        onExit={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stroke 1 of 3"));
    const writerSvg = await guidedWriterSvg();

    drawGuidedStroke(writerSvg, threeStrokeData.medians[1]);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stroke 1 of 3 · Try that stroke again"));
    expect(screen.queryByText(/Stroke 2 of 3/)).not.toBeInTheDocument();

    drawGuidedStroke(writerSvg, threeStrokeData.medians[0]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stroke 2 of 3"));
  });

  it("locks replay, then restarts the guided quiz cleanly", async () => {
    renderWritingPractice("guided");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stroke 1 of 1"));
    const writerSvg = await guidedWriterSvg();
    drawGuidedStroke(writerSvg, strokeData.medians[0]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Complete · no mistakes"));

    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(screen.getByRole("button", { name: "Replaying…" })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Replay" })).toBeEnabled(), { timeout: 3_000 });

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Hint" })).toBeEnabled());
    expect(screen.getByRole("status")).toHaveTextContent("Stroke 1 of 1 · Draw the first stroke");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    drawGuidedStroke(await guidedWriterSvg(), strokeData.medians[0]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Complete · no mistakes"));
  });

  it("keeps guided writing active when advancing to the next character", async () => {
    render(
      <WritingPractice
        dataset={{ subjects: [subject, secondSubject], assignments: [assignment, secondAssignment] }}
        filters={{ ...getModeDefaultFilters("kanji-writing", 1), count: 2, writingMode: "guided" }}
        scope="writing-guided-next-character"
        onExit={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stroke 1 of 1"));
    drawGuidedStroke(await guidedWriterSvg(), strokeData.medians[0]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(screen.getByRole("img", { name: /Drawing area for Two/ })).toBeVisible());
    await waitFor(() => expect(screen.getByRole("button", { name: "Hint" })).toBeEnabled());
    drawGuidedStroke(await guidedWriterSvg(), strokeData.medians[0]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Complete · no mistakes"));
  });

  it("removes the guided writer's document listeners on teardown", async () => {
    const addEventListener = vi.spyOn(document, "addEventListener");
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    const view = renderWritingPractice("guided");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Stroke 1 of 1"));
    const endListeners = addEventListener.mock.calls.filter(([type]) => type === "mouseup" || type === "touchend");
    expect(endListeners).toHaveLength(2);

    view.unmount();

    endListeners.forEach(([type, listener, options]) => {
      expect(removeEventListener).toHaveBeenCalledWith(type, listener, options);
    });
    addEventListener.mockRestore();
    removeEventListener.mockRestore();
  });
});
