import "@testing-library/jest-dom/vitest";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "./UserAvatar";

describe("UserAvatar", () => {
  it("keeps the Kakehashi mark when no Gravatar email is saved", () => {
    const { container } = render(<UserAvatar email="" />);
    expect(container.querySelector('img[src*="kakehashi-mark.png"]')).toBeInTheDocument();
    expect(container.querySelector('img[src*="gravatar.com"]')).not.toBeInTheDocument();
  });

  it("shows the Gravatar image and falls back when it cannot load", () => {
    const { container } = render(<UserAvatar email="MyEmailAddress@example.com" />);
    const gravatar = container.querySelector<HTMLImageElement>('img[src*="gravatar.com"]');
    expect(gravatar?.src).toContain("0bc83cb571cd1c50ba6f3e8a78ef1346");
    fireEvent.error(gravatar!);
    expect(container.querySelector('img[src*="gravatar.com"]')).not.toBeInTheDocument();
    expect(container.querySelector('img[src*="kakehashi-mark.png"]')).toBeInTheDocument();
  });
});
