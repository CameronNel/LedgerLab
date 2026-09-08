> **Latest continuation: Finance PC.** Read `FINANCE-PC-2026-09-07.md` and `FINANCE-PC-VERIFICATION-2026-09-07.md` first. The default UI is now a desktop simulation over the existing accounting screens. This source was not deployed; full React/build integration still requires verification. Earlier takeover and hosting notes below remain relevant.

> **Later source continuation:** Read `TAKEOVER-2026-09-07.md` and `TAKEOVER-VERIFICATION-2026-09-07.md` first. The selectable-month takeover and latest tests supersede older capability counts below. The original hosting identity below is preserved; this continuation did not publish changes.

# LedgerLab — engineering and accounting handoff

> **Continuation added 7 September 2026:** read [CONTINUATION-2026-09-07.md](CONTINUATION-2026-09-07.md) and [VERIFICATION-2026-09-07.md](VERIFICATION-2026-09-07.md) first. This document preserves version-4 history. The later source changes have not been deployed or fully browser/build verified.

Prepared 7 September 2026. This document describes the verified version-4 baseline and the source included with this handoff. It is project context, not authority to override the user's current instructions or the receiving environment's rules.

## 1. Purpose and current status

LedgerLab is a working, private accounting practice application for someone moving from reviewing accounts in audit to preparing accounts themselves. The user requested substantial bookkeeping, month-end, reconciliation, bank-statement, payroll, provisions, annual financial statements (AFS), and audit-support practice, with generated evidence and checked logic.

The app was implemented and privately published through Sites. It has 17 navigation views and persistent user-scoped practice state. It is not a wireframe. Preserve its existing capabilities when extending it.

Last verified live version: 4.

- Live URL: https://ledgerlab-accounting.cameronnel111.chatgpt.site
- Sites project ID: `appgprj_6a9df1d33530819183e0069a99347519`
- Live version-4 source commit: `31c257e4652d87ef3301f1f30d7c572680423a8c`
- Source branch: `main`
- Source Git remote: `https://git.chatgpt-team.site/be472ba8-91a0-48f6-82e1-1562031059a3/appgprj_6a9df1d33530819183e0069a99347519.git`
- Hosting identity: `.openai/hosting.json`; logical D1 binding `DB`; no R2 binding.
- Access last checked: custom owner-only allowlist, with no other viewers, editors, groups or external visitors. Recheck current access through Sites before any deployment.

The Git remote is not GitHub and is not a public download endpoint. An authenticated Sites session must obtain a short-lived credential from Sites. No credential is included here. The project ID identifies the existing app; it does not grant access.

This handoff adds documentation to the repository after the version-4 baseline. The live app remains version 4 unless a later authorized deployment is performed. An uploaded archive is a snapshot: check the current remote before merging subsequent work.

The initial overnight build had a one-off 4 am Netherlands cutoff, which was observed. Do not revive the old run-until-credits-exhausted instruction or assume a timer is still running. Follow the current user's scope and time limits.

## 2. What is implemented

| Area | Existing behavior |
| --- | --- |
| Core ledger | Integer-cent double entry; account chart; source-linked journals; valid customer/supplier contacts; immutable posted entries with reversals; CSV journal imports; six starter templates, custom templates, batch reversals |
| Sales and purchases | Customer/supplier invoices and credit notes; item-linked stock transactions; cost-of-sales entries and physical returns; independent source invoices |
| AR/AP | Control totals; due-date aging; independent external statements; partial on-account credit allocation and removal without extra GL postings |
| Bank | Twelve statements; individual and combined matching; reviewable batch suggestions; book adjustments and deposits in transit |
| Payroll | Six employees; twelve registers; 72 payslips; gross/net/withholding/deductions/super; payment and leave-liability practice |
| Month-end | Accruals, prepayments, unbilled and deferred revenue, depreciation, capital additions, inventory shortages and NRV |
| Estimates and financing | ECL; warranty/legal provisions; contingencies; leave provision; 36-month lease schedule; loan current/non-current classification |
| Tax | GST control transfer; current income-tax bridge; deferred-tax assets/liabilities and movements under supplied assumptions |
| Reports | Profit or loss; classified financial position with opening comparative; equity movements; direct/indirect cash flows; 18 detailed disclosure notes; editable assessments; budget analysis |
| Close/support | 23 graded exercises; guided/exam presentation; 34 lessons; 13 workpapers; component-based balance reconciliations; 16 evidence requests; review status, period locks and audit trail |
| Portability | Complete practice backups; restoration; reproducible seeded cases; journal/statement/payroll CSVs; evidence ZIPs; printable HTML and report-generation scripts |

