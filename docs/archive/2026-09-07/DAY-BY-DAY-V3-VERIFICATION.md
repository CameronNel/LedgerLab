# Day-by-Day Workstation v3: executed verification

7 September 2026. This record describes checks actually executed for the downloadable source and standalone HTML. It does not claim the hosted app was modified, or that a full React/Vinext production build passed.

## Domain and production API checks

| Executed suite | Assertions passed |
|---|---:|
| Daily availability, deadlines, controls, state/backup and annual progression | 4,652 |
| Month-review assessment, receipt, feedback and progression | 218 |
| Accounting across five generated cases | 7,938 |
| Posting/workflow/import/state controls | 352 |
| Persistence, notebook, request validation and SQLite concurrency, including daily state | 311 |
| Takeover, source boundaries, forecasts and annual close progression | 30,184 |
| Desktop catalogue, source gating, files, worksheets and production API | 32,935 |
| Workbook calculations, references, templates and XLSX/state regression | 233 |
| **Total executed domain/API assertions** | **76,823** |

Commands used the dependency-free runner with Node.js v22.16.0 and the available TypeScript 5.8.3 compiler. Suites were run both in groups and individually; the first combined runs reached the command time limit. Every listed suite subsequently completed successfully. Counts are per completed suite, not repeated-run totals. They are assertions, not that many independent business scenarios.

```bash
LEDGERLAB_DAY_FIXTURE=/tmp/daily-fixture.json node scripts/accounting/run-portable.mjs workday
LEDGERLAB_REVIEW_FIXTURE=/tmp/month-fixture.json node scripts/accounting/run-portable.mjs review
node scripts/accounting/run-portable.mjs check workflows persistence
node scripts/accounting/run-portable.mjs career
node scripts/accounting/run-portable.mjs desktop workbook
```

The daily annual run completed **12 accounting closes**, with **776 learner journals, 1,453 task instances and 139 daily management/onboarding responses**. The final serialized saved state was **697,682 bytes**, below the existing 1.5 MB state cap. Two existing monthly-manager annual runs also passed: 774 and 776 learner journals, with 147 formal deliverables each.

The annual daily fixture advances to each close window and then processes/assesses the available work. It is not a 365-day browser exercise, a human-quality assessment of 139 narratives, or a financial qualification.

New API coverage uses the **actual production request/session handlers and real in-memory SQLite**, including persisted daily dates, responses, date logs, incorrect/correct submissions, reload/restore, malformed commands, unavailable transactions and conflicting clock changes from stale tabs. It does not emulate the production identity provider or deploy to Cloudflare D1.

## Real Chromium interaction checks

| Executed browser driver | Assertions passed |
|---|---:|
| `check-workday.py` | 68 |
| `check-workstation.py` | 107 |
| `check-month-review.py` | 54 |
| `check-clipboard.py` | 14 |
| **Total Chromium interaction assertions** | **243** |

All four completed with **zero uncaught page errors**. Browser coverage includes onboarding, exact task navigation, genuine posted commands, invalid amount retention, incorrect/correct response feedback, Save/Discard/Cancel, clock acknowledgement, date-delivered evidence, hidden future payroll, weekly as-of exports, blocker/control replies, unsaved accounting-form guards, lost acknowledgements, newer-response conflict handling, next-calendar-month close, backup restoration and narrow-screen controls. It also retains the prior spreadsheet, export/import, clipboard, formatting, month-review and repeated close-button checks.

The legacy workbook/month-review drivers explicitly select a monthly fixture. The new daily driver verifies the new product default. Tests were adjusted to recognise intentionally preserved expanded deliverables rather than toggling them closed before filling them. A focus-order bug discovered during the legacy regression was fixed in the product: closing returns focus to the most recently used remaining window.

The managed Chromium environment blocks file navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. The drivers therefore use `page.set_content`, real DOM/session commands, the declared memory fallback, workspace reload and explicit backup restoration into another tab. These tests **do not establish durable file-origin browser storage across browser-process restarts**. Browser storage failures are visibly labelled; backups remain necessary.

The new Today, scenario-mail, close-week and narrow-screen screenshots were visually inspected. Source documents are still sandboxed read-only views. Form/workbook pending edits and failed saves retain their data.

## Compilation, bundling and packaging

`tsc -p tsconfig.standalone.json` passed strict type checking of the standalone's imported TypeScript graph. The dedicated configuration excludes unrelated implicit type packages and uses DOM/ES2022 libraries; it does not type-check React screens.

`node scripts/desktop/check-source-syntax.mjs` passed syntax transpilation for **148 first-party TS/TSX files**. This is explicitly not dependency-resolved application type checking.

`node scripts/desktop/bundle.mjs` built the operational standalone from **30 local production/adapter modules**, with no external runtime scripts or credentials. Its file size is 759,880 bytes. The delivered standalone and the copy in `public/offline` are identical.

The source archive is produced by `scripts/accounting/package-source.py` and checked with `package-check.py`: unique safe paths, source-only inventory, hashes, executable script modes and byte-identical rebuilding from the extracted manifest without Git. Generated solved fixtures and personal test backups are not included in the source inventory. Earlier explicitly labelled offline practice/answer resources remain historical assets, not daily in-app evidence.

## Not verified in this pass

The full dependency-backed React application typecheck, render suite, production build and hosted end-to-end smoke tests remain outstanding. A bounded `npm ci` did not complete; a direct registry probe failed DNS resolution for `registry.npmjs.org`. Partial dependency directories are not distributed. The original lockfile was not changed. The standalone used the available TypeScript 5.8.3, not the locked full-app TypeScript 5.9.3.

An additional independent spreadsheet-engine import was attempted but its runtime daemon did not start before timeout. No independent-engine or native Microsoft Excel verification is claimed for this continuation. The Chromium suite did pass actual XLSX export, ZIP-content assertions and re-import into the workstation.

No live mail, banking, payroll submission, current tax-rule validation, statutory filing calendar, public holidays, multiple concurrent posting periods, unrestricted AI correspondence or independent professional-judgement marking was added. Completion of automated checks is not professional approval. See the guide for the one-open-period/backlog limitation and the dated AUD teaching assumptions.
