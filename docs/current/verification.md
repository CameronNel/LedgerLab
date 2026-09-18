# Workstation 3.2: verification and delivery record

18 September 2026. Second-pass baseline: `f1b7f316da2028316b013c05ec3bf2403e7a92a8` on `ux/clearer-daily-workspace`. The recovered local source tree matched GitHub tree `36de823d2ef5397f5af110076386e1a4271ed5e4` before editing. The previous 3.1 full application CI run `35318230562` completed successfully; its build limitation is historical, not a claim about 3.2.

## Executed local checks

| Scope | Passed assertions |
|---|---:|
| Existing daily, monthly review, accounting, posting, persistence, career, desktop, workbook and 3.1 workspace checks | 76,910 |
| New strict money parsing, offline storage/recovery, triage/pagination, mail, search and ledger diagnostics | 96 |
| Existing five Chromium suites | 282 |
| New clarity/safety Chromium journey | 45 |

Total local domain/API assertions: **77,006**. Total local browser assertions: **327**. These are checks, not that many independent real-world scenarios or professional certifications. All six completed browser drivers reported no uncaught page errors. Strict standalone compilation and syntax transpilation of 165 first-party TS/TSX files passed. The current standalone bundles 46 production/adapter modules without external runtime scripts or new runtime packages.

Local environment: Node 22.16.0, TypeScript 5.8.3, Python 3 and Chromium. The full dependency-backed application uses its locked compiler, not this global standalone compiler.

```sh
LEDGERLAB_DAY_FIXTURE=/tmp/daily.json LEDGERLAB_REVIEW_FIXTURE=/tmp/review.json \
  node scripts/accounting/run-portable.mjs
tsc -p tsconfig.standalone.json
node scripts/desktop/check-source-syntax.mjs
node scripts/desktop/bundle.mjs /tmp/LedgerLab-Workstation-v3.2.html
python scripts/desktop/check-clarity.py /tmp/LedgerLab-Workstation-v3.2.html /tmp/clarity-check
python scripts/desktop/check-workspace.py /tmp/LedgerLab-Workstation-v3.2.html /tmp/daily.json /tmp/workspace-check
python scripts/desktop/check-workday.py /tmp/LedgerLab-Workstation-v3.2.html /tmp/daily.json /tmp/workday-check
python scripts/desktop/check-workstation.py /tmp/LedgerLab-Workstation-v3.2.html /tmp/workstation-check
python scripts/desktop/check-month-review.py /tmp/LedgerLab-Workstation-v3.2.html /tmp/review.json /tmp/month-check
python scripts/desktop/check-clipboard.py /tmp/LedgerLab-Workstation-v3.2.html /tmp/clipboard-check
```

## Failure cases exercised

Malformed money grouping is rejected without changing raw input or saving a response. Valid grouped currency is saved as exact cents. Search/page changes preserve typing and clamp invalid pagination. Review and daily-response drafts survive unrelated refreshes; restoring even the same case makes an older draft stale. The native close dialog contains keyboard focus, prevents background focus and preserves the draft on Escape. Outgoing mail does not count as incoming unread work. Read-only ledger diagnostics and their CSV export do not change saved accounting state.

Domain tests cover corrupt storage, explicit recovery confirmation, blocked/quota writes, removed saves, invalid envelopes, defensive copies and existing state-size limits. Diagnostics cover legitimate reversals, source references, account/contact validity, suspense, unreleased bank evidence and refusal to access worked-solution data. Screenshot inspection caught a clipped narrow-screen backup control; the layout was corrected and a viewport-bound assertion added.

## Actual-origin persistence and hosted CI

The new `scripts/desktop/check-local-storage.py` serves the generated app on an isolated localhost origin with a temporary Chromium profile. It tests actual localStorage, page reload, browser-process restart, quota errors, competing same-revision tabs, corrupt startup, raw-data recovery download and explicit backup restore. It never touches a real user's browser profile or backups.

This local managed Chromium blocks localhost navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. That test is therefore delegated to the repository's GitHub CI environment, not replaced with a memory-only claim. The CI job also reruns the six UI suites. Its separate full-application job executes `npm ci`, `npm run typecheck`, `npm test` (now including workbook and clarity suites) and `npm run build`. Consult the commit's Actions results or the follow-up verification entry below for the terminal CI outcome.

## Delivery and limits

The current checked-in standalone is `public/offline/LedgerLab-Workstation.html`. The old 3.1 generated bundle is removed from the current source inventory, not erased from Git history. The original named v3 fallback is retained. The source pack has a complete SHA-256 inventory and is checked for safe unique paths and byte-identical rebuild outside Git.

No hosted deployment, authentication change, schema migration, new statutory rate, live email/payment integration, consolidation, FX or parallel posting periods is included. All case assumptions remain the fictional AUD 2025 assumptions. The parser tightens invalid input, not financial calculation rules.

Memory-only UI checks do not establish persistent storage. Localhost profile-restart checks do not establish every browser's `file://` policy. Web Locks provide stronger cross-tab exclusion only where supported. Regular backup export is still necessary. Native Excel fidelity, real independent reviewer authority, freeform professional judgement and complete statutory AFS remain outside these tests.
