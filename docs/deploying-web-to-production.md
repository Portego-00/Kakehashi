# Deploying Kakehashi Web to production

Production site: https://kakehashiapp.com

Vercel project: **kakehashi-web**, under **portego-00s-projects**.

## Current release: October 20, 2026

Production is **`dpl_FozBTABZSA6rdGsYqLXX8E1xrN3a`**, at https://kakehashi-osoahso8i-portego-00s-projects.vercel.app, promoted to https://kakehashiapp.com. It adds **Hide level & SRS text** under **Settings → Reviews → Prompt** and the in-session review settings. When enabled, regular reviews and extra study show the level number and SRS icon beneath the item, keeping the English labels available to screen readers. The setting saves automatically and preserves the current answer.

The complete 1,227-file source snapshot is `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-20/Kakehashi/review-metadata-text-prod/upload`. It preserves the verified previous production source and merges only this change across 12 implementation and test paths. All uploaded source hashes were verified. The production build, typecheck, and lint passed, with three existing lint warnings. The full unit suite passed 3,229 tests with one existing skip; an interrupted first run was repeated with fewer workers. Four desktop/mobile browser checks passed on the staged deployment and again on the live domain, covering immediate label hiding, retained answers, restoring labels, and settings persistence across reloads. Release manifests, logs, and screenshots are beside the snapshot; temporary preview credentials were removed.

The immediate rollback is **`dpl_5arwReZVgSAnPYrh954xPe3Bfayb`**, at https://kakehashi-khtzou292-portego-00s-projects.vercel.app, with source in `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-20/Kakehashi/review-prompt-color-prod/upload`. Production was unchanged immediately before promotion and verified on the new deployment afterward. No environment changes, database migrations, native release, Git commit, or Git push were performed.

## Previous release: October 20, 2026 — prompt text color

Production is **`dpl_5arwReZVgSAnPYrh954xPe3Bfayb`**, at https://kakehashi-khtzou292-portego-00s-projects.vercel.app, promoted to https://kakehashiapp.com. It adds **WaniKani prompt text color**, shared by regular reviews and extra study, and an independent **Bunpro prompt text color**. Both controls appear in their main settings sections and in the review settings dialog, with Custom and Default options. The existing speech recognition release is preserved.

The complete 1,226-file source snapshot is `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-20/Kakehashi/review-prompt-color-prod/upload`. It starts from the verified previous production source and includes only the color-setting changes plus a session mock repair in an existing autoplay test. Build, typecheck, and lint passed. The complete unit run and repaired fixture reruns account for 3,224 passing tests, with one existing skipped test. Desktop and mobile checks passed locally, on the protected deployment, and on the live domain, covering immediate prompt updates, preserved answers and backgrounds, independent WaniKani/Bunpro persistence, and restoring defaults. All uploaded source hashes were verified before promotion. Release manifests, logs, and screenshots are beside the snapshot; temporary preview credentials were removed.

The immediate rollback is **`dpl_6mtNhbyrDZNhLdv5Wykc7NPCFeoh`**, at https://kakehashi-o0sl3xnkr-portego-00s-projects.vercel.app, with source in `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-20/Kakehashi/review-asr-complete-prod/upload`.

## Previous release: October 20, 2026 — speech recognition

Production is `dpl_6mtNhbyrDZNhLdv5Wykc7NPCFeoh`, at https://kakehashi-o0sl3xnkr-portego-00s-projects.vercel.app, promoted to https://kakehashiapp.com. **Settings → Reviews → Speech recognition** is a normal collapsed section, visible only to authenticated Portego accounts and hidden for demo accounts. It offers independent optional Japanese reading (318 MB) and English meaning (96 MB) downloads. Existing Japanese cache keys and pinned assets are unchanged.

The record control now appears for reading and meaning answers in WaniKani and custom SRS reviews/lesson quizzes, mixed sessions, Bunpro reviews/lessons/practice, and extra-study quizzes. Recording opens an editable answer even when Multiple Choice or Anki mode is selected. Recognition never submits an answer automatically. Existing context-sentence TTS is unchanged.

The exact 1,224-file production source snapshot is `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-20/Kakehashi/review-asr-complete-prod/upload`. It starts from the verified previous production source and overlays this ASR update; unrelated working-folder changes were excluded. Build, typecheck, targeted lint, and 470 focused unit tests passed. After the English capture fix, all 48 speech tests passed. Hosted browser verification passed 22 checks, including real downloads and recognition for both languages; 20 live desktop/mobile checks passed. Uploaded source hashes were verified before promotion. Manifests, logs and screenshots are beside the snapshot; temporary preview credentials were removed.

The immediate rollback is `dpl_JB81vuxonGUhFjHFtHUzLfA1bAVp`, at https://kakehashi-eehimztoq-portego-00s-projects.vercel.app, with source in `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-20/Kakehashi/review-asr-portego-prod/upload`. It contains the initial Japanese-only ASR implementation. The earlier pre-ASR rollback remains `dpl_Hnz1AvifQmRr6HrpzaTV6dqzybk1`, at https://kakehashi-ir2rug6vg-portego-00s-projects.vercel.app.

