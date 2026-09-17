import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import { SrsProgressionSlot } from "./SrsProgressionSlot";

const motionState = vi.hoisted(() => ({ reduced: false, props: {} as Record<string, unknown> }));

vi.mock("motion/react", () => ({
  useReducedMotion: () => motionState.reduced,
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    aside: ({ initial, animate, exit, ...props }: ComponentProps<"aside"> & Record<string, unknown>) => {
      motionState.props = { initial, animate, exit };
      return <aside {...props} />;
    },
  },
}));

afterEach(cleanup);

describe("SRS progression motion", () => {
  it.each([true, false])("respects reduced motion (%s) for entrance and exit", (reduced) => {
    motionState.reduced = reduced;
    render(<SrsProgressionSlot mode="normal" progression={{ startingStage: 3, endingStage: 4, nextReviewInterval: "1 day", isCorrect: true }} />);

    expect(screen.getByRole("status", { name: "SRS progression" })).toHaveTextContent("SRS up");
    expect(motionState.props.initial).toEqual({ opacity: 0, y: reduced ? 0 : 6 });
    expect(motionState.props.animate).toMatchObject({ opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.28 } });
    expect(motionState.props.exit).toMatchObject({ opacity: 0, y: reduced ? 0 : -4, transition: { duration: reduced ? 0 : 0.2 } });
  });
});
