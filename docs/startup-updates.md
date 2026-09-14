# Startup updates

On startup, release builds with Expo Updates enabled automatically check for an
update and apply it before opening Home. The animated loader stays visible and
shows “Checking for updates...” or “Applying update...”. Development builds, web,
and builds with Expo Updates disabled skip this step.

`src/services/startupUpdateService.ts` gives the check and download one shared
5,000 ms network budget. A check that takes four seconds leaves one second for
the download. This is the update step's budget, not a limit on all startup work.
No update, a request error, or expiry of that budget allows normal startup to
continue. Existing offline cache loading and background synchronization remain
in place.

After the budget expires, a late check cannot start a download, and a late
download cannot reload the app or change the loader status. Expo's already
running native requests cannot be cancelled: a download may still finish and
cache an update for a later cold start.

When an update is ready within the budget, the service requests a native reload.
The root layout keeps Home unmounted during that handoff so the restart cannot
interrupt a newly opened study session. The five-second network timer does not
release the loader once a reload has been requested. A rejected reload allows
normal startup to continue.

Validation covers the real root layout and service with a mocked Expo native
boundary: 26 tests across two suites passed. Cases include shared timeout
accounting, late completions, skipped environments, reload behavior, and offline
cache startup. No update was published, and this does not claim a release-device
update installation.

Scoped lint and the Android production export also passed. The export's embedded
editor asset check found two DOM pages and all 88 required files.
