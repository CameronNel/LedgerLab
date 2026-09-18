# Finance Workstation v2: executed verification

7 September 2026. All results below were executed against the updated source unless explicitly marked unverified. This report supersedes prior Finance PC test totals. Test assertion counts are not a completeness score.

## Delivered build

The self-contained HTML bundles 25 production-domain/desktop and local-adapter modules. It is an operational browser-local workstation, not the original desktop-only preview. The source updates the shared desktop and spreadsheet used by the React application. The hosted application was not accessed, changed or published.

HTML SHA-256: `718d99cbe1fa2fd588d985e7c2426de0518cc4f0ccf7419fa56bdb86572cfaff`

## Domain, persistence and workbook checks

Executed `node scripts/accounting/run-portable.mjs`, including its new workbook suite, with Node v22.16.0 and TypeScript 5.8.3.

| Suite | Passed assertions |
|---|---:|
| Accounting across five generated cases | 7,938 |
| Workflow/import/state/references/close controls | 352 |
| Production persistence handlers, notebook, request validation and SQLite concurrency | 269 |
| Takeover/source boundaries/full-year progression/forecast/capture/close controls | 30,184 |
| Desktop catalogue, monthly evidence gating, file validation and production SQLite/API | 32,935 |
| New workbook calculations/reference edits/templates/XLSX export/state compatibility | 233 |
| **Total** | **71,911** |

The full-year cases processed 774 and 776 learner journals respectively, with 147 role deliverables per case. Those are domain simulations, not 12 months of browser automation. Qualitative judgement is not independently graded.

The workbook suite tests the 50-function supported subset, mixed/fixed reference copying, qualified cross-sheet range insertion/deletion, escaped sheet renaming, CSV/TSV quoting, mirror/schema consistency, all 13 templates, their supported calculations and saved-state validation. This is not a full Excel conformance suite.

## Real Chromium interaction

**107 main UI assertions plus 14 supplemental clipboard/formatting assertions passed: 121 total.** The scripts are `scripts/desktop/check-workstation.py` and `scripts/desktop/check-clipboard.py`; the old `check-browser.py` entry point now routes to the current main suite.

The main suite includes:

- Typing, F2, Escape, Enter/Tab, formula-bar edits, range paste/delete/undo/redo, relative formula fill/copy, absolute references/F4, paste-values, number/date/percentage formatting and numeric fill-handle series.
- Multi-sheet addition/rename/cross-sheet recalculation, show formulas, freeze/unfreeze, sheet-delete cancellation/confirmation/undo, sorting/filter clearing, structural edits and find/replace.
- Save/reopen and uncommitted-edit protection, multi-sheet XLSX export/import through the browser download/file chooser, numeric-format and cross-sheet formula round trips.
- Window close, minimize/restore, taskbar-close Cancel/Discard, Save & close after acknowledgment, source iframe safety, scenario mail, and future-month evidence gating.
- Opening all 18 local accounting views without placeholders; unbalanced-journal rejection, actual journal posting, bank match/unmatch, source-invoice capture, visible duplicate prevention, career and forecast draft saves, incomplete-close rejection, notes and full saved-case backup.
- A deliberately lost save acknowledgment: the backend really saved the file; Save & close retained the window/draft; reload and explicit conflict resolution recovered it. Repeated taskbar closes and an 800-pixel-wide viewport also passed.

The supplemental suite verifies same-sheet and cross-sheet cuts, unchanged precedents, relocated dependent formulas, whole-workbook undo, worksheet duplication, italic/underline/alignment/wrap and decimal controls. No uncaught JavaScript errors occurred in these runs.

Browser navigation is policy-restricted in the execution environment. The tests therefore load the actual HTML with Playwright `set_content` and interact with its DOM. That produces a **browser-memory storage fallback**, not a disk/localStorage persistence test. The real WorkspaceSession and domain commands still execute. Persistent request handling was separately tested against actual in-memory SQLite using the production handlers. Cross-browser, file-origin storage, operating-system clipboard integration, user-machine policy and hosted identity-provider behaviour remain outside these browser tests.

## Independent XLSX check

The browser-exported two-sheet workbook and the bank, payroll and AFS template exports all imported successfully into **artifact_tool**, an independent spreadsheet engine. The browser workbook retained B6 = 250 and its cross-sheet F6 = 300. Changing B6 to 500 in the independent engine recalculated C6 to 524.75. The template imports exposed the expected five/four/four worksheets and their data/formulas.

This checks interoperability and a targeted recalculation, not opening in Microsoft Excel itself or exhaustive fidelity of every format/function. The independently edited workbook was a test instance, not a change to the app's saved case.

## Compilation and visual review

- Strict dependency-free TypeScript check of `scripts/desktop/preview.ts` and its imported module graph: passed.
- All **138 TypeScript/TSX source files** passed syntax transpilation checks. This is not semantic typechecking of all React dependencies.
- Self-contained HTML rebuilt successfully from the updated source.
- The Start here desktop and clean bank-workpaper screen were visually inspected. A transient test-failure toast in an intermediate screenshot was excluded by taking the final screenshot from a fresh, unfaulted case.

## Not verified or not claimed

Full dependency installation, full React/Vinext project typecheck, React integration tests, production build, Cloudflare/D1 deployment, hosted access control and publication were not verified here. Dependency installation was unavailable in this environment. The 121 browser checks are against the shared desktop and the operational local adapter, not a compiled full React application.

No claim is made that every combination of every button is bug-free, that all Excel formulas and file features work, or that the training case produces filing-ready statutory statements. Workbook source/ledger snapshots are not live links. Visual filtering does not change SUBTOTAL calculation. Hard grid, worksheet, file-size and storage limits are documented in `WORKSTATION-V2.md`.

Machine-readable check names and logs are included under `tests/verification-workstation-v2/`. The source archive also has its explicit source manifest and reproducible-package verification script.
