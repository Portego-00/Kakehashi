# Community security boundary

The web community backend reads Supabase configuration only in server modules. In development, the native app's public URL and anonymous key can be used to exercise its existing community policies; without Supabase configuration, development and tests use the ignored `web/.data/community.json` store. In production, an anonymous key enables read-only community access. Browser-facing code never receives that key from the web community route.

Production writes require `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`). Without a server secret, the UI deliberately reports the community as read-only and mutation requests fail closed.

Apply `supabase/migrations/20260807000000_community_atomic_mutations.sql` before enabling writes. It provides service-role-only RPCs for idempotent comments and atomic like toggles, unique like constraints, and a receipt table whose RLS policy grants no client access.

The existing community tables should have RLS enabled. Browser roles should retain only the reads the product intentionally exposes and must not receive `INSERT`, `UPDATE`, or `DELETE` policies. All web mutations pass through the same-origin, size-limited, rate-limited server route, which verifies the current WaniKani identity before calling the service-role RPCs. If the mobile client is migrated to this server route, remove any legacy anonymous write policies at the same time.
