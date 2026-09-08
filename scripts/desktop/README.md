# Operational local workstation and browser checks

`bundle.mjs` builds the real desktop, accounting engine, local accounting workflows, spreadsheet editor and day-by-day desk into one HTML file. `preview.ts` adapts the existing WorkspaceSession to local browser storage, with an explicitly labelled memory fallback. It does not connect to, authenticate with or update the hosted application. The original `check-browser.py` is historical pre-workstation coverage; use the drivers below for the current version.

```bash
node scripts/desktop/bundle.mjs ./outputs/LedgerLab-Workstation-v3-Day-by-Day.html
tsc -p tsconfig.standalone.json
node scripts/desktop/check-source-syntax.mjs
LEDGERLAB_DAY_FIXTURE=./daily-fixture.json node scripts/accounting/run-portable.mjs workday
LEDGERLAB_REVIEW_FIXTURE=./review-fixture.json node scripts/accounting/run-portable.mjs review
python scripts/desktop/check-workday.py ./outputs/LedgerLab-Workstation-v3-Day-by-Day.html ./daily-fixture.json ./outputs/daily-checks
python scripts/desktop/check-workstation.py ./outputs/LedgerLab-Workstation-v3-Day-by-Day.html ./outputs/workstation-checks
python scripts/desktop/check-month-review.py ./outputs/LedgerLab-Workstation-v3-Day-by-Day.html ./review-fixture.json ./outputs/review-checks
python scripts/desktop/check-clipboard.py ./outputs/LedgerLab-Workstation-v3-Day-by-Day.html ./outputs/clipboard-checks
```

Do not distribute generated solved fixture JSON or personal backups. Source packaging uses its manifest inventory rather than recursively including arbitrary exports.

The browser scripts use real Chromium through Python Playwright. Set `CHROMIUM` when its executable is not `/usr/bin/chromium`. This verification environment blocks browser file navigation, so the drivers use `set_content`. They test actual DOM interactions, real session commands, declared memory fallback, workspace reload and explicit backup restoration. They do not prove browser-local persistence across process restarts. Separate production-handler tests use actual in-memory SQLite.

The month-review and older workbook driver explicitly start a monthly fixture. The daily driver tests the new default and date-dependent workflow; a fixture choice is not a claim that the product remains monthly-only.

Standalone graph type checking and whole-source syntax transpilation do not replace the full React application typecheck, render tests, build or hosted smoke tests. See the current root verification report.
