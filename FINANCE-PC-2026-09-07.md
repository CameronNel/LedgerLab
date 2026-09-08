# LedgerLab Finance PC

## What this continuation adds

A Windows-style finance workstation inside the existing browser application. This is a desktop simulation, not a Windows virtual machine, a Microsoft Office installation, or access to the learner's actual computer. It is intended to make the accountant-takeover case feel like inheriting a predecessor's finance PC.

The existing accounting screens remain the accounting system. They render inside an accounting-app window through a React portal. Desktop evidence viewers, scenario mail, spreadsheets and notes can remain open alongside that window. Classic navigation remains available from Start or the app toolbar.

This continuation changes downloadable source only. It has not been deployed to the existing private site, and does not contain or alter the live database.

## Using the workstation

Start at Finance PC, the new default view. Existing deep links to classic screens still work. In LedgerLab / Your finance desk, choose a takeover month and role, or continue the already saved case. Opening the desktop does not reset the case.

The desktop has Finance drive, Current month, Mail, LedgerLab, Working papers, Handover and Recycle bin shortcuts. A taskbar and Start menu provide access to files and all existing accounting screens. Windows can be dragged, resized, minimized, maximized, restored and closed. Arrange windows side by side tiles the two foreground windows. Smaller screens use full-size windows and taskbar switching. There is a controlled twelve-window limit.

A typical workflow is:

1. Read Handover / Read me first, the predecessor's handover and outstanding evidence.
2. Read the scenario inbox and open its bank, payroll, invoice or statement attachments.
3. Open Current month / Payables / Invoices. A source invoice opens in its own viewer; Capture invoice launches the existing invoice-capture form with the source linked and coding left for the learner.
4. Place the source viewer beside LedgerLab or an editable working paper. Use the accounting modules to post, reconcile, submit and sign off.
5. Save or download the supporting file. Complete the normal monthly close before releasing the next month's evidence.

## Folder structure

```text
Finance (F:)
  Handover
    Read me first.txt
    Predecessor and opening evidence
    Prior-year AFS - outstanding evidence.txt
  Finance
    2025-01 ... current released month
      Banking
      Receivables / Invoices, Credit notes, Statements
      Payables / Invoices, Credit notes, Statements
      Payroll / Payslips
      Inventory
      Assets & leases
      Month-end evidence
      AFS & reporting
  Inbox / month
  Company reference / Contracts
  Working papers / month
  Working papers / Templates
  Working papers / Signed-off work
  My notes
  Recycle bin
```

Folders reflect the available evidence. An empty category need not appear. Earlier dated source evidence may produce an earlier archive folder. Learners can create subfolders by saving a working file under a valid Working papers or My notes path.

Search covers file names, folder paths and descriptions across the released drive, not full document body text. The drive supports details/icons, date/name/type sorting, breadcrumbs, folder shortcuts and additional Explorer windows.

## Documents, mail and reports

The file catalogue uses the actual accounting case rather than unrelated demonstration records. Source documents remain read-only, and current-month source invoice capture reuses the original document instead of creating a duplicate. Historical source viewers offer a source-linked correction journal rather than re-capturing an inherited invoice. A displayed ledger-link count is not a correctness or completeness assessment.

Monthly bank data, payroll data, learner trial balances and journal listings have CSV exports. AFS & reporting contains the current learner's year-to-date teaching statements as printable HTML. Live report files refresh from saved learner postings. Original source evidence does not change when learner postings change.

Source documents are honestly named `.html`, not fake `.pdf` files. Open them in the viewer, download the HTML, or use Print / Save as PDF through the browser. No new PDF-generation dependency is required.

Mail is fictional scenario correspondence, not a real email connection. Messages include the predecessor's handover, monthly evidence packs and role-deliverable requests. Attachments open the same original evidence documents. Read/unread markers save with the case. Downloaded `.eml` messages contain the message and an attachment-reference list; download the referenced source files separately. They are not multipart email bundles with embedded attachments. No real message is read, sent or received.

Later-period evidence and mail remain gated by takeover progression. Mail does not expose task answer-figure fields. This is a teaching UI, not an examination-security boundary: the distributed source contains the original worked case logic.

A complete signed prior-year AFS set is still not supplied. An outstanding-evidence note explicitly identifies this gap instead of inventing signed statements or comparatives. The single-entity AUD 2025 case, teaching assumptions and prior takeover limitations are unchanged.

## Working papers

Templates are provided for bank reconciliation, payroll checking, accrual rollforwards and blank calculations. Bank templates identify their learner-ledger input as a snapshot at creation. They do not automatically update an existing saved sheet after new postings. Recheck and update those workings yourself.

