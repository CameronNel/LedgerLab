# LedgerLab 3.2: your daily workspace

## First run

Open the current standalone HTML. A fresh case begins on 1 July 2025 with the financial-manager role and a messy handover. Today is the first open window. Read the onboarding email, open its assignment and inspect the supplied evidence.

The seven permanent sections organize the existing tools. Today is the home screen; the desktop is the environment, not another competing finance desk. The classic sidebar uses the same registry and retains old bookmark IDs.

## A smaller daily queue

Today shows one recommended action and a short next queue before general guidance. Critical control tasks and due follow-ups take priority. A future follow-up is not treated as something to do now, and Waiting is never shown as completed.

Choose **My tasks** to search references, source titles, people or task descriptions. Combine status and work-area filters. Only arrived work is included. The list shows 20 tasks per page and reports the exact matching count; Reset filters restores an understandable starting point. Expand the routine or tool guide only when needed.

Amounts use a dot for decimals. `1234.56` and `1,234.56` both mean the same amount; `1,2` is rejected because treating that input as 12 would be unsafe. A rejected amount stays on screen for correction. Draft saves and task submission remain separate.

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

## Read-only ledger checks

Open **Close → Ledger checks**, or search for Ledger checks. The selected month is shown together with the evidence cut-off. Journal findings cover that month; suspense is cumulative through the cut-off. Possible duplicate postings, repeated journal identifiers, unbalanced/invalid lines, invalid accounts/control contacts, missing source links, suspense and unmatched arrived bank lines can be investigated from here.

Flags are advisory, not automatic corrections. An unsupported manual adjustment may be valid. Legitimate recurring journals can look similar. Inspect the evidence before reversing anything. Reversal-linked originals are excluded from duplicate-posting suggestions. CSV export contains all current findings, not only the visible page. No findings does not replace reconciliations, the full month review or professional judgement.

Review notes now have task search, stage filters, bounded pages and an export of original findings and saved response history. Saving a review note never posts a correcting journal.

## A less noisy inbox

Inbox, Sent and Drafts are distinct. Only incoming unread correspondence counts as unread. Switching folders does not mark mail read. A link to a specific message clears stale filters so the requested message actually opens. All correspondence remains fictional.

## Storage and recovery

The amber banner identifies memory-only sessions or another tab changing the save. **Backup saved work**, Settings' backup action, or **Ctrl/Cmd+Shift+S** exports the confirmed saved state. Unsaved response/workbook drafts are excluded, so save or download them separately.

The offline app does not replace corrupt browser data with a fresh case. Its recovery page offers the original stored text for download. Choose a valid backup and type **REPLACE SAVED DATA** before restoring. Starting a fresh case is a separate explicit choice with the same confirmation. Storage quota or access errors report a failed save and retain the previous confirmed state. Free space and retry; do not assume the onscreen change is already durable.

Browser persistence belongs to the origin and browser profile, not the filename alone. A localhost/HTTP persistence check does not prove every browser permits durable `file://` storage. On origins without Web Locks, cross-tab writes retain revision checks but not the stronger lock guarantee. Regular exports remain necessary.

Closing a dirty window uses a native modal with Save/Discard/Cancel and Escape to cancel. Repainting unrelated saved data preserves input focus and selection. Restoring even the same case invalidates older draft ownership, so an old response cannot silently overwrite restored work. An unsaved end-of-day note also blocks a silent close; record it with the date change, download it or deliberately discard it.

## Dates, saves and close controls remain separate

PC date controls evidence arrival; source/effective date controls accounting; the open accounting month controls the close. Reading email, saving a workbook, submitting an assignment, checking work, submitting a month review, closing a period and releasing the next month remain distinct operations.

Export backups before switching case/browser/file versions. Browser-local storage is not shared automatically between origins. In Preview memory only mode, export before closing. No real email, payment, bank feed or filing integration is added.

## Current boundaries

This cleanup preserves a single AUD 2025 training company and one open accounting period. It does not add future operating years, parallel periods, consolidation, FX, purchase-order matching or real multi-user approvals. The React wrapper uses the new shared registry, and dependency-backed React type checking has passed on GitHub; production-build and hosted end-to-end verification remain separate.

For the detailed simulation calendar and unchanged accounting scope, see the [archived day-by-day guide](../archive/2026-09-07/DAY-BY-DAY-V3.md).
