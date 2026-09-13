# Connect your Spotify account

Kakehashi can connect to a Spotify developer app that you create for your own account. Setup takes place in **Settings → Music Playback → Spotify connection → Set up**. You only need to copy a **Client ID**; you do not need to write code or provide a Client Secret.

## Before you start

- An active **Spotify Premium** subscription on the Spotify account you will connect. Spotify requires Premium for the owner of a development app and for playback controls. If Premium expires, the connection will stop working until you renew it.
- Access to that account in a browser and the Spotify app on a phone or computer.
- Kakehashi installed on your device so Spotify can return to it after sign-in.

You can search for songs in Kakehashi without completing this setup. Account linking uses your personal Client ID; catalog search continues to use Kakehashi's existing connection.

## 1. Open Spotify's developer dashboard

In Kakehashi, open **Settings → Music Playback → Spotify connection → Set up**. Keep the setup screen available: it shows the callback address you will need below.

Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), sign in with the **same Spotify account you want to connect**, and accept the developer terms if asked. Your existing Spotify account is used for developer access.

## 2. Create your personal app

Choose **Create app** and fill in the form:

- **App name:** for example, `My Kakehashi connection`.
- **App description:** for example, `Connect my Spotify account to Kakehashi for personal use`.
- **Redirect URI:** copy the complete callback address shown in Kakehashi's Spotify setup screen. The standard address is `kakehashi://spotify-auth`.
- **APIs:** select **Web API**.

Review and accept Spotify's developer terms, then create the app. If the redirect address needs to be added afterward, open the app's **Settings**, add it under **Redirect URIs**, and **Save**.

The address must match exactly, including punctuation and any trailing slash. A particular Kakehashi build may show a different address; always copy the address from the app you are using. Spotify supports this type of native-app callback even though it does not begin with `https://`.

## 3. Check account access

In your developer app, open **Settings → Users Management**. Check that the Spotify account you will connect has access. If it is missing, choose **Add new user**, enter its name and Spotify account email address, and save.

Use the email associated with your Spotify account, which may differ from your Kakehashi sign-in email. An account without access can sometimes sign in successfully but then receive an access error.

## 4. Save the Client ID and connect

In your developer app's **Settings**, copy the **Client ID**. This is a 32-character identifier. Leave **Client Secret** alone: Kakehashi does not need it.

Return to **Spotify connection**, paste the Client ID, and **save it**. Then choose **Connect Spotify**, sign in to the same account, and approve the requested access. Spotify will return you to Kakehashi.

## 5. Start listening

Open Spotify on the phone or computer where you want to listen and start a song so a playback device is available. Return to Kakehashi and select Spotify as your playback source in **Music Playback**.

If no device is found, keep Spotify open and playing, confirm it uses the connected account, and try again.

## Changes and troubleshooting

- **Wrong callback:** copy the address from Kakehashi again, save it in Spotify's Redirect URIs, and reconnect.
- **Client ID rejected:** copy **Client ID** from your developer app's Settings, save it in Kakehashi, and reconnect. Do not paste the Client Secret or an app URL.
- **Access denied or forbidden:** check Premium, the **Web API** selection, and **Users Management**. Confirm you signed in to the intended Spotify account.
- **A playlist will not import:** Spotify development apps can read tracks only from playlists you own or collaborate on. Followed playlists from other people may expose their details without their songs. [Spotify playlist changes](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Connection expired:** choose **Connect Spotify** again. Spotify requires renewed authorization after six months.
- **Changing or removing the Client ID:** this clears your existing Spotify link and switches playback back to YouTube. After saving a different ID, connect again. Song search remains available.
- **Disconnecting:** disconnect Spotify from Music Playback settings. You can also remove the developer app's access from your [Spotify account's Apps page](https://www.spotify.com/account/apps/).

## Maintainer note: Spotify limits and policy

Requirements checked **September 8, 2026**. Development apps support up to five authenticated users each and require the owner's Premium subscription. Developers can currently create up to 25 apps, which share an account-level API quota. Catalog search also remains subject to Spotify's rate and quota limits.

This setup is not an approved way to bypass Spotify's production-access requirements. Spotify's Developer Policy requires one Client ID per Spotify Developer Application. Using separate personal IDs for one distributed application, alongside a shared catalog ID, may conflict with that requirement; the technical ability to connect does not establish Spotify's approval.

Official references: [development mode and user access](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [creating apps](https://developer.spotify.com/documentation/web-api/concepts/apps), [Web API selection](https://developer.spotify.com/documentation/web-api), [native callback support](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify), [PKCE without a secret](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [Premium playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback), [refresh token expiration](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens), [July 2026 quota changes](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates), and [Developer Policy, section VII](https://developer.spotify.com/policy).
