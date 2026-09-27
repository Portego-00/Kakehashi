import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommunityMarkdown } from "./CommunityMarkdown";

describe("community Markdown regressions", () => {
  it("renders balanced image URLs without truncating them", () => {
    render(<CommunityMarkdown>{'![Screenshot](https://example.com/screenshot(1).png "Screenshot")'}</CommunityMarkdown>);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/screenshot(1).png");
  });
  it("routes native HEIC attachments through a browser-compatible image endpoint", () => {
    render(<CommunityMarkdown>{"![Image](https://zcvoxqcvobgvcwcrqytz.supabase.co/storage/v1/object/public/issue-media/issues/image/example.heic)"}</CommunityMarkdown>);
    expect(screen.getByRole("img")).toHaveAttribute("src", expect.stringContaining("/community/media?url="));
  });
  it("renders ordered lists, emphasis and fenced code", () => {
    render(<CommunityMarkdown>{"1. *First*\n2. Second\n\n```js\nconst x = 1;\n```"}</CommunityMarkdown>);
    expect(screen.getByRole("list").tagName).toBe("OL");
    expect(screen.getByText("First").tagName).toBe("EM");
    expect(screen.getByText("const x = 1;").parentElement?.tagName).toBe("PRE");
  });
});
