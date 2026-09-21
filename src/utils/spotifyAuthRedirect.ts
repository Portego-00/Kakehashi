export const SPOTIFY_REDIRECT_URI =
  process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI?.trim() ||
  "kakehashi://spotify-auth";

export function isSpotifyAuthRedirect(path: string): boolean {
  try {
    const incoming = new URL(path);
    const redirect = new URL(SPOTIFY_REDIRECT_URI);
    return incoming.protocol === redirect.protocol &&
      incoming.host === redirect.host &&
      // Native callbacks can represent an empty root path as '/'. Treat these
      // as equivalent without accepting other paths under the callback host.
      (incoming.pathname || "/") === (redirect.pathname || "/");
  } catch {
    return false;
  }
}
