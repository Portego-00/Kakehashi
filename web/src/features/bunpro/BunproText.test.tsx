import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { BunproText } from "./BunproText";

afterEach(cleanup);

it("preserves crossed-out verb endings alongside furigana and replacement endings", () => {
  const { container } = render(<BunproText value={'<ruby>座<rp>(</rp><rt>すわ</rt><rp>)</rp></ruby><del>る</del> + <span class="chui">ら</span><strong>なかった</strong>'} />);
  expect(screen.getByText("る").tagName).toBe("DEL");
  expect(container.querySelector("ruby rt")).toHaveTextContent("すわ");
  expect(screen.getByText("ら")).toHaveAttribute("data-bunpro-accent", "true");
  expect(screen.getByText("なかった").tagName).toBe("STRONG");
});

it.each(["del", "s", "strike"])("preserves %s formatting without copying unsafe attributes", (tag) => {
  const { container } = render(<BunproText value={`<${tag} onclick="alert(1)" style="display:none" class="provider-style">る<script>alert(1)</script></${tag}>`} />);
  const ending = screen.getByText("る");
  expect(ending.tagName).toBe(tag.toUpperCase());
  expect(ending.attributes).toHaveLength(0);
  expect(container.querySelector("script")).toBeNull();
});
