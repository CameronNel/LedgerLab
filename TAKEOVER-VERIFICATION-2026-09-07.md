# LedgerLab finance takeover: verification record

## Scope

Verified the edited source against the uploaded `LedgerLab-continuation-2026-09-07.zip`.
No hosted app, remote repository, production authentication, migration or user data was
modified. Historical tests reported in older documents are not current UI/build results.

Runtime: Node 22.16.0, global TypeScript 5.8.3, local Node declaration fallback and Python.
The locked application dependency versions and `package-lock.json` are unchanged. The
React/Vinext dependencies were unavailable; registry DNS/network access prevented their
installation. This is not yet a fully browser/build-verified release.

## Executed regression suites

| Suite | Passed assertions |
| --- | ---: |
| Existing numerical accounting cases, five seeds | 7,938 |
| Existing workflow/import/reversal/validation/schedule controls | 352 |
| Production persistence/session/API and local SQLite, extended for takeover | 269 |
| New takeover/source-boundary/progression/reporting/forecast suite | 30,184 |
| **Total** | **38,743** |

The portable runner strictly compiled these suites and their actual domain/session/API
imports with `noEmitOnError`. The suites passed before packaging. The SQLite experimental
warning is a runtime warning, not a failed assertion. This does not execute hosted D1.

### Takeover coverage

- All 12 starting months across three seeds, inherited/current/future boundaries,
  double entry, immutable source references and complete historical source contents.
- Two complete manager careers, January–December: seeds 42 and 271828. They posted
  774 and 776 learner journals respectively, each with 147 role deliverables and
  12 forecasts. These are automated test fixtures, not work completed by a human.
- Every monthly close and release, source-linked grading without exercise tags,
  independent solved ledger comparison, bank matching, statement open items,
  inventory valuation, report cutoff and withheld interim annual notes.
- All three messy-handover corrections; stale submission/forecast invalidation;
  malformed and forged closed-state backups; early close/advance and lock bypasses.
- Source invoice capture, duplicate rejection, reversal/replacement, additional custom
  invoice creation and atomic rejection without mutating the original state.
- Forecast cents, arithmetic, collection-delay/shortfall timing, saved evidence and
  HTML escaping. Qualitative business judgement is not scored by these tests.
- The production API/session running against real local SQLite saved and reloaded a
  takeover, a captured invoice, role drafts and forecast drafts; invalid future/source/
  nested commands were rejected without advancing the saved revision.

### Additional executed checks

All 124 TS/TSX source files passed syntax-only transpilation. This is not a complete
application typecheck. The offline export driver was separately strictly compiled and
executed against a July takeover backup. Its reporting cutoff, source documents, payroll,
bank filenames and portfolio were checked for the active period and absence of future
monthly files or an unrequested worked-answer folder.

Python source/browser scripts and shell scripts received syntax checks. The source ZIP
has unique safe member paths and a complete SHA-256 manifest, excludes dependencies,
credentials and local exports, and rebuilds identically outside Git. The changes-only
patch was checked against a clean copy of the uploaded baseline, not a live remote branch.
See the accompanying package-check output for the exact final source-file count.

## Not executed or not established

The full application `npm run typecheck`, normal `npm test` including React SSR,
`npm run lint`, production `npm run build`, and Playwright interactions remain unverified
because the required application dependencies were unavailable. The extended SSR and
loopback-only browser drivers are supplied but their new UI tests are not reported as
passing. No screenshot of a running React takeover application was produced.

No live hosted identity or deployment test, external payment, tax/payroll filing or
real-world statutory-compliance verification was performed. No deployment was made.
UI interactions, responsive layouts, assistive-technology behaviour and integration
with the existing private publication require a full follow-up check before publishing.

## Reproduction

With a compatible TypeScript compiler and Node declarations already installed:

```bash
node scripts/accounting/run-portable.mjs
```

With the locked full application dependencies installed in the intended environment:

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
```

Then run the local-only browser driver according to `scripts/browser/README.md`. Do not
weaken production authentication or run its local fixture configuration against a hosted
site. Source packaging and archive verification:

```bash
python scripts/accounting/package-source.py
python scripts/accounting/package-check.py
```

The source-only ZIP deliberately excludes installed dependencies and generated production
bundles. The patch applies to the uploaded continuation snapshot, not automatically to an
uninspected newer repository state.
