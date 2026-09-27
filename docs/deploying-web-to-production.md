# Deploying Kakehashi Web to production

Production site: https://kakehashiapp.com

Vercel project: **kakehashi-web**, under **portego-00s-projects**.

## Which folder to deploy

Deploy from a complete repository-shaped source folder, with `web/`, `src/`, `shared/`, and `assets/` inside it. Vercel's configured Root Directory is `web`, but the web app imports shared files from outside that directory.

Always include `--local-config web/vercel.json`. The repository's top-level `vercel.json` builds the separate marketing website.

As of September 25, 2026, production includes several separately deployed fixes that are not fully captured by this checkout's Git history. The working folder also contains unrelated uncommitted changes. Deploying that entire folder could overwrite live fixes or publish unfinished work.

For the kanji header release, a complete deploy-ready source snapshot is saved locally at:

```
/Users/pedroortego/Code/Kakehashi/output/kanji-header-2026-09-25/source
```

That snapshot includes the existing production code plus the header fix. It does not automatically receive edits made in the normal development folder. For future releases, use a complete, reconciled source version containing the latest live changes and the changes you intend to publish. This snapshot is a starting point only while it still matches the latest production release.

## First-time sign-in

Open Terminal and run:

```sh
npx vercel login
```

Follow the browser sign-in. This computer is already signed in and the saved snapshot is already linked to `kakehashi-web`. On a different computer, run `npx vercel link` from the complete source folder and choose that existing project and team.

## Build, check, then publish

1. Open Terminal in the complete source folder. For the saved header release:

   ```sh
   cd /Users/pedroortego/Code/Kakehashi/output/kanji-header-2026-09-25/source
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

The production deployment immediately before the header release was:

- `dpl_7Q3hj3prnsPwvr6EfnamteRY83um`
- https://kakehashi-e8r7kmazc-portego-00s-projects.vercel.app

Do not assume that remains the correct rollback target for later releases.

Reference: [Vercel deployment options](https://vercel.com/docs/cli/deploy) and [promoting deployments](https://vercel.com/docs/deployments/promoting-a-deployment).
