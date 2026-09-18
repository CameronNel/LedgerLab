# LedgerLab Finance Workstation v2

Continuation dated 7 September 2026. This supersedes the original Finance PC preview's editor limitations and placeholder accounting screens. The hosted application has not been changed.

## Open and start

Open `LedgerLab-Workstation-v2.html` in a current desktop browser. It is self-contained: no server, account, package installation or CDN is needed for the local workstation. Browser file access and download policies still apply. Source code is also supplied for the existing React/Vinext/Cloudflare application.

The initial **Start here** window presents four stages: read the handover, gather evidence, process the books, and reconcile/close. The initial case is July 2025 with a messy predecessor handover. To choose another starting month, open Finance desk → Case settings, export your current case backup, and start a new local case. The underlying case remains fictional Australian/AUD training data, not South African payroll or tax advice.

1. Open **Finance drive** or the inbox to inspect original source evidence. Future-month evidence stays unavailable until the career engine releases that month.
2. Open **Accounting** to capture invoices, post your own balanced journals and match bank lines. These actions change the learner ledger; merely opening a workbook does not post an entry.
3. Open **Working papers → Templates** to start a reconciliation or working-paper pack. Use the formula bar, ribbon and worksheet tabs. Source copies remain read-only; use **Open editable copy** for a CSV source.
4. Save the workbook, review the formal role deliverables in Finance desk, and close the month only once its checks pass. Written management judgement still needs human review.

## Window and tab controls

- Both the window's title-bar × and the taskbar tab's separate × close that window. Minimize hides it, and the taskbar restores it.
- A dirty working file offers **Save & close**, **Discard changes**, or **Cancel** in an in-app dialog. Pending in-cell text is included. Saving must be acknowledged before the window disappears; failed or uncertain saves retain the draft.
- Closing a workbook window does not delete the saved file. Reopen it from Working papers.
- The × beside a worksheet name deletes that worksheet only after confirmation. Undo restores a deleted sheet. At least one worksheet must remain.
- Ctrl+F4 closes the active application window where the browser lets the app handle the shortcut. Browser-reserved shortcuts may take precedence.

## Spreadsheet behaviour

A new blank workbook opens with 100 rows and columns A–Z. It expands within the supported limits through the name box and row/column controls.

| Action | Behaviour |
|---|---|
| Edit | Select a cell and type to replace it; double-click or F2 edits existing content. Enter moves down, Tab moves right, Shift reverses direction, and Escape cancels. |
| Select | Drag or use Shift+arrows for a rectangular range. The name box accepts a cell or range, such as B5:D18. |
| Formulas | The formula bar shows the underlying formula. Cross-sheet references, relative/mixed/absolute references and F4 toggling are supported. |
| Clipboard | Multi-cell TSV/CSV paste, internal copy/cut/paste and paste-values. Copying shifts relative references; fixed `$` references stay fixed. Clipboard permissions depend on the browser. |
| Fill | Ctrl+D fills down, Ctrl+R fills right. Drag the fill handle to extend a numeric series or copy formulas. |
| History | Ctrl+Z undo and Ctrl+Y redo, up to 40 workbook edits in the current editor session. |
| Formatting | Bold, italic, underline, fill/font colours, alignment, wrap, accounting/currency/number/percentage/date formats and decimal controls. |
| Layout/data | Resize or autofit columns, insert/delete rows or columns, sort a selected range, filter its visible rows, find/replace, freeze the first row/column and show formulas. |
| Worksheets | Add, rename, duplicate or delete sheets; supported references update on rename and structural edits. |
| Files | Import/export basic multi-sheet XLSX, import CSV/TSV and export the active sheet as CSV. |

### Supported function names

SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, COUNTBLANK, ABS, ROUND, ROUNDUP, ROUNDDOWN, INT, MOD, IF, IFERROR, AND, OR, NOT, SUMIF, SUMIFS, COUNTIF, COUNTIFS, AVERAGEIF, SUMPRODUCT, XLOOKUP, VLOOKUP, INDEX, MATCH, CONCAT, CONCATENATE, TRIM, UPPER, LOWER, LEN, LEFT, RIGHT, MID, VALUE, ISNUMBER, ISTEXT, ISBLANK, DATE, YEAR, MONTH, DAY, EOMONTH, EDATE, TODAY, NA and SUBTOTAL.

This is a supported subset, not a guarantee of all Excel argument modes or edge-case semantics. For example, SUMPRODUCT accepts ordinary array/range arguments, not arbitrary Boolean-array arithmetic. SUBTOTAL currently includes rows hidden by this editor's visual filter. TODAY follows the computer's current date, not the case's simulated month.

## Working-paper packs

Thirteen templates are available: bank reconciliation, payroll, accruals, prepayments, receivables/collections, payables/payment planning, fixed assets, inventory/NRV, management accounts, AFS mapping/disclosures, 13-week cash flow, close checklist and a blank workbook.

