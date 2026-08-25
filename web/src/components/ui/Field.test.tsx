import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./Field";

describe("Field state feedback", () => {
  it.each([
    ["loading", { loading: true }],
    ["error", { error: "Invalid token" }],
    ["success", { success: "Connected" }],
  ] as const)("marks the %s icon for motion styling", (state, props) => {
    const { container } = render(<Field label="API token" {...props} />);
    expect(container.querySelector(`[data-state="${state}"]`)).toBeInTheDocument();
  });
});
