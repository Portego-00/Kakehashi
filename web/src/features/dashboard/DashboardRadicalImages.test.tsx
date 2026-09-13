import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { SubjectRows } from "./Dashboard";
import { DashboardLevelWidget } from "./DashboardNativeWidgets";
import { levelWidgetSubjects, recentUnlockRows } from "./dashboard-data";

function imageRadical(): Subject {
  return {
    id: 876,
    object: "radical",
    url: "https://api.wanikani.com/v2/subjects/876",
    data_updated_at: "2026-08-25T00:00:00Z",
    data: {
      level: 4,
      created_at: "2026-08-01T00:00:00Z",
      slug: "rib-cage",
      document_url: "https://www.wanikani.com/radicals/rib-cage",
      hidden_at: null,
      characters: null,
      character_images: [
        { url: "https://files.wanikani.com/rib-cage-256.png", content_type: "image/png", metadata: { dimensions: "256x256" } },
        { url: "https://files.wanikani.com/rib-cage.svg", content_type: "image/svg+xml" },
      ],
      meanings: [{ meaning: "Rib Cage", primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
    },
  };
}

function assignment(): Assignment {
  return {
    id: 123,
    object: "assignment",
    url: "",
    data_updated_at: "2026-08-25T00:00:00Z",
    data: {
      subject_id: 876,
      subject_type: "radical",
      srs_stage: 2,
      available_at: null,
      started_at: "2026-08-20T00:00:00Z",
      unlocked_at: "2026-08-19T00:00:00Z",
      passed_at: null,
      burned_at: null,
      resurrected_at: null,
      hidden: false,
      created_at: "2026-08-19T00:00:00Z",
    },
  };
}

describe("dashboard radical artwork", () => {
  it("keeps the full subject on flattened current-level rows and renders its SVG", () => {
    const radical = imageRadical();
    const rows = levelWidgetSubjects([radical], [assignment()]);

    expect(rows[0].subject).toBe(radical);
    render(<DashboardLevelWidget
      currentLevel={4}
      progress={{ radical: { passed: 0, total: 1 }, kanji: { passed: 0, total: 0 }, vocabulary: { passed: 0, total: 0 } }}
      subjects={rows}
    />);

    expect(screen.getByRole("img", { name: "Rib Cage radical" })).toHaveAttribute("src", "https://files.wanikani.com/rib-cage.svg");
    expect(screen.queryByText("Ri")).not.toBeInTheDocument();
  });

  it("keeps the full subject on recent-item rows and renders its SVG", () => {
    const radical = imageRadical();
    const rows = recentUnlockRows([assignment()], [radical]);

    expect(rows[0].subject).toBe(radical);
    render(<SubjectRows items={rows} empty="No subjects" />);

    expect(screen.getByRole("img", { name: "Rib Cage radical" })).toHaveAttribute("src", "https://files.wanikani.com/rib-cage.svg");
    expect(screen.queryByText("Rib Cage", { selector: '[class*="subjectGlyph"]' })).not.toBeInTheDocument();
  });
});
