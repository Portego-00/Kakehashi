import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsWorkspace } from "./SettingsWorkspace";

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { data: { username: "Tester" } } }),
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: "light", resolvedTheme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/features/anime/AnimePicker", () => ({ AnimePicker: () => null }));
vi.mock("@/features/dashboard/DashboardWidgetPreview", () => ({ DashboardWidgetPreview: ({ id }: { id: string }) => <div data-widget-preview={id} /> }));

function dataTransfer() {
  const values = new Map<string, string>();
  return {
    effectAllowed: "none",
    getData: (type: string) => values.get(type) ?? "",
    setData: (type: string, value: string) => { values.set(type, value); },
  } as unknown as DataTransfer;
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

function fireDrag(element: HTMLElement, type: "dragover" | "drop", clientX: number, clientY: number, transfer: DataTransfer) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { clientX: { value: clientX }, clientY: { value: clientY }, dataTransfer: { value: transfer } });
  fireEvent(element, event);
}

describe("dashboard layout drag targets", () => {
  beforeEach(() => window.localStorage.clear());

  async function renderLayout() {
    const { container } = render(<SettingsWorkspace />);
    const list = await screen.findByRole("list", { name: "Visible dashboard sections" });
    await waitFor(() => expect(list.querySelectorAll(":scope > li")).toHaveLength(6));

    vi.spyOn(list, "getBoundingClientRect").mockReturnValue(rect(0, 0, 1200, 600));
    const positions: Record<string, DOMRect> = {
      "daily-study": rect(0, 0, 1200, 90),
      srs: rect(0, 110, 790, 90),
      level: rect(0, 220, 790, 90),
      "extra-study": rect(0, 330, 1200, 90),
      forecast: rect(0, 440, 790, 90),
      "study-pulse": rect(810, 440, 390, 90),
    };
    Object.entries(positions).forEach(([id, bounds]) => {
      vi.spyOn(container.querySelector<HTMLElement>(`[data-editor-section="${id}"]`)!, "getBoundingClientRect").mockReturnValue(bounds);
    });
    return { container, list };
  }

  it("drops a widget into the open grid space beside another widget", async () => {
    const { container, list } = await renderLayout();
    const transfer = dataTransfer();
    const source = container.querySelector<HTMLElement>('[data-editor-section="study-pulse"]')!;
    fireEvent.dragStart(source, { dataTransfer: transfer });
    fireDrag(list, "dragover", 1000, 155, transfer);
    fireDrag(list, "drop", 1000, 155, transfer);

    expect([...list.querySelectorAll<HTMLElement>(":scope > li")].map((item) => item.dataset.editorSection)).toEqual([
      "daily-study",
      "srs",
      "study-pulse",
      "level",
      "extra-study",
      "forecast",
    ]);
    expect(container.querySelector('[data-editor-section="study-pulse"]')).not.toHaveAttribute("data-editor-row-start");
  });

  it("starts a new row when dropped in the gap between two rows", async () => {
    const { container, list } = await renderLayout();
    const transfer = dataTransfer();
    const source = container.querySelector<HTMLElement>('[data-editor-section="study-pulse"]')!;

    fireEvent.dragStart(source, { dataTransfer: transfer });
    fireDrag(list, "dragover", 600, 210, transfer);
    fireDrag(list, "drop", 600, 210, transfer);

    expect([...list.querySelectorAll<HTMLElement>(":scope > li")].map((item) => item.dataset.editorSection)).toEqual([
      "daily-study",
      "srs",
      "study-pulse",
      "level",
      "extra-study",
      "forecast",
    ]);
    expect(container.querySelector('[data-editor-section="study-pulse"]')).toHaveAttribute("data-editor-row-start", "true");
  });
});
