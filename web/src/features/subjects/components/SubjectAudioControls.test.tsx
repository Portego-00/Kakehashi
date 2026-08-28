import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubjectAudioButton, SubjectAudioProvider } from "./SubjectAudioControls";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("subject audio controls", () => {
  it("uses one no-slider player across pronunciation and anime buttons", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const { container } = render(
      <SubjectAudioProvider>
        <SubjectAudioButton audioKey="pronunciation:1" src="https://example.com/kyoko.mp3" label="Kyoko pronunciation" variant="pronunciation">
          <span>Kyoko (female)</span>
        </SubjectAudioButton>
        <SubjectAudioButton audioKey="anime:1" src="https://example.com/scene.mp3" label="anime clip from Re:Zero" variant="scene" />
        <SubjectAudioButton audioKey="anime:2" label="anime clip from KonoSuba" variant="scene" />
      </SubjectAudioProvider>,
    );

    const player = container.querySelector<HTMLAudioElement>("[data-subject-audio-player]");
    expect(player).toBeInstanceOf(HTMLAudioElement);
    expect(player).not.toHaveAttribute("controls");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByText("Kyoko (female)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Audio unavailable for anime clip from KonoSuba" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Play Kyoko pronunciation" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop Kyoko pronunciation" })).toBeInTheDocument());
    expect(play).toHaveBeenCalledOnce();
    expect(player).toHaveAttribute("src", "https://example.com/kyoko.mp3");

    fireEvent.click(screen.getByRole("button", { name: "Play anime clip from Re:Zero" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop anime clip from Re:Zero" })).toBeInTheDocument());
    expect(play).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Play Kyoko pronunciation" })).toBeInTheDocument();
    expect(player).toHaveAttribute("src", "https://example.com/scene.mp3");

    fireEvent.ended(player!);
    expect(screen.getByRole("button", { name: "Play anime clip from Re:Zero" })).toBeInTheDocument();
  });

  it("offers a retry when browser playback fails", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValueOnce(new DOMException("Playback blocked", "NotAllowedError"));
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

    render(
      <SubjectAudioProvider>
        <SubjectAudioButton audioKey="pronunciation:1" src="https://example.com/kyoko.mp3" label="Kyoko pronunciation" variant="pronunciation">
          <span>Kyoko (female)</span>
        </SubjectAudioButton>
      </SubjectAudioProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play Kyoko pronunciation" }));
    expect(await screen.findByRole("button", { name: "Retry Kyoko pronunciation" })).toHaveAttribute("data-state", "error");
  });
});
