# Mobile notebooks

The Expo app uses a native page browser around a bundled BlockNote editor. It reads and writes the same account document as the web app, including page hierarchy, block IDs, vocabulary references, shared sentence IDs, and optimistic revisions. No format conversion or second notebook database is involved.

The editor is an Expo DOM component running in the app's WebView. Its JavaScript, styles, and BlockNote schema ship with the mobile bundle; it does not load the deployed web notebook page. The web server is still required for authenticated notebook reads and writes. See the [native API contract](notebooks-native-api.md) and [existing storage deployment](notebooks-storage.md).

## Access and navigation

Mobile notebooks are limited to the verified WaniKani username `Portego`, ignoring case and surrounding whitespace. The restriction applies to the native API, both mobile routes, the Settings entry, and tab customization. Development mode does not bypass the account restriction. The existing web notebook access policy is unchanged.

For Portego:

- Open **Settings → User Profile → Notebooks**. This entry works even when the notebook tab is not enabled.
- Use **Settings → Appearance → Customize Tabs → Notebooks** to add the tab, subject to the device's existing tab limit. Existing tab choices are preserved.
- The standalone route is `/notebook-workspace`; the tab route is `/(app)/(tabs)/notebooks`. Both reject other accounts before mounting the workspace.

The page browser needs a configured endpoint for its first cloud load. There is no unauthenticated sample account or local-only fallback when the endpoint is missing. After a successful load, the account's cached pages remain available during connection failures.

Opening a page hides the bottom tab bar so it cannot cover the editor tools. Returning to the page list restores the tabs and preserves the list's search and expansion state. Visibility belongs to the current tab navigator and is released on blur or unmount; the standalone Settings route is unaffected. Both native tabs and the fallback tab bar follow this behavior.

## Configure the connection

The native endpoint is deployed at `https://kakehashiapp.com/api/notebooks/native`. EAS project `@portego00/kakehashi` has this URL configured as `EXPO_PUBLIC_NOTEBOOKS_API_URL` in **production**. Use `--environment production` when publishing an EAS Update so it receives this value. This backend deployment did not publish a mobile update.

Set `EXPO_PUBLIC_NOTEBOOKS_API_URL` in the mobile app's build/update environment to the **complete** endpoint URL:

```dotenv
EXPO_PUBLIC_NOTEBOOKS_API_URL=https://your-web-origin.example/api/notebooks/native
```

The value belongs in the Expo environment, not just the Next.js server's environment. It is a public URL embedded in the mobile bundle. Use the trusted Kakehashi web deployment: the native client sends the signed-in user's WaniKani bearer token to this endpoint. The DOM editor receives page data and callbacks, never authentication tokens or Supabase credentials.

Production connections require HTTPS. URLs containing embedded credentials are rejected. HTTP is allowed only in a development bundle for `localhost`, `127.0.0.1`, or Android Emulator's `10.0.2.2`; arbitrary LAN HTTP URLs are rejected.

For local iOS Simulator development, add this value to an ignored root `.env.local` file or provide it to the Expo process:

```dotenv
EXPO_PUBLIC_NOTEBOOKS_API_URL=http://127.0.0.1:3000/api/notebooks/native
```

Run the Next.js app from the repository root in one terminal:

```sh
npm --prefix web run dev
```

Run the Expo development client in a second terminal:

```sh
npx expo start --dev-client --clear
```