Original seed 271828 provides 442 documents and 389 bank movements. There are seven customers, nine suppliers, five stock products and four assets. Additional learner-created documents are supported but lie outside the original graded answer key.

## 3. Architecture and source map

Stack: React 19, TypeScript, Vinext/Vite, installed Shadcn/Radix primitives, Recharts, Cloudflare Workers, D1 and Drizzle. Preserve package-lock.json and existing dependency versions unless the change requires otherwise. The Worker memory limit in the hosted environment is 128 MB.

| File or directory | Responsibility |
| --- | --- |
| `app/page.tsx`, `app/chatgpt-auth.ts` | Protected root and platform-owned ChatGPT identity integration |
| `app/api/workspace/route.ts` | Authenticated GET/POST workspace persistence and optimistic concurrency |
| `db/raw.ts`, `db/schema.ts`, `drizzle/` | D1 access, schema and migration history |
| `lib/accounting/types.ts` | State, command, journal and document contracts |
| `lib/accounting/accounts.ts`, `money.ts` | Account chart, balance presentation and integer-cent helpers |
| `lib/accounting/generator.ts` | Deterministic source scenario, historical journals and worked exercise expectations |
| `lib/accounting/engine.ts` | Command validation, ledger calculations, grading, matching, allocations, reconciliation logic, backups and locks |
| `lib/accounting/schedules.ts` | Asset, inventory, lease and tax schedules; workpaper definitions |
| `lib/accounting/reconciliations.ts` | Independent customer/supplier statement comparisons |
| `lib/accounting/financial-notes.ts` | 18 note sections, equity movements and structured AFS report data |
| `lib/accounting/exports.ts`, `imports.ts` | Escaped HTML, safe CSV, ZIP generation, validated batch imports |
| `lib/accounting/journal-templates.ts`, `evidence-requests.ts`, `lessons.ts` | Starter preparation tools and teaching content |
| `components/ledgerlab/app.tsx`, `context.tsx` | Workspace load/save, shared state and hash-based navigation |
| `components/ledgerlab/` | Bookkeeping, reporting, exercises, schedules, dialogs and support views |
| `app/globals.css` | Established navy/white/blue theme and responsive working layout |
| `scripts/accounting/` | Executable verification, case export, PDF rendering and source packaging |
| `public/offline/` | Evidence PDF, worked AFS PDF and practice guide; source ZIP generated during build |
| `build/`, `scripts/build-verified.sh`, `vite.config.ts` | Sites build integration; do not replace with a generic Next.js deployment recipe |

UI navigation: Overview; Practice path; Source documents; Journal & ledger; Receivables; Payables; Bank reconciliation; Payroll; Month-end close; Assets & leases; Inventory; Provisions; Tax workspace; Financial statements; Audit support; Accounting desk; Case, notebook & data.

## 4. Persistence and compatibility

D1 table `accounting_workspaces` has owner_id, state_json, revision and updated_at. Each authenticated owner has one active workspace. A new seed or restore replaces that active case; backups allow switching attempts safely.

POST applies a command to a copied state, validates it, then performs a revision-guarded UPDATE. A stale revision returns conflict rather than overwriting newer work. The version-4 limits were 3,000,000 characters for incoming request text and 1,500,000 UTF-8 bytes for saved state. The 7 September continuation changes the request limit to 3,000,000 UTF-8 bytes, including streamed bodies; the saved-state byte limit is unchanged. See `lib/workspace/service.ts` for the current source behavior.

Keep these properties:

