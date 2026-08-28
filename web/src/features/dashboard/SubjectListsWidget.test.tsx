import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SubjectList } from "@/features/subjects/lists";
import type { Subject } from "@/types/wanikani";
import { SubjectListsWidget } from "./SubjectListsWidget";

function subject(id: number, object: Subject["object"], characters: string | null, meaning: string): Subject {
  return {
    id,
    object,
    url: "",
    data_updated_at: "",
    data: {
      level: 1,
      created_at: "",
      slug: meaning.toLocaleLowerCase(),
      document_url: "",
      hidden_at: null,
      characters,
      meanings: [{ meaning, primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
    },
  };
}

function imageRadical(id: number, meaning: string): Subject {
  const value = subject(id, "radical", null, meaning);
  value.data.character_images = [
    { url: `https://files.wanikani.com/${id}-256.png`, content_type: "image/png", metadata: { dimensions: "256x256" } },
    { url: `https://files.wanikani.com/${id}.svg`, content_type: "image/svg+xml" },
  ];
  return value;
}

const lists: SubjectList[] = [{
  id: "core",
  name: "Core review",
  subjectIds: [1, 2, 3, 4, 5, 6],
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-25T00:00:00Z",
}, {
  id: "empty",
  name: "Next list",
  subjectIds: [],
  createdAt: "2026-08-02T00:00:00Z",
  updatedAt: "2026-08-25T00:00:00Z",
}];

describe("SubjectListsWidget", () => {
  it("previews list names and the first four mobile-style subject chips", () => {
    const { container } = render(<SubjectListsWidget
      lists={lists}
      subjects={[
        subject(1, "radical", null, "Ground"),
        subject(2, "kanji", "一", "One"),
        subject(3, "vocabulary", "一つ", "One thing"),
        subject(4, "kana_vocabulary", "ありがとう", "Thanks"),
      ]}
      syncing={false}
      syncError=""
    />);

    const manageLists = screen.getByRole("link", { name: "Manage subject lists" });
    expect(manageLists).toHaveAttribute("href", "/lists");
    expect(manageLists).toHaveAttribute("title", "Manage subject lists");
    expect(manageLists).not.toHaveTextContent("Manage lists");
    expect(manageLists.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector('[class*="summaryList"]')).toHaveTextContent("Lists2Saved subjects6");
    expect(container.querySelectorAll('[class*="subjectListsPreviewRow"]')).toHaveLength(2);
    expect(container.querySelector('[class*="subjectListsPreviewViewport"]')).toHaveAttribute("aria-hidden", "true");
    expect([...container.querySelectorAll('[data-subject-type]')].map((chip) => chip.textContent)).toEqual(["GR", "一", "一つ", "ありがとう"]);
    expect(container.querySelectorAll('[data-subject-type="vocabulary"]')).toHaveLength(2);
    expect(container.querySelector('[class*="subjectListsPreviewMore"]')).toHaveTextContent("+2");
  });

  it("keeps the existing sync loading and failure messages", () => {
    const { rerender } = render(<SubjectListsWidget lists={[]} subjects={[]} syncing syncError="" />);
    expect(screen.getByRole("heading", { name: "Subject lists" })).toBeInTheDocument();
    expect(screen.queryByText("Lists")).not.toBeInTheDocument();

    rerender(<SubjectListsWidget lists={[]} subjects={[]} syncing={false} syncError="offline" />);
    expect(screen.getByText("Saved locally; account sync is temporarily unavailable")).toBeInTheDocument();
  });

  it("uses radical artwork in list preview chips when WaniKani has no characters", () => {
    render(<SubjectListsWidget
      lists={[{ ...lists[0], subjectIds: [1] }]}
      subjects={[imageRadical(1, "Creeper")]}
      syncing={false}
      syncError=""
    />);

    expect(screen.getByRole("img", { name: "Creeper radical", hidden: true })).toHaveAttribute("src", "https://files.wanikani.com/1.svg");
    expect(screen.queryByText("CR")).not.toBeInTheDocument();
  });
});