The Next.js process needs the existing notebook storage configuration and migrations described in [Notebook storage and deployment](notebooks-storage.md#deploy). Point both web and native requests at the same configured Supabase project to share the account's existing pages. For Android Emulator, use `http://10.0.2.2:3000/api/notebooks/native`. A physical device needs a reachable HTTPS deployment or HTTPS development endpoint; its loopback address does not refer to the development computer.

Restart Metro after changing the endpoint. For a release, supply the HTTPS value when generating the mobile build or compatible update. The configured web deployment must include `/api/notebooks/native`; changing only the app's URL does not deploy that server route. The native endpoint uses the existing notebook table and migrations, with no additional mobile table required.

## Interactions and draft recovery

The native browser supports title/content search, favorites, expandable page hierarchies, blank/grammar/lesson/reading templates, subpages, duplicate, move, icon changes, trash, restore, and confirmed permanent deletion. Long-press a page or tap its ellipsis for actions.

The editor supports page titles, paragraphs, headings, lists, checklists, toggles, quotes, code, tables, dividers, callouts, inline formatting, links, undo/redo, and the same vocabulary, sentence, and page references as the web model. Touch editing tools expose block insertion and formatting; `/` and `@` suggestions also remain available. Vocabulary search uses the app's cached WaniKani subjects. Attachments and uploaded media are not part of the notebook format.

The native client debounces page edits and serializes mutations. It stores the last cloud document and pending title, icon, and body drafts in account-scoped device storage. Leaving a page waits for local persistence and then allows cloud saving to continue. A failed connection preserves the draft and displays a sync error or **Saved on device**, rather than claiming a cloud save succeeded. Cloud operations such as creating, moving, trashing, or editing shared sentence records still require a connection; they are not a general offline action queue.

When another device changes the same page, the local draft is retained and the workspace offers **Keep as new page** or **Load saved version**. Loading the saved version requires confirmation and a fresh read. Account changes separate cached data and invalidate requests from the previous account. The editor keeps its DOM instance through local autosave echoes, including removal of BlockNote's default properties by the shared sanitizer, so saving does not reset the cursor or Japanese composition. A genuine remote update to a clean page reloads the editor; a pending local draft is preserved for recovery.

## Implementation map

| Responsibility | Source |
| --- | --- |
| Native browser, actions, and route guard | [NotebookWorkspace.tsx](../../src/features/notebooks/NotebookWorkspace.tsx) |
| Stable DOM session and remote reload behavior | [NotebookEditorSession.tsx](../../src/features/notebooks/NotebookEditorSession.tsx) |
| Bundled editor and native callback contract | [NotebookEditor.dom.tsx](../../src/features/notebooks/NotebookEditor.dom.tsx), [editor-contract.ts](../../src/features/notebooks/editor-contract.ts) |
| Account-scoped drafts, revisions, and persistence | [client.ts](../../src/features/notebooks/client.ts), [use-notebooks.ts](../../src/features/notebooks/use-notebooks.ts) |
| Native authenticated transport | [api.ts](../../src/features/notebooks/api.ts) |
| Canonical shared JSON model | [web model](../src/features/notebooks/model.ts), [native re-export](../../src/features/notebooks/model.ts) |
| Server endpoint and verified Portego gate | [native route](../src/app/api/notebooks/native/route.ts), [native access verifier](../src/lib/server/native-notebook-access.ts) |

## Validation record

Automated validation on 7 September 2026 passed **73 tests**:

| Coverage | Passing tests |
| --- | ---: |
| Native API transport and draft client | 25 |
| Web native endpoint and notebook storage | 27 |
| Native workspace, access guards, page helpers, and editor session | 18 |
| Web/mobile BlockNote schema compatibility | 3 |

These checks cover Portego-only access, verified account ownership, credentials-free account-scoped persistence, logout cancellation, failed saves, concurrent typing and metadata changes, stale revisions, conflict recovery, and cache ordering. UI checks cover unauthorized deep-link entry, hierarchy and move exclusions, duplicate block IDs with preserved shared references, template creation, stable autosave payloads, sanitized autosave echoes, clean remote updates, and preservation of pending drafts. Schema checks exercise compatibility with the web's structured document format.

Focused notebook lint passed. Focused native API/client/shared-model TypeScript checks and the web app's TypeScript check passed. The production iOS export wrote the DOM editor's HTML, JavaScript, and styles to `www.bundle`, but the subsequent OTA investigation found that their presence on disk did not guarantee their inclusion in the published update.

### Validate exported update assets

Expo CLI 55.0.16 has two relevant DOM export defects: parallel component exports can overwrite each other's asset metadata, and split JavaScript chunks keep their old import paths after being renamed for native updates. The pinned patch in `patches/@expo+cli+55.0.16.patch` fixes the metadata race and disables splitting for DOM exports that use MD5 filenames. `npm install` applies this patch automatically; patch failures stop installation so a future SDK change requires review.

Before publishing an exported update, validate its asset graph:

```sh
npm run check:update-assets -- dist
node --test scripts/check-expo-dom-assets.test.mjs scripts/patch-expo-dom-export.test.cjs
```

The checker follows the HTML references in each native bundle and the linked DOM scripts and styles. It rejects absent files, incorrect content hashes, omitted update metadata, and unresolved Metro chunk paths. `--repair-metadata` can recover omitted metadata when all referenced assets are already valid; it deliberately refuses to repair missing files or broken chunk paths. The patched exporter prevents these defects in newly generated updates.

Run the mobile feature tests from the repository root:

```sh
npx jest src/features/notebooks/__tests__ --runInBand
```

Run the server and schema compatibility checks from the repository root:

```sh
npm --prefix web test -- src/app/api/notebooks/native/route.test.ts src/lib/server/notebooks-server.test.ts src/features/notebooks/mobile-editor-compatibility.test.tsx
```

### Development simulator startup

During hands-on QA, recurring blank editor opens coincided with `com.apple.WebKit.WebContent` crashing before application JavaScript ran: `SIGBUS` in `DyldSharedCache::getUUID` at `0x180000058`. The crash reports identify a simulator shared-cache mapping failure. [Apple Developer Forums: dyld crash before main() due to shared-cache mapping failure](https://developer.apple.com/forums/thread/837945) describes the same failure pattern and Apple's tracked loader issues.

Shutting down and booting **only the affected simulator**, without erasing its data, restored clean editor loads. For this exact startup failure, repeat that targeted restart and reopen the editor. No application workaround, private WebKit setting, or dependency patch was needed.

### Hands-on simulator results

Test device: iPhone 17 Pro, iOS 26.3, simulator `E728FADD-611C-42FE-9146-B6EFD91D8FA9`; Kakehashi development client 1.4.7 (1), connected to the local native notebook endpoint.

Confirmed so far:

- The native page browser loads Portego's existing cloud pages.
- The bundled editor renders the existing **Start here** page and an empty page, including the full cached vocabulary dataset.
- Creating an empty page from the native template sheet succeeds, and the new page appears in the web app for the same account.
- The simulator showed missing glyphs for preset page icons; native vector icons and matching DOM SVG icons now render those presets correctly without changing the stored format.

**Editing and keyboard validation remain incomplete.** A process sample during text-entry testing showed the native main thread waiting for a synchronous reply from the simulator's pasteboard service. Restarting only that simulator service briefly restored input. Separate samples showed both simulator clipboard services waiting; they do not identify the editor as the cause. Later, the computer-use tool reported that the Mac was locked and could not be unlocked automatically. Hands-on work paused for the user to unlock it.

After the Mac was unlocked on 8 September, the original simulator reopened its cached test page and the native page-actions sheet worked. WebContent then repeatedly hit the same pre-main shared-cache crash. A later native process sample was normally idle, so the earlier pasteboard deadlock does not explain every failed input attempt. Automatic Simulator clipboard sharing remains at its original enabled setting; temporary editor diagnostics were removed.

A separate **Kakehashi Notebooks QA** simulator was created for comparison: iPhone 16, iOS 18.5, `46355466-18AE-4EED-9F20-91305C202207`. Boot it with the arm64 runtime; booting the entire older runtime as x86_64 caused system-service failures on this host. The existing x86_64 development app installs and opens on the arm64-booted simulator. Its app cache was copied without SecureStore credentials, and it is waiting at the Portego sign-in screen. No access-gate bypass was added. The original simulator's data remains intact.

Still required before calling the mobile experience validated: edit/save/reopen, title editing, Japanese composition, keyboard dismissal and toolbar placement, scrolling, selection, block/format menus, reference interactions, remaining page actions, offline recovery, and a web/mobile conflict. Source tests and successful export alone do not establish keyboard or visual parity with the web or Notion mobile.

On 8 September, the iOS OTA asset correction was additionally validated with the exact published editor files in a native WKWebView on the QA simulator. The missing manifest files reproduced the device's `-1100` error. The corrected package loaded successfully, accepted body edits, and loaded and inserted an emoji with native callbacks. This isolated check used synthetic content and did not exercise signed-in cloud saving or conflict recovery; the broader end-to-end checks above remain outstanding.

The subsequent bottom-tab overlap fix has seven interaction regressions covering native/fallback tabs, return navigation and search preservation, failed local saves, focus changes, unmounting, and revoked access. All 51 native notebook tests passed. An isolated Expo Router fixture with the exact visibility hook and real native tabs additionally confirmed that opening the editor hides the bar, its bottom control remains tappable, and Back or leaving the tab restores it.
