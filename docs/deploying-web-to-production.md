# Deploying Kakehashi Web to production

Production site: https://kakehashiapp.com

Vercel project: **kakehashi-web**, under **portego-00s-projects**.

## Which folder to deploy

Deploy from a complete repository-shaped source folder, with `web/`, `src/`, `shared/`, and `assets/` inside it. Vercel's configured Root Directory is `web`, but the web app imports shared files from outside that directory.

Always include `--local-config web/vercel.json`. The repository's top-level `vercel.json` builds the separate marketing website.

As of October 8, 2026, production includes several separately deployed fixes that are not fully captured by this checkout's Git history. The working folder also contains unrelated uncommitted changes. Deploying that entire folder could overwrite live fixes or publish unfinished work.

For the Multiple Choice web release, a complete deploy-ready source snapshot is saved locally at:

```
/Users/pedroortego/Code/Kakehashi/output/multiple-choice-web-2026-10-08/upload
```

That snapshot contains all 1,134 verified production source files, including the Multiple Choice setting, answer generation, and keyboard shortcuts. Existing live fixes were preserved by reconciling the approved changes against the deployed source. The release is `dpl_8EaArdFJ4cegcoD9pc6od5Xiq9fp`; its source manifests, checks, and deployment records are saved beside the snapshot. It does not automatically receive edits made in the normal development folder. For future releases, use a complete, reconciled source version containing the latest live changes and the changes you intend to publish. This snapshot is a starting point only while it still matches the latest production release.

## First-time sign-in

Open Terminal and run:

```sh
npx vercel login
```

Follow the browser sign-in. This computer is already signed in and the saved snapshot is already linked to `kakehashi-web`. On a different computer, run `npx vercel link` from the complete source folder and choose that existing project and team.

## Build, check, then publish

1. Open Terminal in the complete source folder. For the saved Multiple Choice release:

   ```sh
   cd /Users/pedroortego/Code/Kakehashi/output/multiple-choice-web-2026-10-08/upload
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

The production deployment immediately before the Multiple Choice release was:

- `dpl_3SKxDFPQyHjotLnhKyErnjYNoNGV`
- https://kakehashi-9zbrl0b8c-portego-00s-projects.vercel.app

Do not assume that remains the correct rollback target for later releases.

Reference: [Vercel deployment options](https://vercel.com/docs/cli/deploy) and [promoting deployments](https://vercel.com/docs/deployments/promoting-a-deployment).