The grid supports arithmetic, parentheses, direct and absolute cell references, ranges, SUM, AVERAGE, MIN, MAX, COUNT, ABS and ROUND. Cells show calculated values when not being edited; focus or the formula bar exposes the raw formula. Paste tab-separated cell blocks, import CSV/TSV, and add rows or columns within the limits. TSV block paste does not implement quoted embedded tabs/newlines; use CSV import for quoted multiline fields.

Working papers export as genuine `.xlsx` Open XML workbooks with formulas and cached values, or as value-only CSV. Unsupported or unsafe formulas are exported as literal error/text cells, not as executable formulas or links. Notes export as plain text.

This is not full Excel: no XLSX import, macros, external workbook links, arbitrary Excel functions, pivot tables, charts, multi-sheet editing or live Microsoft Office integration. Working files are limited to 60 rows by 12 columns, 1,000 characters per cell, 30,000 characters per note, 80 saved files including recycled files, and 650,000 serialized desktop bytes. The existing overall workspace limit still applies. Recycled files are recoverable; there is no permanent-delete or empty-bin action in this release.

Amounts in worksheets are decimal AUD. Worksheet formulas are supporting calculations, not ledger postings. The existing posting engine still uses integer cents. Saving a worksheet does not submit a formal role deliverable, pass a reconciliation or close a month.

## Saving, conflicts and backups

Saved files and mail-read markers use the existing owner-scoped workspace API, revision guard and full-state validation. An optional `desktop` field is additive to the existing schema-version-1 JSON state; no D1 migration or authentication change is needed. Old backups without desktop data remain valid.

Per-file timestamps provide a second optimistic baseline guard and are server-generated, monotonic even for successive writes within the same millisecond. Renaming, updating, recycling and restoring are validated. Source files cannot be addressed by these write commands. Duplicate active folder/name paths are rejected case-insensitively.

An unsaved draft remains in its open window when other windows open or minimize. Closing the draft or leaving the desktop prompts before discarding it. Browser refresh warnings are best-effort browser behaviour, not crash recovery: save or download important drafts first. Unsaved drafts are not included in a case backup.

If another saved version appears, the draft remains intact and cannot overwrite it silently. Use Reload saved or Save copy. After a lost save acknowledgement, the existing session blocks blind retries until a reload discovers the saved state. A newly committed file whose acknowledgement was lost can then be recovered with Reload saved.

Case replacement preserves dirty editor windows as detached drafts for download or an explicit Save copy into the new case, rather than silently attaching them to another case. Clean windows and source views are refreshed. Leaving the desktop entirely still discards an unsaved editor only after confirmation.

## Standalone preview

`LedgerLab-Finance-PC-preview.html` is a separate, self-contained demonstration generated from the real desktop, catalogue, worksheet engine and WorkspaceSession code. Open it in a browser; it makes no external network requests. It starts a fictional July 2025 financial-manager messy-handover case.

The preview's accounting-app windows are explicitly labelled placeholders for the full React screens. It does not implement posting, invoice capture, formal reconciliations, career submission or close progression. The complete app source connects those callbacks to the original screens and forms.

Preview storage is browser-local only. When browser storage is denied, the taskbar says Preview memory only; closing that page then loses the preview state. Download working files or use the accounting-preview window's backup download before closing. The preview never connects to or changes the hosted case.

## Source map

| Path | Responsibility |
| --- | --- |
| `lib/desktop/types.ts` | Optional desktop state, file validation, limits and identifiers |
| `lib/desktop/files.ts` | Released-source catalogue, folders, mail, report adapters and worksheet templates |
| `lib/desktop/worksheet.ts` | Bounded formula parser/evaluator, CSV and XLSX export |
| `lib/desktop/shell.ts` | Production DOM desktop, windows, Explorer, mail, viewers and editors |
| `components/ledgerlab/desktop/desktop.tsx` | React bridge and portal for existing accounting screens |
| `components/ledgerlab/desktop/desktop.css` | Isolated desktop styling and responsive window layouts |
| `components/ledgerlab/app.tsx` | Default navigation, case/session model and original form callbacks |
| `lib/accounting/engine.ts` | Validated saved-file, recycle/restore and read-marker commands |
| `scripts/accounting/desktop-check.ts` | Catalogue, gates, formula, state and production SQLite/API regression checks |
| `scripts/desktop/` | Isolated preview bundler, explicit preview fixture and Chromium interaction checks |

No runtime dependency versions, lockfile, tax assumptions, answer keys, identities, deployment settings or historical D1 migration were changed. The preview fixture is not imported by the production application. See the verification record for precisely which tests ran and which remain required before deployment.
