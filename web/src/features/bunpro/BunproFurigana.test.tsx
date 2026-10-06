import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BunproFurigana } from "./BunproFurigana";
import { BunproText, RubyText } from "./BunproText";

afterEach(cleanup);

it("leaves furigana visible by default and outside the review setting", () => {
  const { container } = render(<RubyText text="学校（がっこう）" />);
  expect(container.querySelector("rt")).toHaveTextContent("がっこう");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(container.querySelector("[data-bunpro-review-furigana]")).toBeNull();
});

it("pins individual words and clears pins when the question changes or the setting is disabled", () => {
  function Content({ question = "one", hidden = true }) {
    return <BunproFurigana hidden={hidden} questionKey={question}><RubyText text="学校（がっこう）に行（い）く" /></BunproFurigana>;
  }
  const view = render(<Content />);
  const school = screen.getByRole("button", { name: "Furigana for 学校" });
  const go = screen.getByRole("button", { name: "Furigana for 行" });
  expect(school).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(school);
  expect(school).toHaveAttribute("aria-pressed", "true");
  expect(go).toHaveAttribute("aria-pressed", "false");
  view.rerender(<Content />);
  expect(school).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(school);
  expect(school).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(school);
  view.rerender(<Content question="two" />);
  expect(screen.getByRole("button", { name: "Furigana for 学校" })).toHaveAttribute("aria-pressed", "false");
  view.rerender(<Content hidden={false} />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  view.rerender(<Content />);
  expect(screen.getByRole("button", { name: "Furigana for 学校" })).toHaveAttribute("aria-pressed", "false");
});

it("supports keyboard pinning without firing review shortcuts, including provider HTML ruby", () => {
  const shortcut = vi.fn();
  render(<div onKeyDown={shortcut}><BunproFurigana hidden questionKey="one"><BunproText value={'<ruby>私<rp>(</rp><rt class="bp-js-hide-furi">わたし</rt><rp>)</rp></ruby>'} /></BunproFurigana></div>);
  const word = screen.getByRole("button", { name: "Furigana for 私" });
  fireEvent.keyDown(word, { key: "Enter" });
  expect(word).toHaveAttribute("aria-pressed", "true");
  fireEvent.keyDown(word, { key: "Enter", repeat: true });
  expect(word).toHaveAttribute("aria-pressed", "true");
  fireEvent.keyDown(word, { key: " " });
  expect(word).toHaveAttribute("aria-pressed", "false");
  expect(shortcut).not.toHaveBeenCalled();
});