## Which folder to deploy

Deploy from a complete repository-shaped source folder, with `web/`, `src/`, `shared/`, and `assets/` inside it. Vercel's configured Root Directory is `web`, but the web app imports shared files from outside that directory.

Always include `--local-config web/vercel.json`. The repository's top-level `vercel.json` builds the separate marketing website.

As of October 12, 2026, production includes all current web changes, including the working folder's shared Multiple Choice improvements. Earlier releases included separately deployed fixes, so always compare the latest deployed source before preparing a release. The working folder also contains unrelated mobile changes.

For the October 12 full web release, a complete deploy-ready source snapshot is saved locally at:

```
/Users/pedroortego/Code/Kakehashi/output/web-prod-all-2026-10-12/upload
```

That snapshot contains all 1,175 verified production source files, including the settings redesign, review presets and compact layout, level goals and pace planner, saved news, community activity, and Multiple Choice improvements. Existing live Bunpro and review fixes were verified against the latest source. The release is `dpl_J18twLkECnX3YZSkK1g1jLWJGmqB`; its source manifests, checks, and deployment records are saved beside the snapshot. One browser test's screenshot measurement was corrected in the development folder after the source upload; application code was unchanged. The snapshot does not automatically receive later development edits. For future releases, use a complete source version containing the latest live changes and the changes you intend to publish. This snapshot is a starting point only while it still matches the latest production release.

## First-time sign-in

Open Terminal and run:

```sh
npx vercel login
```

Follow the browser sign-in. This computer is already signed in and the saved snapshot is already linked to `kakehashi-web`. On a different computer, run `npx vercel link` from the complete source folder and choose that existing project and team.

## Build, check, then publish

1. Open Terminal in the complete source folder. For the saved October 12 release:

   ```sh
   cd /Users/pedroortego/Code/Kakehashi/output/web-prod-all-2026-10-12/upload
   ```

2. For edited source, install dependencies and check the app:

   ```sh
   npm --prefix web ci
   npm --prefix web run typecheck
   npm --prefix web run lint
   npm --prefix web run test
   ```

   Fix any failures before publishing. Run the relevant browser tests too; the header regression uses:

   ```sh
   npm --prefix web run test:e2e:review-layout -- --grep 'subject stays visible'
   ```

3. Build a production deployment without changing the live site:

   ```sh
   npx vercel deploy --prod --skip-domain --local-config web/vercel.json
   ```

   Wait for the build to succeed. Copy the unique deployment URL shown by the command. This uses the production environment settings already stored in Vercel; do not copy secrets into source files. A successful build is not live yet because of `--skip-domain`.

4. Open that deployment URL and check the changed screens. Vercel may ask you to sign in because staging deployments can be protected. In the Vercel dashboard, also confirm nobody has deployed a newer version while you were testing.

5. Publish the checked deployment, replacing `DEPLOYMENT_URL` with the URL from step 3:

   ```sh
   npx vercel promote DEPLOYMENT_URL
   ```

6. Open https://kakehashiapp.com and verify the change there.

Vercel uploads files from the folder you run the command in, including eligible uncommitted files. A Git commit or push alone does not publish this setup: the project currently has no Git repository integration configured.

## If a release breaks something

Open the **kakehashi-web** project in the Vercel dashboard, go to **Deployments**, select the previous working production deployment, and use **Instant Rollback**. Then verify the live site. A rollback changes which deployment serves the site; it does not revert your local files.

The production deployment immediately before the October 12 release was:

- `dpl_5pKBANLyvMguaBi8eWcymAv1BTvp`
- https://kakehashi-gv9idlgux-portego-00s-projects.vercel.app

Do not assume that remains the correct rollback target for later releases.

Reference: [Vercel deployment options](https://vercel.com/docs/cli/deploy) and [promoting deployments](https://vercel.com/docs/deployments/promoting-a-deployment).


## October 12 settings follow-up

The October 12 settings release was **`dpl_7UBg4H8x79qp9NYiUs4fGw18VbdM`**, at https://kakehashi-kndxyqoah-portego-00s-projects.vercel.app. It adds the compact, independently scrolling settings sidebar; animated disclosures; padded select arrows; section scroll resets; Bunpro review controls; and concise info-button help. Custom vocabulary settings are visible only to the real Portego account.

Its complete source snapshot is `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-12/Kakehashi/web-settings-oct12/upload`. Use this snapshot as the next release base only while it still matches the live deployment. It preserves the earlier full web release and overlays only 16 settings source and test files. Source manifests, production build records, and browser checks are beside it. The full unit suite, typecheck, and lint passed, and eight browser checks passed on both the staged deployment and the live domain. Screenshot previews are stored outside the repository at `/Users/pedroortego/.codex/visualizations/2026/10/12/web-settings`.

The immediate rollback target is the previous full web release, `dpl_J18twLkECnX3YZSkK1g1jLWJGmqB`, at https://kakehashi-3ki24ewdi-portego-00s-projects.vercel.app. Mobile work was excluded from this deployment.
