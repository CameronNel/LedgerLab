# Finance PC verification

Verified against the preceding `LedgerLab-finance-takeover-2026-09-07.zip` source snapshot. All results below concern the edited source and local checks. No deployment, live database change or remote permission change was made.

## Executed checks

| Suite | Passed assertions/checks |
| --- | ---: |
| Accounting engine, five seeded cases | 7,938 |
| Workflows, imports, schedules and state controls | 352 |
| Existing persistence/session/production-handler SQLite suite | 269 |
| Takeover, full-year progression, forecasts and close controls | 30,184 |
| New desktop catalogue, monthly gates, formulas, file validation and production-handler SQLite suite | 32,503 |
| **Domain/API total** | **71,246** |
| Actual desktop shell in Chromium, isolated from React/Vinext | **44** |

The existing two full-year manager simulations still completed 774 and 776 learner journals, respectively, and 147 role deliverables each. Qualitative management judgement is not independently graded.

The new catalogue checks exercise every starting month for two seeds. They check source and mail date boundaries, attachment references, unique file IDs, folder membership, current AFS presence, explicit missing comparative evidence, template formulas and source immutability.

Saved-file tests exercise legacy backup compatibility, case-insensitive path collisions, malformed/oversized data, source-write rejection, same-millisecond token changes, stale drafts, recycling, restore collisions and read markers. Production request handlers and WorkspaceSession are executed with real local in-memory SQLite for file-save durability, backup restoration, validation, lost acknowledgements and blocked blind retries.

All 131 TypeScript/TSX/MTS source files passed syntax transpilation. The dependency-free desktop, preview, accounting and session dependency graph also passed strict TypeScript checking with TypeScript 5.8.3 and Node 22.16.0. These are not substitutes for the full application's locked-version typecheck.

## Browser checks: exact scope

The browser harness runs the actual `lib/desktop/shell.ts`, catalogue, worksheets and WorkspaceSession through the separate preview fixture. Production document and worksheet rendering are used. Accounting-app callbacks are labelled preview fixtures, not rendered React screens.

Executed with Playwright and the available Chromium binary. Because navigation from this environment was blocked by browser policy, the harness supplied the self-contained preview using `page.set_content` and made no network requests. The preview used browser-memory storage in this harness; production SQLite persistence was tested separately. The production cryptographic identifier fallback worked without a test-only UUID shim.

The 44 checks include folder navigation, original source viewing, sandbox settings, exact invoice-capture callback IDs, future-month search, resetting stale search, mail search/read state/attachments, real formula entry, Ctrl+S, saved-file reload, XLSX download, draft preservation, cancel-close, conflict handling, Save copy, recycling/restoration, lost acknowledgement recovery, CSV import and HTML-escaping, drag, keyboard resize, maximize/restore, side-by-side tiling, a 390px-wide editable layout and the twelve-window cap. No page-level JavaScript errors were observed in these scenarios.

The screenshots show the actual production desktop shell and source evidence in the isolated preview, not the deployed application. The tested XLSX download contained the entered formula and result.

## XLSX verification

Three separate exported workbooks were checked: a formula regression sheet, the bank-reconciliation template and the file downloaded through Chromium. All passed ZIP CRC checks and XML parsing of every package part. Whitelisted formulas and cached values were checked, including 125 for the browser-entered SUM and -20,940.50 for the untouched July bank-template difference.

All three workbooks were independently imported with the available `artifact_tool` spreadsheet engine. The expected calculated values and retained editable formula were verified. This is not a Microsoft Excel desktop or Excel Online compatibility certification. No macros or external workbook relationships are generated.

## Reproduction

```bash
# Existing TypeScript compiler and Node declarations are sufficient:
node scripts/accounting/run-portable.mjs

# Strict desktop/preview type graph:
tsc --noEmit --strict --target es2022 --moduleResolution node \
  --module commonjs --skipLibCheck lib/desktop/shell.ts scripts/desktop/preview.ts

# Independent desktop preview and browser harness:
node scripts/desktop/bundle.mjs /tmp/LedgerLab-Finance-PC-preview.html
python scripts/desktop/check-browser.py \
  /tmp/LedgerLab-Finance-PC-preview.html /tmp/ledgerlab-desktop-browser

# Source archive integrity and reproducibility:
python scripts/accounting/package-source.py
python scripts/accounting/package-check.py
```

The portable checks were also run in separate suite invocations when a combined local command exceeded the tool's execution window. Counts above are executed successful results, not inferred or merely planned assertions.

## Still required before publishing

The full React integration, original React/browser driver, locked-dependency application typecheck, server component-render suite, production Vinext/Vite/Workers build, identity-provider flow and hosted D1 runtime remain unverified in this environment. The dependency directory is absent and registry access failed with DNS resolution errors. No workaround that weakens authentication, changes the deployment platform or silently swaps dependency versions was introduced.

Run the established install/build procedure and `npm run typecheck`, `npm test`, `npm run build`, then test the desktop with the real React screens and authenticated persistence before an authorised deployment. Specifically check capture forms, journal dialogs, case replacement, shared context updates, classic/desktop navigation, source printing and responsive accounting views. The screenshot and isolated browser checks do not establish those integration outcomes.

## Source packaging

The source-only archive contains 179 project files plus one SHA-256 inventory manifest. Verification passed unique member names, safe paths, file sizes and hashes, exclusion of dependencies/caches/credentials, executable shell-script modes and an identical rebuild from an extracted archive without Git. The updated source, standalone desktop preview and screenshots are separate artifacts. The preview and local test outputs are not accidentally bundled into the production source tree.