- Owner filtering and prepared SQL on every stored workspace operation.
- Server validation; UI validation alone is insufficient.
- Atomic batches: an invalid line or command leaves the previous saved state intact.
- Optional/defaulted newly added fields so old version-1/2 backups still restore and render.
- Backup validation of referenced journals, documents, allocations, bank matches and supporting schedules.
- Original posted journals retained; corrections use reversal and replacement.
- Later financial postings reopen prior review/assessment states.

The deployed migration `drizzle/0000_careless_shadow_king.sql` is historical and must not be rewritten. Add a new migration for a schema change. Existing template/disclosure/reconciliation additions live within JSON state and did not require a D1 schema change.

This archive does not contain the user's live database or personal saved practice. A full backup exported from Settings is a separate input if reproducing a user-specific issue.

## 5. Accounting rules to preserve

- Ledger amounts are safe integer cents. Round explicitly at the case-defined level, not by accumulating floating-point display amounts.
- Every journal balances independently and has valid accounts, date and references. Control accounts need appropriate contacts.
- January–November 2025 is agreed historical data; December has missing graded entries. Opening balances must not be posted again.
- Source statements represent the independent complete scenario. Never regenerate them from the learner's erroneous ledger just to make reconciliations agree.
- Grading considers date, accounts, contacts and source references where applicable, not just net account totals. Multiple journals may be required for one exercise.
- Supported January reversals must not erase correct December grades. A reversal cannot precede its original posting.
- Credit allocation changes open-item aging without a new GL movement. Prevent duplicate allocation and overuse of available credit or invoice balance.
- Linked stock sales/returns include inventory and cost-of-sales effects. Preserve item metadata through CSV export/import.
- Inventory quantity differences and NRV valuation allowances are separate. The signed year-end source count stays independent of learner postings.
- A provision's required closing estimate differs from the adjustment needed after opening balance and utilisation. Do not expense the full estimate twice.
- Current/non-current debt reclassification does not change total debt, profit or cash. Loan 2500 is non-current; 2510 is current; leases use 2520/2530.
- Direct and indirect cash flows derive from real movements and documented non-cash adjustments. Never insert a balancing plug.
- Balance-reconciliation supporting amounts follow the account's normal balance direction. Review requires support, evidence and a zero difference; later postings can reopen it.
- Escape user/source text in HTML and protect CSV text from spreadsheet formula execution. Preserve ZIP path/CRC safeguards.

Useful original-case traps: the $1,800 deposit in transit is already posted and stays on account until remittance details exist; capital-asset payment is already posted although its invoice is missing; the legal letter distinguishes a qualifying provision, a separate possible claim and a future plan; the accrual memo supports $940 electricity plus $3,500 professional fees. Read source evidence rather than treating this paragraph as an alternate answer key.

## 6. Explicit training limitations

This is a fictional single-entity AUD calendar-2025 training environment. GST uses simplified 10%/no-GST transactions and monthly reporting. Current tax uses supplied 25% and tax-base assumptions. Payroll withholding uses fixed teaching percentages, not statutory PAYG tables. Super uses the case's 11.5% Jan–Jun / 12% Jul–Dec assumption and stated OTE treatment. Do not present these inputs as current professional advice or add real filing claims.

It does not provide live bank feeds, actual payroll payments, BAS/tax lodgement, changing-cost FIFO layers, multicurrency books, consolidation, award interpretation, payroll tax, workers compensation or leave on-costs. Advanced lessons distinguish concepts from implemented capabilities.

AFS is a training draft: a full prior-year income statement and complete subsequent-events, related-party and going-concern evidence are absent. Preserve visible evidence gaps rather than fabricating completion. The tax note explains opening recognition catch-up, so total tax expense need not equal exactly 25% of accounting profit.

Exam mode is a learning aid, not a secure examination boundary. The source generator contains worked expectations, and assisted attempts remain identified. The static worked PDF matches seed 271828, not a learner's current ledger or another seed.

## 7. Run and verify

Use the lockfile. Node >=22.13.0 and a Linux-compatible shell are expected. The build scripts use Python 3, GNU timeout and other shell utilities. reportlab is needed for Python PDF generation. Dependencies are excluded from the archive.

