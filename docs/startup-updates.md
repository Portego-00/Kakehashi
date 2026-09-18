# Startup updates

On startup, release builds with Expo Updates enabled automatically check for an
update and apply it before opening Home. The animated loader stays visible and
shows “Checking for updates...” or “Applying update...”. Development builds, web,
and builds with Expo Updates disabled skip this step.

`src/services/startupUpdateService.ts` allows up to 5,000 ms to check for an
update. When one is available, downloading it gets a separate 60,000 ms budget.
A check that takes four seconds still leaves the full minute for the download.
The loader stays visible while downloading and requesting the reload. These
budgets apply only to the update step, not all startup work. No update, a request
error, or expiry of the current step's budget allows normal startup to continue.
Existing offline cache loading and background synchronization remain in place.

Previously, checking and downloading shared five seconds. An update that took
longer could finish downloading but was never applied during that launch, which made
automatic startup updates appear broken. Separate budgets allow larger updates
to finish without making an offline update check block startup for a minute.

After the budget expires, a late check cannot start a download, and a late
download cannot reload the app or change the loader status. Expo's already
running native requests cannot be cancelled: a download may still finish and
cache an update for a later cold start.

When an update is ready within its download budget, the service requests a native
reload. The root layout keeps Home unmounted during that handoff so the restart cannot
interrupt a newly opened study session. The download timer does not
release the loader once a reload has been requested. A rejected reload allows
normal startup to continue.

Validation covers the real root layout and service with a mocked Expo native
boundary. Cases include downloads exceeding five seconds, the full download
allowance after a slow check, timeout fallback, late completions, suspended JS,
skipped environments, reload behavior, and offline cache startup. The slow-download
regressions were reproduced before the fix. No update was published, and this
does not claim a release-device update installation.
