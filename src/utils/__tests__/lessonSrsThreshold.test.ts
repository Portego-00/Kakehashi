import {
  getLessonSrsThresholdStatus,
  normalizeLessonSrsThreshold,
} from "../lessonSrsThreshold";

const assignment = (srsStage: number, hidden = false) => ({
  data: { srs_stage: srsStage, hidden },
});

describe("lesson SRS thresholds", () => {
  it("counts apprentice and guru items from their SRS stages", () => {
    const status = getLessonSrsThresholdStatus(
      [
        assignment(1),
        assignment(4),
        assignment(5),
        assignment(6),
        assignment(7),
        assignment(3, true),
      ],
      100,
      500,
    );

    expect(status).toMatchObject({
      apprenticeCount: 2,
      guruCount: 2,
      apprenticeExceeded: false,
      guruExceeded: false,
      isBlocked: false,
    });
  });

  it("blocks only after a configured threshold is exceeded", () => {
    const atLimit = getLessonSrsThresholdStatus(
      [assignment(1), assignment(2)],
      2,
      0,
    );
    const overLimit = getLessonSrsThresholdStatus(
      [assignment(1), assignment(2), assignment(3)],
      2,
      0,
    );

    expect(atLimit.isBlocked).toBe(false);
    expect(overLimit).toMatchObject({
      apprenticeExceeded: true,
      guruExceeded: false,
      isBlocked: true,
    });
  });

  it("supports independent apprentice and guru limits", () => {
    const status = getLessonSrsThresholdStatus(
      [assignment(1), assignment(5), assignment(6)],
      10,
      1,
    );

    expect(status).toMatchObject({
      apprenticeExceeded: false,
      guruExceeded: true,
      isBlocked: true,
    });
  });

  it("treats zero as disabled and normalizes invalid values", () => {
    const status = getLessonSrsThresholdStatus(
      [assignment(1), assignment(5)],
      0,
      0,
    );

    expect(status.isBlocked).toBe(false);
    expect(normalizeLessonSrsThreshold(Number.NaN)).toBe(0);
    expect(normalizeLessonSrsThreshold(-5)).toBe(0);
    expect(normalizeLessonSrsThreshold(120.9)).toBe(120);
    expect(normalizeLessonSrsThreshold(10000)).toBe(9999);
  });
});
