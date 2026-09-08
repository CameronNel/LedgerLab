# Workstation v2.1 month review: executed verification

7 September 2026. Results below were executed against this continuation. Assertion counts are test coverage indicators, not a guarantee of completeness or professional competence. The hosted application was not changed.

## Delivered local app

`LedgerLab-Workstation-v2.1.html` bundles 27 production/fixture modules and the working local UI. It is not a screenshot mockup or a compiled copy of the full React application.

HTML bytes: **646,593**. SHA-256: `5e07430dcc763066755d03d2a8897dfc3b39110813beb1ce7a36601cabfe68e2`.

## Domain and production persistence

Executed `node scripts/accounting/run-portable.mjs` with Node v22.16.0 and TypeScript 5.8.3.

| Suite | Assertions passed |
|---|---:|
| New month assessment and feedback | 218 |
| Accounting, five generated cases | 7,938 |
| Workflow, import, state and close controls | 352 |
| Production persistence, validation and SQLite concurrency | 278 |
| Takeover, full-year progression, forecasts and close | 30,184 |
| Desktop, evidence gating, files and production API | 32,935 |
| Workbook calculation, reference editing, XLSX and compatibility | 233 |
| **Total** | **72,138** |

The new assessment suite exercises missing sources, wrong amounts/accounts/dates/contacts/source links, duplicates, sign reversals, valid split postings and net reversal/replacements, draft numerical differences, swapped equal-value bank matches, closed-history exceptions, unreleased-month boundaries, both roles for each of the twelve starting months, and a complete reviewed year. The reviewed full-year state serialized to 439,995 bytes. The earlier career full-year regression cases still processed 774 and 776 learner journals and 147 role deliverables each.

History tests cover computation from actual saved data, read-only checking, idempotence, stale content stamps, stable object ordering, ignoring read-mail changes, retained-history bounds, validation, backup compatibility and escaped export text. Nine additional production persistence assertions cover API save/reload, no auto-posting, repeat submission and invalid receipt rejection. SQLite is real in-memory SQLite behind the production request/session handlers, not a hosted D1 or identity-provider end-to-end test.

## Chromium UI

**175 interaction assertions passed:** 54 new month-review checks, 107 existing workstation checks and 14 clipboard/formatting checks. All three ran on the final rebuilt HTML. There were no uncaught page exceptions in these runs.

The new suite uses real buttons, dialogs, DOM edits and browser downloads. It verifies the start-screen route; active-month selection; check/submit/cancel semantics; wrong and missing fields; revealed differences and correction directions; source links and close buttons; saved-only grading with unsaved fields retained; search/show-passed controls; static HTML export; stale feedback and resubmission; no duplicate reviews; and a deliberately lost acknowledgement followed by reload and recovery. It also restores a fully solved test fixture, passes automated gates, closes through the UI and releases August without unlocking its answers. Submission and window closing were checked at an 850-pixel viewport.

Existing regression suites recheck spreadsheet editing, formulas, save/reopen, imports/exports, cut/copy/paste, dirty-close confirmations, lost save responses, journal/invoice processing, matching, forecasts, backups, and 800-pixel controls. These tests use Playwright `set_content` and the app's browser-memory storage fallback because browser navigation is restricted in this environment. They do **not** verify the user's file-origin localStorage behaviour or operating-system clipboard policies. Production persistence is tested separately above.

The month-review screen was visually inspected, including a final adjustment to avoid scrolling its heading underneath the sticky status message.

## Compilation and source checks

- Strict TypeScript check of the dependency-free local entry point and imported graph passed.
- All **143 TypeScript/TSX source files** passed syntax/transpilation diagnostics. This is not a full application semantic typecheck.
- The self-contained HTML rebuilt successfully from the edited source.
- Source manifest and deterministic packaging are checked separately in `tests/verification-month-review/package.json`.

Raw logs/results are retained in `tests/verification-month-review/`. Solved fixture backups used by browser tests are generated into temporary output paths and are not shipped as user practice work.

## Reproduce

From the source root, with the required compiler/Node type definitions and Playwright/Chromium already installed:

```sh
node scripts/accounting/run-portable.mjs
# The targeted suite is also available as npm run test:review.
tsc --noEmit --strict --target ES2022 --moduleResolution node --module commonjs --skipLibCheck scripts/desktop/preview.ts
node scripts/desktop/bundle.mjs /tmp/LedgerLab-Workstation-v2.1.html
LEDGERLAB_REVIEW_FIXTURE=/tmp/ledgerlab-review-solved.json node scripts/accounting/run-portable.mjs review
python scripts/desktop/check-month-review.py /tmp/LedgerLab-Workstation-v2.1.html /tmp/ledgerlab-review-solved.json /tmp/ledgerlab-review-browser
python scripts/desktop/check-workstation.py /tmp/LedgerLab-Workstation-v2.1.html /tmp/ledgerlab-workstation-browser
python scripts/desktop/check-clipboard.py /tmp/LedgerLab-Workstation-v2.1.html /tmp/ledgerlab-clipboard-browser
```

Set `CHROMIUM` when the executable differs from `/usr/bin/chromium`. Generated solved fixtures are test inputs, not human practice submissions. The standard installed-dependency test runner also includes the review suite; that esbuild/React runner was not executed in this environment.

## Not verified or not claimed

The locked full React/Vinext dependency install, full application semantic typecheck, React integration tests and production build were not executed in this continuation. No hosted deployment, permissions or repository publication was changed. Cross-browser and user-machine persistence remain unverified. The earlier independent XLSX-engine checks were not repeated this turn; existing workbook/browser regression suites were rerun.

No automatic grading of arbitrary spreadsheet formulas/cells, professional narrative quality, forecast realism or complete statutory AFS has been added. Objective/completion pass counts must not be presented as a professional qualification, a tamper-proof exam grade, or proof that every possible financial-accountant/manager task was done correctly.
