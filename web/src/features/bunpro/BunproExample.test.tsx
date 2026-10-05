import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BunproExample, ExampleAudioProvider } from "./BunproExample";
const attributes = { content: 'そこに<span class="gp-popout">置(お)きません</span><strong>でした</strong>。', translation: 'I <strong>did not place it</strong> there.', female_audio_url: "https://audio.test/example.mp3" };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows the provider's conjugation note beneath the translation", () => {
  render(<ExampleAudioProvider><BunproExample attributes={{ ...attributes, extra_info: "行(い)く's conjugation with て" }} title="Verb + て" /></ExampleAudioProvider>);
  expect(screen.getByText("く's conjugation with て", { exact: false })).toBeVisible();
});
it("keeps translations in one text container, preserves grammar accents, and uses a custom player", async () => {
  const instances: MockAudio[] = [];
  class MockAudio extends EventTarget { play = vi.fn().mockResolvedValue(undefined); pause = vi.fn(); constructor() { super(); instances.push(this); } }
  vi.stubGlobal("Audio", MockAudio);
  const { container, unmount } = render(<ExampleAudioProvider><BunproExample attributes={attributes} title="Past negative" /><BunproExample attributes={attributes} title="Past negative" /></ExampleAudioProvider>);
  expect(container.querySelector("audio")).toBeNull();
  expect(container.querySelector('strong')).toHaveTextContent("でした");
  expect(container.querySelector('[data-bunpro-accent]')).toBeNull();
  const translation = screen.getAllByText("did not place it")[0].parentElement!;
  expect(translation.textContent).toBe("I did not place it there.");
  fireEvent.click(screen.getAllByRole("button", { name: "Play example audio" })[0]);
  expect(await screen.findByRole("button", { name: "Pause example audio" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Play example audio" }));
  expect(instances[0].pause).toHaveBeenCalled();
  await act(async () => instances[1].dispatchEvent(new Event("ended")));
  expect(screen.getAllByRole("button", { name: "Play example audio" })).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button", { name: "Play example audio" })[0]);
  unmount(); expect(instances[2].pause).toHaveBeenCalled();
});
