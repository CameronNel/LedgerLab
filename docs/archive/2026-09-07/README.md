# LedgerLab

**Current: Workstation v3, Day-by-Day Finance Job.** [Start and daily-work guide](DAY-BY-DAY-V3.md) · [Executed verification](DAY-BY-DAY-V3-VERIFICATION.md). Open `public/offline/LedgerLab-Workstation-v3-Day-by-Day.html` for the operational local app. Fresh cases open on the first day with onboarding, a simulated PC clock, dated arrivals, management requests, response submissions and close-week controls. Existing monthly cases can be preserved and explicitly enabled. The hosted application is unchanged.

**Earlier: Workstation v2.1, Month Review.** [How to check, submit and correct a month](MONTH-REVIEW-V2.1.md) · [Executed verification and remaining limits](MONTH-REVIEW-V2.1-VERIFICATION.md). This adds independent missing-work/error feedback, saved review attempts and stronger bank-match source checks. Check, submit, close and next-month release remain separate. Freeform workbooks and professional judgement are not automatically graded. Hosted app unchanged.

**Earlier: Finance Workstation v2.** [Quick start, spreadsheet controls, local workflows and limits](WORKSTATION-V2.md) · [Executed verification](WORKSTATION-V2-VERIFICATION.md). Open the supplied self-contained HTML for the operational local workstation. The source also upgrades the existing React desktop; full production integration is not yet verified. Hosted app unchanged.

**Finance PC continuation:** [desktop guide and implementation](FINANCE-PC-2026-09-07.md) · [executed verification](FINANCE-PC-VERIFICATION-2026-09-07.md). The default interface is now a Windows-style finance desktop with folders, source viewers, scenario mail, editable working papers and the existing accounting screens. **Downloadable source only; the hosted app has not changed.**

**Finance takeover continuation:** see [the takeover guide and implementation notes](TAKEOVER-2026-09-07.md) and [current verification](TAKEOVER-VERIFICATION-2026-09-07.md). Start in any month, inherit the prior ledger, process the active month and progress through closes. Includes financial-accountant and financial-manager tracks. **The hosted app has not been updated.**

**Source continuation, 7 September 2026:** see [the changes and integration notes](CONTINUATION-2026-09-07.md) and [the executed verification record](VERIFICATION-2026-09-07.md). The hosted app was not updated.

Continuing in another ChatGPT session? Start with [CHATGPT-START-HERE.md](CHATGPT-START-HERE.md), then read [HANDOFF.md](HANDOFF.md) for architecture, accounting rules, verification and hosting context.

A private accounting practice workspace for moving from reviewing other people's books to preparing the books yourself.

The application generates a reproducible fictional Australian trading and installation company. Legacy mode supplies a complete 2025 historical ledger and a deliberately incomplete December close. Takeover mode inherits only the period before your chosen start, adds optional predecessor errors, and leaves each released live month for you to process. Reports come from the learner's actual postings. The independent source records and worked solution do not change when the learner makes a mistake.

## Included workflows

- Integer-cent double entry, chart of accounts, source-linked journals, six reusable starter templates, saved custom templates, single or atomic batch reversals, and CSV batch imports.
- Sales and supplier invoices, customer and supplier credit notes, linked stock sales and physical returns, automatic cost-of-sales entries, receipts and payments.
- Customer and supplier control accounts, due-date aging, independent statement reconciliation, partial credit allocations and allocation reversals.
- Monthly bank statements, individual and combined matching, reviewable batch suggestions, and deposits in transit.
- Six-employee payroll: salaries, allowances, overtime, teaching withholding, deductions, net wages, super, liability reconciliation and leave valuation.
- Accruals, prepayments, unbilled revenue, deferred revenue, depreciation, asset additions, inventory shortages and NRV allowances.
- Warranty and legal provisions, contingencies, ECL, 36-month lease amortisation, loan classification, GST, current tax and deferred tax.
- Profit or loss, financial position with opening comparatives, changes in equity, direct and indirect cash flow, 18 numbered disclosure notes with live comparative tables, editable assessments and budget analysis.
- 23 graded closing exercises, guided/exam presentation, 34 concept lessons, 13 workpapers, a component-based balance-sheet reconciliation workbench, 16 evidence preparation requests, evidence links, review sign-offs and an audit trail.
- Owner-scoped saved progress, optimistic concurrency checks, backup/restore, period locks, print-to-PDF documents and ZIP evidence packs.
- An original-case 74-page source evidence book, a 25-page worked AFS PDF, a complete-close practice guide, downloadable project source, and reproducible offline document and report scripts.

## Important scope

This is a fictional single-entity training simulator, not a live tax, payroll, banking or statutory filing product. All people and organisations are fictional. No actual account numbers, tax file numbers or payment integrations are used.

The case currency is AUD and the reporting year is calendar 2025. GST is simplified to supported 10% or no-GST transactions. Monthly GST reporting is an explicit case assumption. Current tax uses a supplied 25% rate and tax-base assumptions. Payroll withholding percentages are fixed teaching inputs, not ATO PAYG tables. Super uses 11.5% through June 2025 and 12% from July, with the case OTE rules described in the register. Leave on-costs, payroll tax, workers compensation and award interpretation are excluded.

