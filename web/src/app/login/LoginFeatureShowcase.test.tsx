import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoginFeatureShowcase } from "./LoginFeatureShowcase";

describe("LoginFeatureShowcase", () => {
  it("renders no legacy feature media or timed preview", () => {
    const { container } = render(<LoginFeatureShowcase />);

    expect(container).toBeEmptyDOMElement();
  });
});
