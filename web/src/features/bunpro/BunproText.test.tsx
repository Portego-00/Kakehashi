import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { BunproText } from "./BunproText";

afterEach(cleanup);

it("highlights the current grammar point while keeping related grammar references neutral", () => {
  render(<BunproText grammarId="416" value={'<p><span data-gp-id="416">て</span> connects a <span data-gp-id="12" class="gp-popout">る-Verb</span>.</p><section class="caution"><h4>Caution</h4><p>Irregular verbs.</p></section>'} />);
  expect(screen.getByText("て")).toHaveAttribute("data-bunpro-accent", "true");
  expect(screen.getByText("る-Verb")).not.toHaveAttribute("data-bunpro-accent");
  expect(screen.getByRole("heading", { name: "Caution" }).parentElement).toHaveAttribute("data-bunpro-caution-section", "true");
});

it("keeps grammar references neutral and distinguishes exceptions from replacement endings", () => {
  const { container } = render(<BunproText value={'<span class="gp-popout">［る<sup>1</sup>］Verb</span> ￫ 見<del>る</del> + <strong>て</strong><br>Exceptions:<br><span class="gp-popout">する</span> ￫ <span class="chui" style="display:none" onclick="alert(1)">して</span>'} />);
  expect(screen.getByText("Verb", { exact: false })).not.toHaveAttribute("data-bunpro-accent");
  expect(screen.getByText("する")).not.toHaveAttribute("data-bunpro-accent");
  expect(container.querySelector("sup")).toHaveTextContent("1");
  expect(screen.getByText("して")).toHaveAttribute("data-bunpro-caution", "true");
  expect(screen.getByText("して")).not.toHaveAttribute("style");
  expect(screen.getByText("して")).not.toHaveAttribute("onclick");
});

it("preserves hover-only furigana without copying arbitrary provider classes", () => {
  const { container } = render(<BunproText value={'<ruby>見<rt class="bp-js-hide-furi unrelated">み</rt></ruby><ruby>請<rt>こ</rt></ruby><span class="not-chui not-gp-popout">neutral</span>'} />);
  expect(container.querySelector("rt")).toHaveAttribute("data-bunpro-furigana", "hover");
  expect(container.querySelectorAll("rt")[1]).not.toHaveAttribute("data-bunpro-furigana");
  expect(screen.getByText("neutral")).not.toHaveAttribute("data-bunpro-accent");
  expect(container.querySelector("[class]")).toBeNull();
});

it("preserves crossed-out verb endings alongside furigana and replacement endings", () => {
  const { container } = render(<BunproText value={'<ruby>座<rp>(</rp><rt>すわ</rt><rp>)</rp></ruby><del>る</del> + <span class="chui">ら</span><strong>なかった</strong>'} />);
  expect(screen.getByText("る").tagName).toBe("DEL");
  expect(container.querySelector("ruby rt")).toHaveTextContent("すわ");
  expect(screen.getByText("ら")).toHaveAttribute("data-bunpro-caution", "true");
  expect(screen.getByText("なかった").tagName).toBe("STRONG");
});

it.each(["del", "s", "strike"])("preserves %s formatting without copying unsafe attributes", (tag) => {
  const { container } = render(<BunproText value={`<${tag} onclick="alert(1)" style="display:none" class="provider-style">る<script>alert(1)</script></${tag}>`} />);
  const ending = screen.getByText("る");
  expect(ending.tagName).toBe(tag.toUpperCase());
  expect(ending.attributes).toHaveLength(0);
  expect(container.querySelector("script")).toBeNull();
});