Packs combine editable working sheets, relevant source/register or learner-ledger snapshots, and guidance. The bank pack has five sheets: reconciliation, statement, cashbook, learner trial balance and Read me. Learner-entered figures and supporting explanations remain your work; the independent answer key is not pasted into your workbook.

**Snapshot warning:** ledger and source data in a created workbook are dated snapshots, not live spreadsheet connections. Recreate or refresh your own support after new postings, and label the ledger date used. The operational accounting reports themselves recalculate from the current learner ledger.

## Local accounting screens

The standalone HTML no longer routes accounting actions to preview placeholders. Its local adapter uses the existing validated command engine and WorkspaceSession for:

- Journal preparation, posting, source links, reversals and exports; source invoice/credit capture with contact and tax controls and duplicate prevention.
- Bank matching/unmatching, ledger-backed balances, customer/supplier subledgers, payroll control review and reports.
- Source evidence and specialised asset, stock, provisions, tax and audit preparation areas; these expose evidence, controls, workpapers and journal actions rather than automating accounting judgement.
- Career deliverable drafts/submissions, 13-week forecast drafts/submissions, monthly close/reopen/advance, notebook notes and full case backup/restore.

The source project's React application retains its original, broader accounting modules. The HTML uses a new dependency-free local adapter over the same domain engine; it is not a compiled copy of the full React application. An operational view is not a claim that every advanced feature from the React application is duplicated in the local adapter.

## Saving, backups and upgrading

**Save** stores a working file with the current case. **Download XLSX** exports a portable workbook. **Case settings → Export backup** exports the saved case, including journals, mail markers and saved working files. Export does not silently save outstanding cell edits or unsaved journal forms.

Save files and export a full JSON backup before changing versions or clearing browser storage. For an existing Finance PC case, export that backup from the old version, then restore it through Case settings in this version. Earlier single-sheet files are upgraded when opened. Do not assume that two downloaded HTML files share browser storage; file-origin behaviour varies. Old application versions are not guaranteed to understand a new multi-sheet backup.

Browser-local storage is not cloud storage or an encrypted document vault. Incognito sessions, policy restrictions, storage quotas or deletion of browser data can remove access to local saves. A visible **memory only** status means saves survive only in that open page: export your work before leaving. Do not use this training app to store real confidential client/payroll data.

Concurrent saves use revision checks. A lost save response may mean the server/local adapter saved the change but the UI could not confirm it. Reload saved state and resolve the conflict rather than blindly posting again. Unsaved local accounting form fields are retained during navigation in the current session, not included in case backups.

## Explicit limits

- This is neither Windows nor Microsoft Excel. No VBA, pivot tables, Power Query, external data connections, named/structured references, dynamic arrays, charts or complete Excel formatting fidelity.
- Up to **500 rows × 52 columns (A:AZ) per worksheet; 8 sheets per workbook; 80 learner files; 1,000 characters per cell; 650,000 serialized desktop bytes per saved case**. Larger or richly formatted files may exhaust storage earlier. The grid is not virtualised for Excel-scale workbooks.
- XLSX import is bounded to 3 MB compressed and 12 MB total expanded contents, plus cell/sheet limits. Macros, external links, embedded objects, encrypted content and unsupported array/data-table formulas are rejected. Merged cells are unmerged; charts, Excel table objects and conditional-formatting rules are not imported. Warnings explain dropped features. Unsupported ordinary formulas are retained for inspection but may export as inert text/error values rather than executable formulas.
- Formula correctness is tested for the implemented subset, not certified against every Excel feature, date-system peculiarity or complex partially moved range. Recheck complex imported workbooks in Excel.
- The fictional AUD 2025 case, single-entity scope, existing close rules and original limitations remain. This is practice, not a promise of complete professional competence or ready-to-file statutory AFS.

## Development and verification

Run from the project root:

```sh
node scripts/accounting/run-portable.mjs
# Requires existing Node.js and TypeScript with Node type definitions.
tsc --noEmit --strict --target ES2022 --moduleResolution node --module commonjs --skipLibCheck scripts/desktop/preview.ts
node scripts/desktop/bundle.mjs /tmp/LedgerLab-Workstation-v2.html
python scripts/desktop/check-workstation.py /tmp/LedgerLab-Workstation-v2.html /tmp/ledgerlab-browser-results
python scripts/desktop/check-clipboard.py /tmp/LedgerLab-Workstation-v2.html /tmp/ledgerlab-clipboard-results
```

The browser script requires Playwright and Chromium. Set `CHROMIUM` to the executable path when it differs from `/usr/bin/chromium`. It uses real DOM interaction through `set_content` in the restricted test environment. Browser-memory persistence in this harness and production SQLite request persistence are separately identified in the verification report.

Before publishing the React application, run the locked dependency install, full project typecheck, React integration/browser tests and production build in its intended environment. Those are not replaced by the isolated desktop bundle checks. Do not publish this archive or change the original site's private access without separate authorisation.
