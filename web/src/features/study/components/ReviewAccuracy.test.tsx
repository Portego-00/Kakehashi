import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewAccuracy, coreAccuracy } from "./ReviewAccuracy";
describe("review accuracy", () => {
  it("includes answered halves and does not count retries again", () => {
    expect(coreAccuracy({ 1: ["reading"], 2: ["meaning"] }, { 1: { reading: 2, meaning: 0 } }, { id: 1, kinds: ["reading"], correct: true })).toEqual({ correct: 1, answered: 2 });
  });
  it("updates immediately on a graded answer and counts both Anki halves", () => {
    expect(coreAccuracy({}, {}, { id: 1, kinds: ["reading", "meaning"], correct: true })).toEqual({ correct: 2, answered: 2 });
    expect(coreAccuracy({}, { 1: { meaning: 1, reading: 0 } }, { id: 1, kinds: ["meaning"], correct: false })).toEqual({ correct: 0, answered: 1 });
  });
  it("starts with a neutral value and exposes the exact count", () => {
    const view = render(<ReviewAccuracy correct={0} answered={0} />);
    expect(screen.getByLabelText("Accuracy: no answers yet")).toBeInTheDocument();
    view.rerender(<ReviewAccuracy correct={2} answered={3} />);
    expect(screen.getByLabelText("Accuracy: 67%, 2 of 3 answers correct on the first attempt")).toBeInTheDocument();
  });
});
