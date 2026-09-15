import { isSpotifyAuthRedirect } from "../src/utils/spotifyAuthRedirect";

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (isSpotifyAuthRedirect(path)) {
    // Android AuthSession receives the same Linking event as Expo Router. Leave
    // its screen mounted while it exchanges the code; this only skips navigation.
    // A cold callback has no pending PKCE request, so start at the app's entry route.
    return initial ? "/" : null;
  }
  return path;
}
