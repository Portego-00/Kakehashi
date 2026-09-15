# Personal iPhone activity notifications

Inserts on issues, comments, issue likes and comment likes enter a private outbox.
A database webhook wakes this function immediately; a one-minute database cron
retries due jobs. The only destination is one server-approved iPhone installation.
Activity from all accounts, including the owner’s own website/app actions, is
reported. The verified owner ID restricts registration and delivery, not events.

## Configuration

Set these Supabase Edge Function secrets, never Expo public environment variables:

- `ISSUE_ACTIVITY_OWNER_WANIKANI_ID`: verified `/v2/user` account ID.
- `ISSUE_ACTIVITY_APPROVED_INSTALLATION_ID`: the specific phone's SecureStore UUID.
- `ISSUE_ACTIVITY_WEBHOOK_SECRET`: a randomly generated secret of at least 32 characters.
- `EXPO_ACCESS_TOKEN`: required for this project's enhanced Expo push security.
  Keep the dedicated notification sender token in Supabase secrets only.

The function also uses the automatically supplied `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`). In Supabase Vault, set
`issue_activity_push_project_url` to the HTTPS project URL without a trailing slash
and `issue_activity_push_webhook_secret` to the same webhook secret. Apply the
issue activity migrations and deploy `issue-activity-push` with JWT verification
disabled as declared in `supabase/config.toml`.

The client first calls `POST /issue-activity-push/eligibility` with
`{installationId, platform: "ios"}` and `Authorization: Bearer <WaniKani token>`.
Only an approved installation and an account verified directly by WaniKani receive
`{eligible: true}`. After obtaining notification permission and the Expo token,
`POST /issue-activity-push/register` adds `expoPushToken` to the same JSON body.
It returns `{registered: true}`. No username or client-supplied account ID is used.
The server must pin the installation before registration; there is no automatic
first-device enrollment. A trusted administrator can seed the verified phone with
the service-only `register_issue_activity_push` RPC using the same three values.

For initial enrollment, open the updated app as Portego on the physical iPhone.
Read `Documents/issue-activity-push-installation.json` from that phone's trusted
app container and set the approved installation secret to its `installationId`.
The file contains only the installation UUID, never account or push tokens.
Foreground the app again to complete registration. The authoritative UUID is
stored in SecureStore with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; other devices
generate their own IDs and fail the eligibility check before requesting a token.

The legacy activity tables are removed from the `supabase_realtime` publication.
Older app builds used those events to create local notifications on every signed-in
owner device. Removing only those four publication entries stops that legacy
path; the new database INSERT triggers continue sending to the approved iPhone.

Once registered, another phone cannot replace the destination. Replacing the
physical phone requires deliberately changing the approved installation secret
and the private destination record. Token rotation on the same approved
installation is automatic.

## Delivery and verification

Processing accepts an empty JSON object and the `x-issue-activity-secret` header.
It reads all content and the destination from private database state. Clients
cannot pass notification events or a recipient to that endpoint.

Claims use row locking, unique source event IDs, five-minute leases and a claim ID
checked at completion. Expo tickets are retained and receipts are checked after
15 minutes. A successful receipt means APNs accepted the message, not proof that
the user saw it. `DeviceNotRegistered` disables only the exact token that failed;
an old receipt cannot disable a newly rotated token. Transient send failures back
off up to eight attempts. Unavailable receipts are polled without resending and
stop after 24 checks. A confirmed rate-limited receipt retries the failed send
within the same eight-attempt budget. Completed, failed and skipped queue rows
expire after 30 days.

Delivery is at least once: if Expo accepts a push but the worker fails before its
ticket is persisted, lease recovery can send a duplicate. Normal repeated
webhooks and concurrent workers do not duplicate an already claimed event.

Run `deno test supabase/functions/issue-activity-push/index_test.ts` for endpoint,
identity, recipient, retry and receipt coverage. Run `migration_test.sql` as an
administrator for functional database coverage. It wraps every fixture and
pg_net request in a rolled-back transaction and sends no test pushes.

Primary implementation references:
[Expo push tickets and receipts](https://docs.expo.dev/push-notifications/sending-notifications/)
and [Supabase Vault-authenticated scheduling](https://supabase.com/docs/guides/functions/schedule-functions).

Run `owner_activity_test.sql` with the approved phone configured to verify that
all four owner activity types are both enqueued and claimed for delivery. It
rolls back all fixtures and network requests.
