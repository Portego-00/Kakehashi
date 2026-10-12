# Deploying Kakehashi Web to production

Production site: https://kakehashiapp.com

Vercel project: **kakehashi-web**, under **portego-00s-projects**.

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

The latest production release is **`dpl_7UBg4H8x79qp9NYiUs4fGw18VbdM`**, at https://kakehashi-kndxyqoah-portego-00s-projects.vercel.app. It adds the compact, independently scrolling settings sidebar; animated disclosures; padded select arrows; section scroll resets; Bunpro review controls; and concise info-button help. Custom vocabulary settings are visible only to the real Portego account.

Its complete source snapshot is `/Volumes/XcodeBuildCache/ProjectArtifacts/2026-10-12/Kakehashi/web-settings-oct12/upload`. Use this snapshot as the next release base only while it still matches the live deployment. It preserves the earlier full web release and overlays only 16 settings source and test files. Source manifests, production build records, and browser checks are beside it. The full unit suite, typecheck, and lint passed, and eight browser checks passed on both the staged deployment and the live domain. Screenshot previews are stored outside the repository at `/Users/pedroortego/.codex/visualizations/2026/10/12/web-settings`.

The immediate rollback target is the previous full web release, `dpl_J18twLkECnX3YZSkK1g1jLWJGmqB`, at https://kakehashi-3ki24ewdi-portego-00s-projects.vercel.app. Mobile work was excluded from this deployment.
