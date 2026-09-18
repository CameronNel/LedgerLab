# LedgerLab verification — 7 September 2026

## Scope and environment

This record describes checks actually performed on the continuation source. It does
not certify the hosted application, the full React/Vinext build or the complete browser UI.

- Runtime: Node.js **22.16.0**, Linux; Python **3.13.5**.
- Available fallback TypeScript: **5.8.3**; available Node type declarations: **25.1.0**.
- Locked project versions remain unchanged: TypeScript **5.9.3**, Node declarations
  **22.19.19**, and the existing application dependencies.
- `npm ci` could not complete because registry DNS/network access failed (`EAI_AGAIN`).
  Full application dependencies were not available. No lockfile/version changes were
  made to conceal this restriction.

## Executed checks

| Check | Result | What it establishes |
| --- | --- | --- |
| Existing numerical suite | **7,938 assertions passed** | Five independently generated accounting cases |
| Existing workflow suite | **352 assertions passed** | Posting, reversal, import, schedule, backup and closing-control logic |
| New persistence suite | **242 assertions passed** | Client coordination, notebook merging, production request validation and SQLite concurrency |
| Scoped TypeScript compilation | **Passed** | Strict, no-emit-on-error compilation of those suites and their real dependencies |
| TS/TSX syntax transpilation | **118 source files passed** | No syntax diagnostics; not a complete application typecheck |
| D1 adapter assignment check | **Passed** | Production `getDatabase` matches the handler interface using the checked-in D1 declarations |
| Browser target URL guards | **11 cases passed** | Local origins accepted; hosted/credential-bearing/path-bearing targets rejected |
| Python syntax | **Passed** | Browser driver, source packager and package checker compile |
| Shell syntax | **Passed** | Build, install and environment scripts pass `bash -n` |
| Git whitespace check | **Passed** | `git diff --check` reports no whitespace errors |

The first three suites total **8,532 assertions**. The 11 URL guard checks are separate
and do not count as browser workflow execution. Node SQLite emits an experimental-feature
warning on this runtime; the tests nonetheless ran and passed.

The accounting and workflow suites were also run against the unmodified uploaded snapshot
first (7,938 and 352 passing), establishing a baseline before the edits.

### Persistence regression scope

Includes concurrent initial-load deduplication; writes during loads; double submissions;
reload during a write; rejected/malformed/unauthenticated save responses; old or suspect
revision acknowledgements; two-tab conflicts; notebook draft preservation and explicit
resolution; same-seed case/backup replacement; typing during acknowledgement; JSON/media/
UTF-8/body/state size limits; owner separation; parameterised SQL; real concurrent SQLite
compare-and-swap; failed atomic import; journal duplicate rejection; legacy backups; and
recovery after a save really commits but its response is lost. Invalid nested command
results are rejected before database mutation.

These use the **production session and handler modules** with in-memory SQLite and the
original SQL migration. They do not execute a hosted D1 database, platform identity
provider, real network gateway or React application.

### Actual portable-suite output

```text
> ledgerlab-accounting-practice@0.1.0 test:portable
> node scripts/accounting/run-portable.mjs

Portable verification: Version 5.8.3; Node v22.16.0.
Checks domain logic and the production request/session logic; not the React UI or deployment build.
PASS: 7,938 accounting checks across five independently generated cases.
PASS: 352 workflow, import, state, reference, schedule and close-control checks.
(node:1239) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
PASS: 242 persistence, notebook, request-validation and SQLite concurrency checks.
Uses the production handlers/session logic with a real in-memory SQLite adapter. This is not a browser, D1-hosting or identity-provider end-to-end test.
```

## Blocked or not run

| Check | Actual status |
| --- | --- |
| `npm run typecheck` | **Failed, exit 2**: missing dependency type definitions, including d3/react/node-related packages. No full application typecheck pass claimed. |
| `npm run build` | **Failed, exit 69**: `vinext` unavailable. Bash bootstrap reached this explicit dependency check instead of failing on script permissions. No production bundle produced. |
| Normal `npm test` / React SSR suite | **Not run**: dependencies unavailable. The handover's historical 75 screen renders are not a result from this continuation. |
| `npm run lint` | **Not run**: dependencies unavailable. |
| `scripts/browser/check.py` | **Not run against the app**: supplied and syntax/URL-guard checked only. No browser screenshots or passing workflow results produced. |
| Hosted identity, owner allowlist, remote repository and live migration | **Not accessed or verified**. |
| Publication | **Not performed**. Existing hosted app and data were not changed. |

## Distribution checks

**Passed:** 157 project source files plus exactly one source manifest. Every member
name is unique; the manifest covers every source member with matching byte lengths
and SHA-256 hashes. Excluded dependency/cache/export/credential file paths are absent,
and all packaged shell files have executable modes.

**Passed:** extracting the ZIP outside Git and rerunning the source packager produces
an identical ZIP byte for byte. A deliberately added unrelated local-practice fixture
is excluded from that rebuild.

**Passed:** the patch applies cleanly to a separate checkout of the imported uploaded
handover snapshot. All 25 changed/new paths match the continuation source byte for byte.
This establishes compatibility with that snapshot, not an uninspected live Git branch.

Reproduce archive validation from the source root:

```bash
python scripts/accounting/package-source.py
python scripts/accounting/package-check.py
```

## Reproduce

With the full locked dependencies installed:

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
```

For the three dependency-free domain/session/API suites using an existing compiler:

```bash
npm run test:portable
# Optional: only the persistence suite
node scripts/accounting/run-portable.mjs persistence
```

The fallback runner searches for local or global `tsc` and Node declarations. Explicit
existing paths may be supplied with `LEDGERLAB_TSC` and `LEDGERLAB_TYPE_ROOTS`.
Use `scripts/browser/README.md` for optional local browser setup. Do not infer a deployed
or deployment-ready version from this report.
