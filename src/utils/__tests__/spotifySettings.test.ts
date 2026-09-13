import { useSettingsStore } from "../store";

describe("Spotify settings migration", () => {
  const migrate = useSettingsStore.persist.getOptions().migrate!;

  it("starts without personal credentials or a connected account", () => {
    expect(useSettingsStore.getInitialState()).toMatchObject({
      spotifyClientId: "",
      spotifyAuthStatus: "notConfigured",
      spotifyDisplayName: null,
    });
  });

  it("resets a legacy shared-app connection and playback before settings opens", async () => {
    const migrated = await migrate({
      spotifyAuthStatus: "authorized",
      spotifyDisplayName: "Old listener",
      songsPlaybackSource: "spotify",
      songsMusicSource: "spotify",
    }, 18);

    expect(migrated).toMatchObject({
      spotifyClientId: "",
      spotifyAuthStatus: "notConfigured",
      spotifyDisplayName: null,
      songsPlaybackSource: "youtube",
      songsMusicSource: "spotify",
    });
  });

  it.each(["appleMusic", "youtube"])("preserves existing %s playback during migration", async (source) => {
    expect(await migrate({ songsPlaybackSource: source }, 18)).toMatchObject({
      spotifyClientId: "",
      songsPlaybackSource: source,
    });
  });

  it("preserves a valid personal connection in subsequent migrations", async () => {
    const clientId = "a".repeat(32);
    expect(await migrate({
      spotifyClientId: ` ${clientId} `,
      spotifyAuthStatus: "authorized",
      spotifyDisplayName: "Listener",
      songsPlaybackSource: "spotify",
    }, 19)).toMatchObject({
      spotifyClientId: clientId,
      spotifyAuthStatus: "authorized",
      spotifyDisplayName: "Listener",
      songsPlaybackSource: "spotify",
    });
  });

  it("resets malformed personal configuration safely", async () => {
    expect(await migrate({
      spotifyClientId: 123,
      spotifyAuthStatus: "authorized",
      spotifyDisplayName: "Listener",
      songsPlaybackSource: "spotify",
    }, 19)).toMatchObject({
      spotifyClientId: "",
      spotifyAuthStatus: "notConfigured",
      spotifyDisplayName: null,
      songsPlaybackSource: "youtube",
    });
  });
});
