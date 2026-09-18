# LedgerLab

A fictional finance job for practising the work of a financial accountant: process source documents, reconcile balances, prepare a close and explain the result.

## Start here

**Current source release: Workstation 3.1.0, Clearer Daily Workspace.** Open `public/offline/LedgerLab-Workstation-v3.1.html` in a desktop browser. No installation or external scripts are required. The earlier v3 HTML is retained as a clearly named historical build.

The hosted application has **not** been deployed from this release. Repository source, standalone HTML and the privately hosted app are separate delivery surfaces. Do not assume a GitHub commit updates the live site.

[Daily-work guide](docs/current/guide.md) · [Executed verification and limits](docs/current/verification.md) · [Architecture](docs/architecture/README.md) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

## Find your work

| Section | Purpose |
|---|---|
| Today | Start with the next available assignment, arrivals and waiting items. |
| Work | Journals, receivables, payables, bank, payroll, assets, inventory and tax. |
| Close | Month-end controls, provisions, audit support and training review notes. |
| Reports | Company overview and financial statements from your actual ledger. |
| Files | Read-only source evidence and editable supporting workpapers. |
| Learn | Accounting explanations and targeted practice. |
| Settings | Case setup, notebook and backups. |

Use **Ctrl+K** or **Cmd+K** to search apps, available assignments, source documents, actual journals, account activity and lessons. Search never releases future evidence. **Open evidence + work** arranges an assignment's supporting document beside its working area. **Why is this on my desk?** explains the responsibility and required output without posting an answer.

## What remains intact

The existing integer-cent accounting engine, generated source evidence, AP/AR, bank reconciliation, payroll, assets, inventory, provisions, tax schedules, financial statements, workpapers, deterministic day-by-day case and existing save/backup controls are preserved. All 19 existing route IDs and 18 accounting applications remain available through a shared app registry.

Review responses add a training workflow with original findings, response history and stale-clearance detection. They do not impersonate an independent reviewer, grade freeform professional judgement, post entries or override the existing month-close controls.

## Develop and verify

Use Node 22.13 or newer, Python 3 and the checked-in lockfile in an environment that can access the package registry.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Dependency-light checks with an existing TypeScript compiler and Node declarations:

```sh
npm run test:portable
npm run typecheck:standalone
node scripts/desktop/bundle.mjs public/offline/LedgerLab-Workstation-v3.1.html
```

See the verification record for actual executed browser commands and for the separate full-application and hosting checks. Syntax transpilation and standalone type checking are not a production build.

## Protect your practice

Export a backup before replacing a case or moving to another HTML version/browser. Browser-local storage is origin-dependent; **Preview memory only** means a downloaded backup is essential. A saved spreadsheet does not post a journal or submit an assignment. Original source evidence remains read-only.

## Scope

This is a fictional, single-entity AUD calendar-2025 training simulator, not live banking, payroll, tax filing or statutory reporting software. Dated teaching assumptions remain unchanged. One accounting month is open at a time. Operating years after 2025, consolidation, operational FX, real reviewer identities and live approvals are not implemented in this cleanup. Full statutory comparative evidence and independent narrative grading are not supplied.

[Historical specifications and handoffs](docs/archive/README.md) preserve prior capabilities, accounting assumptions and verification records without competing with the current start page.
