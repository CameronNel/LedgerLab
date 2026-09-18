# Offline transactional saves

The 18 September 2026 storage repair supersedes earlier guidance about Web Locks around localStorage. Production React still uses the authenticated server and its existing concurrency controls.

The standalone now uses IndexedDB on persistent browser origins. Reading the current revision, applying a validated accounting command, and writing the payload and next revision take place inside one read/write transaction. A save is acknowledged only on transaction completion. A failed put or aborted transaction leaves the previous payload and revision intact. BroadcastChannel provides notifications only; it is not relied on for correctness.

On first use, the existing validated localStorage envelope is migrated in the same transaction. Its original bytes are retained, not deleted or overwritten. Subsequent sessions use the database record, not the older migration copy. Do not alternate between old and new builds expecting their separate stores to synchronize; transfer an exported backup explicitly. Export a backup before upgrading.

If the database is blocked or unavailable, the app reports it instead of silently acknowledging a memory-only write. Opaque preview origins retain the explicitly labelled memory-only mode. Browser storage remains tied to the browser profile and origin; backups are necessary. Clearing all site storage can remove both the database and the legacy recovery copy.

A missing or corrupt payload opens recovery rather than a fresh case. Recovery requires a validated backup or an explicit new-case choice plus REPLACE SAVED DATA. A separate revision record prevents recovery from reusing a revision held by a stale tab. Regular imports and new-case commands also go through the same transaction boundary.

Tests cover repeated competing writers, operation without Web Locks, quota failure, abort after a successful put, lost acknowledgements, browser restart, migration with the legacy copy preserved, corrupt/missing records and stale writes after recovery. See the completed CI run for execution results, rather than treating this description as proof that tests ran.

Technical basis: the HTML Standard's Web Storage section does not define cross-agent-cluster locking semantics (https://html.spec.whatwg.org/multipage/webstorage.html). IndexedDB provides the transaction boundary used here (https://www.w3.org/TR/IndexedDB/).
