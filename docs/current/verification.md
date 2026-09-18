# Workstation 3.1: executed verification

18 September 2026. Baseline GitHub main: `4078d7fbf098c7c0e69848303f15b5bc41e59f6f`. Before editing, the recovered source produced Git tree `dba4e14a6158e15945f4d93f2104ca29c152ee89`, exactly matching GitHub. The financial engine was not changed.

## Executed checks

| Scope | Passed assertions |
|---|---:|
| Existing day-by-day, month-review, accounting, workflow, persistence, career, desktop and workbook suites | 76,823 |
| New navigation, search boundaries, review histories, stale clearances, backup compatibility and file limits | 87 |
| Existing four Chromium workstation/day/review/clipboard suites | 243 |
| New workspace Chromium journey | 39 |

These are assertion counts, not independent real-world accounting scenarios or certifications. All five completed Chromium drivers reported no uncaught page errors. Screenshots of Today, search, paired evidence/work, review notes and narrow search were inspected.

Environment: Node 22.16.0, globally available TypeScript 5.8.3, Python 3 and Chromium. This compiler differs from the full-app lockfile's compiler version.

```sh
node scripts/accounting/run-portable.mjs
# Generate private test fixtures for browser drivers, never into public/offline:
LEDGERLAB_DAY_FIXTURE=/tmp/daily.json node scripts/accounting/run-portable.mjs workday
LEDGERLAB_REVIEW_FIXTURE=/tmp/review.json node scripts/accounting/run-portable.mjs review
tsc -p tsconfig.standalone.json
node scripts/desktop/check-source-syntax.mjs
node scripts/desktop/bundle.mjs /tmp/LedgerLab-Workstation-v3.1.html
python scripts/desktop/check-workspace.py /tmp/LedgerLab-Workstation-v3.1.html /tmp/daily.json /tmp/workspace-check
python scripts/desktop/check-workday.py /tmp/LedgerLab-Workstation-v3.1.html /tmp/daily.json /tmp/workday-check
python scripts/desktop/check-workstation.py /tmp/LedgerLab-Workstation-v3.1.html /tmp/workstation-check
python scripts/desktop/check-month-review.py /tmp/LedgerLab-Workstation-v3.1.html /tmp/review.json /tmp/month-check
python scripts/desktop/check-clipboard.py /tmp/LedgerLab-Workstation-v3.1.html /tmp/clipboard-check
```

Strict standalone type checking and first-party source syntax transpilation passed. Neither resolves or verifies the React application. The standalone bundle has 40 imported production/adapter modules, no external runtime scripts and no new runtime dependency.

## Failure paths exercised

Search excludes future payroll and task-answer fields and restores keyboard focus. Paired opening does not post journals. Review clearance requires a passing underlying task; later work invalidates the clearance without deleting response history. Backup import into a second tab restores responses. Failed, stale or lost-acknowledgement saves retain drafts. Switching assignments and closing dirty windows cannot silently discard work. A replaced case retains its orphaned response for download. Oversized or malformed review files fail rather than being truncated or overwritten.

A populated-search Escape-key issue was found by the new browser driver, fixed, and the complete 39-assertion driver rerun successfully.

## Not verified or not delivered

`npm run typecheck` was attempted but failed because full React/Next/Vinext and other locked dependencies are absent. This is not a full-app typecheck pass. The production build and hosted end-to-end smoke tests remain outstanding. No authentication, D1 binding or deployment audience was changed; the hosted app was not updated.

Browser tests use `page.set_content`, real DOM interactions, actual session commands, memory fallback and explicit backups. They do not establish durable file-origin storage across browser restarts, native Microsoft Excel compatibility or real multi-user reviewer permissions.

Rolling years, overlapping posting periods, purchase-order/payment runs, FX, consolidation, unrestricted AI correspondence and independent professional-judgement assessment were not added.