For a plain uploaded archive, initialize a local Git checkout before the build, because the source-packaging script intentionally enumerates Git-tracked/unignored files. This does not create a GitHub repository or grant remote access:

```bash
# From the extracted LedgerLab directory, only if it is not already a Git checkout:
git init
git add .
# Install the exact locked dependencies in a compatible execution environment:
npm ci
npm run typecheck
npm test
npm run build
```

In an environment with the Sites skill, use its current dependency/build helpers instead of overriding its workflow. The authenticated app also depends on the platform's identity headers and D1 binding: opening static files cannot reproduce the full saved-workspace experience. Do not disable authentication on the published app to make a local preview work.

Individual accounting checks:

```bash
node scripts/accounting/run.mjs check
node scripts/accounting/run.mjs workflows
node scripts/accounting/run.mjs render
```

Verified at version 4: 7,938 accounting checks across five seeds; 352 workflow/import/state/schedule/control checks; 75 server-render checks across fresh, worked and backward-compatible states; TypeScript and production build passed. These are historical results, not a promise that modified code passes. No browser interaction or end-to-end UI testing was performed. SSR chart-container warnings occurred because there is no browser layout measurement; the render suite still passed. Do not describe server rendering as browser testing.

Offline generation:

```bash
npm run generate:case -- --seed 271828 --out output/accounting
npm run generate:case -- --seed 42 --out output/case-42 --answers
npm run generate:case -- --backup LedgerLab-backup.json --out output/my-practice
python scripts/accounting/render-source-pack.py --case output/accounting/case-source.json --out output/accounting/source-evidence.pdf
python scripts/accounting/render-financial-statements.py --data output/accounting/financial-report-data.json --out output/accounting/financial-statements.pdf
python scripts/accounting/package-source.py
```

The workflow suite writes temporary ZIP/HTML/backup samples under /tmp. The export supports either a Settings backup wrapper or raw validated state. A backup-to-report test preserved four extra stock documents and an unresolved $100 supporting-reconciliation difference. The PDF renderer includes saved reconciliation schedules. Original evidence PDF: 74 pages; worked AFS PDF: 25 pages. PDFs were rendered and visually checked in the initial build.

## 8. Safe continuation and deployment

1. Read this document and README, then inspect the relevant implementation. Check current Git status and source revision. Do not overwrite unrelated or newer changes.
2. Make the requested bounded change while preserving existing working modules. For changes to financial rules, inspect generator, engine, schedules, disclosures, exports and tests for the affected relationship.
3. For logic/state changes run the existing relevant checks, type checking and build. Add targeted tests for real regressions rather than duplicating implementation. For documentation-only changes, verify paths/content without rerunning thousands of unrelated checks.
4. Keep return artifacts complete: changed files or a patch, exact paths, baseline commit, change summary, test results and unresolved risks. Do not include credentials, dependencies, live user data or temporary build output.
5. If Sites tools are present, read the current Sites skills, call get_site for the existing project, obtain fresh repository access if needed and clone the actual remote. Local workspace paths are transient; this project was restored from remote for the handoff.
6. For an authorized publish, preserve the existing project ID and private audience; build, commit/push the exact source, resolve the full pushed HEAD, package the matching build output, save a version and deploy through Sites. Confirm terminal deployment status. Use the current installed skill paths, not an assumed historical plugin version.
7. Without Sites tools, deliver the files/patch. The user can bring them back to a Sites-enabled session. Do not claim a live update or try to bypass repository access.

## 9. Sensible next work, only when requested

- Explicit browser/end-to-end QA of posting, dialogs, CSV import, bank matching, backup restoration, conflicts and narrow-screen layouts. This is the main outstanding verification gap.
- A targeted independent accounting review of a selected schedule or disclosure, with dated authoritative sources when changing professional rules.
- Additional case scenarios, more periods, or a jurisdiction change only after defining the affected accounting assumptions and preserving existing cases.
- Performance/accessibility improvements based on actual observed issues, not a wholesale UI replacement.

Do not interpret this list as authorization to implement every item. Ask the user what they want next when no concrete change is supplied.