The base case uses fixed inventory unit costs. It does not implement changing-cost FIFO layers, a multiple-currency ledger, consolidation or live exchange rates. Advanced concept lessons label those limitations. Prior-year income statements and full subsequent-event, related-party and going-concern evidence are not provided; the AFS is explicitly a training draft.

Guided/exam modes are learning aids, not a proctored security boundary. Source code and generated case data contain worked answers. Additional sandbox invoices and journals change the ledger but are outside the original case answer key.

## Run and verify

The hosted application uses the existing Vinext / Cloudflare Worker starter. Source identity and logical D1 binding are in `.openai/hosting.json`. The deployment platform owns actual binding creation, authentication and schema migration application.

```bash
npm run typecheck
npm test
npm run build
```

The current persistence suite contains 311 checks of the production request/session logic with local SQLite. In environments with an existing TypeScript compiler and Node declarations, `npm run test:portable` runs the numerical, workflow, persistence, takeover and desktop suites without the UI dependencies. It does not replace the full commands above. The existing full-app browser driver remains unexecuted here: [scripts/browser/README.md](../../../scripts/browser/README.md). The new isolated desktop browser checks were executed; see [scripts/desktop/README.md](../../../scripts/desktop/README.md) for their narrower scope.

The main numerical suite checks five independently generated seeds (7,938 checks). The workflow suite currently checks 352 additional outcomes, covering posting, reversal, invoice consistency, imports, bank batch matching, period locks, backup restoration, review invalidation, schedules and statement controls. The component suite also renders 25 screens against fresh, worked and older saved-state fixtures to catch runtime rendering and numeric-output errors. This is server rendering verification, not browser interaction testing. It writes temporary ZIP samples to `/tmp` for independent archive validation.

## Generate an offline case

After Node.js 22+ dependencies are installed (Python 3 is used for source packaging; reportlab is needed only for PDF generation):

```bash
npm run generate:case -- --seed 271828 --out output/accounting
# Explicitly include worked answers:
npm run generate:case -- --seed 42 --out output/case-42 --answers
# Generate reports from an exported practice backup:
npm run generate:case -- --backup LedgerLab-backup.json --out output/my-practice
# Optional evidence PDF (requires Python 3 and reportlab):
python scripts/accounting/render-source-pack.py --case output/accounting/case-source.json --out output/accounting/source-evidence.pdf
# Render the current learner AFS data to PDF:
python scripts/accounting/render-financial-statements.py --data output/accounting/financial-report-data.json --out output/accounting/financial-statements.pdf
```

The export includes the source JSON, printable HTML evidence in a ZIP, unadjusted ledger and trial balance, twelve bank and payroll CSVs, and current-ledger AFS HTML and structured report data. With --answers, separate worked numerical financial statements are included. The report renderer uses the accounting engine’s integer-cent figures and includes saved disclosure assessments and reconciliations. The PDF renderer builds a document index and paginates statement tables. Changing the seed changes transaction quantities, amounts and case estimates reproducibly.

## Data and accounting design

- `lib/accounting/generator.ts` constructs the independent source case and solution.
- `lib/accounting/engine.ts` validates commands, computes balances and reports, grades tasks and enforces posting controls.
- `lib/accounting/schedules.ts` contains asset, lease, inventory and tax schedules.
- `lib/accounting/financial-notes.ts` builds the detailed disclosure tables and independently derived equity movements.
- `lib/accounting/evidence-requests.ts` seeds the manual preparation and evidence request register.
- `lib/accounting/imports.ts` parses CSVs and validates complete journal batches before posting.
- `lib/accounting/exports.ts` generates CSVs, HTML documents, financial-statement drafts and ZIP files.
- `app/api/workspace/route.ts` preserves the platform identity/D1 boundary and delegates to tested handlers in `lib/workspace/service.ts`, with prepared SQL and a compare-and-swap revision.
- `lib/workspace/session.ts` and `notebook-draft.ts` coordinate client saves, reloads, unconfirmed acknowledgements and notebook drafts.
- `db/schema.ts` and the checked-in Drizzle migration define persistent workspace storage.
- `components/ledgerlab/` implements the working screens with the starter's accessible UI primitives.

Amounts are safe integer cents in the ledger. Tax and schedule rounding is explicit. Journals must balance independently, require valid accounts and contacts, and respect period locks. Receivable, payable and inventory exercise grading also checks the source reference. January reversals preserve December grades. A failed batch is discarded without modifying the previous state. A later financial posting invalidates prior workpaper review status and reopens completed disclosure assessments. Credit allocation changes invoice aging without creating additional ledger movements.

The cash-flow bridge is calculated from account movements and documented investing/financing control-account adjustments. It never inserts a balancing plug. Bank reconciliation is limited to the operating bank; cash-flow reporting includes both operating bank and petty cash.

## Reference sources

Case principles and dated assumptions are linked in the application:

- AASB 137: https://standards.aasb.gov.au/node/868
- AASB 107: https://standards.aasb.gov.au/aasb-107-mar-2020
- AASB 102: https://standards.aasb.gov.au/aasb-102-mar-2020
- ATO GST: https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/how-gst-works
- ATO super rates: https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee
- ASA 500: https://standards.auasb.gov.au/asa-500-mar-2021

Do not substitute these dated case assumptions for a current, fact-specific professional assessment.
