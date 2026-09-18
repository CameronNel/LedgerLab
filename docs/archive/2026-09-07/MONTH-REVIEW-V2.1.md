# LedgerLab Workstation v2.1: month review

7 September 2026. This adds a saved-work assessment to Finance Workstation v2. The downloadable HTML is operational locally; the hosted application has not been changed. The case remains fictional, single-entity Australian/AUD 2025 training data. This release does not change its tax assumptions, source evidence or answer key.

## Use the new review

Open `LedgerLab-Workstation-v2.1.html` in your browser. Select **Start here → Check answers / month review**, or open **Accounting → Month-end close**. The report assesses the active takeover month, not an unrelated month selected for browsing reports.

Save your work before reviewing it. Post journals, save matches, and save or submit the formal role deliverables and cash forecast. Editing a workbook does not post its contents into the ledger or submit its figures for marking.

| Action | What it does |
|---|---|
| **Check my work** | Rechecks the current saved state without changing it. Shows missing work, incorrect checks and areas still requiring human judgement. In on-the-job mode, numerical answers stay hidden until submission. |
| **Submit month for review** | Confirms saved-only marking, records an attempt and reveals detailed case feedback for that saved work. An incomplete month can be submitted for learning. It does not post corrections, close the month, or release future documents. |
| **Close month** | Remains a separate action with the case's completion gates and a close conclusion. Releasing the next month is also separate. |

Open each review area and expand a finding. Feedback identifies the evidence, explains the exception, gives an action to take, and, where applicable, shows **your saved amount, the case answer and the difference**. Source-posting differences also show a net debit/credit correction. These differences are grouped net movements, not a prebalanced journal to copy. Investigate and correct the actual records rather than posting an unexplained plug.

Use **Open work area** or the document buttons to investigate. After corrections, recheck and resubmit. The old receipt is labelled **STALE** when relevant saved work changes. The report shows resolved and new exceptions between the latest two retained submitted attempts. One source error can affect several account balances and reports: check counts are not counts of unique mistakes or a calibrated competence score.

## What is assessed

- Required source processing: net postings, dates, evidence links, accounts, counterparties and cash-flow classes. Missing transactions, duplicate effects, incorrect amounts, miscoding and incorrect signs are detected. Split journals and reversal/replacement entries can pass when their net keyed effects agree.
- Current closing balances and computed monthly/YTD results, using the independent scenario rather than treating the learner's own ledger as the answer. Earlier unresolved source exceptions are included; future-month actuals remain outside the review.
- Bank matching, including a match to the wrong underlying transaction even when amounts are equal. This source-integrity check is also enforced by month-close gating.
- Formal role deliverables: submission status, independent numerical-field checks, explanation presence and evidence-link completion. Payroll, bank, accrual, fixed-asset and other reconciliations are assessed through these defined fields and source effects.
- Manager cash forecasts: required structure, submission and input-validation checks. Existing formal balance-reconciliation components are compared to the independent balance as supporting-work warnings.

## What is not automatically marked

**Freeform Excel working papers are not assessed cell by cell.** A saved workbook may contain incorrect formulas, missing schedules or copied numbers without the month checker discovering them. Enter the requested reconciliation/report figures in the formal deliverables to have those figures graded. Working-paper templates remain snapshots, not live ledger connections.

Narratives receive completion checks, not professional-quality marks. Commercial judgement, forecasts' realism, estimates, evidence interpretation, approvals, statutory AFS sufficiency and complete real-world job competence require substantive human review. Passing the automated checks does not certify these areas. Alternative reasonable real-world treatments can differ from this teaching case's exact key.

The report marks human-review categories explicitly rather than awarding automatic correctness points. Unsupported or ungraded areas are not silently treated as complete. The existing close gates are operational scenario controls, not certification that every possible finance responsibility has been covered.

## Attempts, exports and saved data

Submission records feedback assistance without enabling global guided mode. In on-the-job mode, expected figures are unlocked only for an assessment matching a retained submitted content fingerprint. Guided mode retains its existing answer visibility. The learning app is not a secure examination system: fingerprints are not cryptographic signatures, the answer key is part of the client application, and imported receipts are not tamper-proof evidence.

The latest **24 summary receipts across the case** are retained in backups. Each stores counts and exception identifiers, not a complete historical assessment or a copy of all work. Use **Export feedback** while reviewing an attempt to retain its detailed contemporaneous report as a static HTML file. Exports escape user text and contain no executable scripts. The work portfolio also lists review summaries.

Submitting identical saved work twice does not add a duplicate attempt. Failed or uncertain save responses keep the existing recovery controls: reload acknowledged saved state before resubmitting. A browser's memory-only storage still requires exporting backups before closing the page.

## Upgrade without losing practice work

In the old v2 app, save outstanding work and use **Case settings → Export backup**. Open v2.1 and restore that JSON backup through **Case settings**. Existing backups without review history remain supported. Do not assume two separately downloaded HTML files share browser storage. Backups contain saved data, not uncommitted spreadsheet cells or unsaved form text. A newer backup with review history should be used in this version; older versions are not guaranteed to preserve new fields.

## Implementation and continuation

The assessment is in `lib/accounting/month-assessment.ts`; shared types and escaped presentation are in `month-review-types.ts` and `month-review-view.ts`. The validated `submitMonthReview` domain command computes its own result; the client does not submit a trusted score. Optional history is validated during backup restore and saved through the existing revision-controlled session/API.

The local UI is in `scripts/desktop/local-accounting.ts`; React integration is `components/ledgerlab/month-review.tsx` within the career/close screens. The source also strengthens `careerBankMatchIssues`, adds review history to portfolio exports, and adds browser and domain regression suites. No package dependencies or source-case values changed.

Read `MONTH-REVIEW-V2.1-VERIFICATION.md` for executed checks and deployment limitations. Preserve the distinction between saved-state review, submission, close and next-month release in subsequent changes.
