# LedgerLab 3.1: your daily workspace

## First run

Open the current standalone HTML. A fresh case begins on 1 July 2025 with the financial-manager role and a messy handover. Today is the first open window. Read the onboarding email, open its assignment and inspect the supplied evidence.

The seven permanent sections organize the existing tools. Today is the home screen; the desktop is the environment, not another competing finance desk. The classic sidebar uses the same registry and retains old bookmark IDs.

## Search instead of hunting through modules

Press Ctrl+K on Windows/Linux or Cmd+K on macOS, or choose Search. Enter a source reference, supplier name, journal reference, account code or accounting topic. All query words must match; exact references rank ahead of loose text matches. Up/down arrows select, Enter opens and Escape closes, returning focus to your work.

Results include only the documents and assignments released in your current case, actual journal postings, account activity and static lessons. Search does not consult or display the worked solution. Recycled files are excluded. Changing the saved case closes the search so stale results cannot be reused.

Account and journal results open a read-only inspection with source links. Lesson results open the explanation without posting its worked example into your case.

## Work beside the evidence

Open an assignment and choose **Open evidence + work**. Its released source opens next to the relevant assignment or accounting area. On narrow screens, switch between the windows using the taskbar. This shortcut does not capture an invoice, fill in an answer, match a bank line or post an entry for you.

Expand **Why is this on my desk?** to see the business reason, responsibility, expected output and what a supportable completion looks like. Today also summarizes waiting items, including the recorded owner and follow-up date. Waiting remains open work.

## Record and resolve review responses

Choose **Close → Review notes**. Select an available assignment, read its actual check result and record what you investigated or corrected. Save a stage: Open, Prepared, Changes requested or Cleared (training check).

Cleared is allowed only when the underlying task already passes. Changing supporting work invalidates the old clearance and shows Changes requested while retaining your response history. Original findings remain visible. These statuses do not close a month, submit an assignment, mark a freeform narrative as correct or represent approval by a separate human reviewer.

Review notes are saved in `Working papers/<month>/Review notes` as a structured text file. They are included in ordinary backups. Do not edit that JSON manually. A recycled or malformed review file is not silently overwritten. Each file has the existing 30,000-character limit; saving fails explicitly rather than truncating history.

A failed or uncertain save keeps your draft. After reloading, download your draft and explicitly load/discard to the newest saved response before retrying a conflicting save. Switching assignments cannot silently discard an unsaved response. Closing offers Save, Discard and Cancel. Replacing the active case preserves a dirty response for download instead of saving it into the new case.

## Dates, saves and close controls remain separate

PC date controls evidence arrival; source/effective date controls accounting; the open accounting month controls the close. Reading email, saving a workbook, submitting an assignment, checking work, submitting a month review, closing a period and releasing the next month remain distinct operations.

Export backups before switching case/browser/file versions. Browser-local storage is not shared automatically between origins. In Preview memory only mode, export before closing. No real email, payment, bank feed or filing integration is added.

## Current boundaries

This cleanup preserves a single AUD 2025 training company and one open accounting period. It does not add future operating years, parallel periods, consolidation, FX, purchase-order matching or real multi-user approvals. The React wrapper uses the new shared registry, but full dependency-backed React/build and hosted end-to-end verification remain outstanding.

For the detailed simulation calendar and unchanged accounting scope, see the [archived day-by-day guide](../archive/2026-09-07/DAY-BY-DAY-V3.md).
