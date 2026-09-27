# Community moderation web release — 22 September 2026

Deployed and promoted to [kakehashiapp.com/community](https://kakehashiapp.com/community).

- Deployment: `dpl_ESf3UFrEno4VzujnD1jZaHR4K7r6`
- Immutable URL: https://kakehashi-jc1c8axya-portego-00s-projects.vercel.app
- Previous production: `dpl_7KoCdthyf91uqkcA463FcwyC9gPS`
- Project: `prj_G8n90lvFlVuIEFz6lyAytvXohImQ` (`kakehashi-web`)

The verified WaniKani username Portego can close and reopen other authors’ community issues. The existing author/configured-admin controls remain. Status moderation does not grant additional deletion access.

Production contained changes absent from the local main checkout. Reconstructed all 1,068 production source files and applied the community patch cleanly. Verified all 1,070 uploaded files by SHA-1: only the six intended implementation/test/documentation files and generated TypeScript build cache differed. No existing production source file was removed.

Validation: release-copy TypeScript and lint passed; 12 suites / 46 community tests passed. Initial isolated test execution needed the repository dependency link and explicit local-store test configuration; after correcting that test environment, all tests passed. Vercel compilation, TypeScript validation and static generation passed. The protected release API returned the new status permission and denied anonymous moderation before promotion. After promotion, the canonical domain resolved to this exact READY deployment; login and community pages returned HTTP 200, and the live issue API passed the same permission check.

No real issue status was changed during verification. Authenticated moderation behavior was covered by route and component tests, not a live Portego mutation. No database migration, environment change, Git commit or Git push was performed. The unchanged dependency installation reported five audit findings (two moderate, two high, one critical); dependency remediation was outside this release.
