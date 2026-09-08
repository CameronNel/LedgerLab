# Local browser regressions

**Status at this continuation: supplied, syntax-checked, NOT executed.** The sandbox
could not install the locked React/Vinext dependencies. Do not report these browser
checks as passing until they actually run against the local application.

The driver uses the real application and `/api/workspace`, with an isolated fictional
owner in local D1. It never disables or edits production authentication, and rejects
non-loopback target URLs. The fixture identity headers are only a local stand-in for
the platform gateway; this does **not** test the hosted sign-in/allowlist boundary.

Use a compatible Node 22.13+ / Linux development environment. From the project root:

```bash
npm ci
# The database ID matches the existing Vite local-only placeholder, not a live DB.
npx wrangler d1 execute site-creator-d1 --local --config scripts/browser/wrangler.jsonc --persist-to .wrangler/state --file drizzle/0000_careless_shadow_king.sql
npm run dev -- --host 127.0.0.1
```

Apply the migration only to a fresh local database. An existing migrated local database
does not need that command. Never add `--remote` and never deploy with this test config.

In a second terminal, install the optional test tooling and run:

```bash
python -m pip install playwright
python -m playwright install chromium
python scripts/browser/check.py --base-url http://127.0.0.1:5173
# Or use an existing compatible Chromium executable:
python scripts/browser/check.py --base-url http://127.0.0.1:5173 --chromium /usr/bin/chromium
```

If Vite reports a different loopback port, pass that origin. Local migration configuration
and persistence paths should be checked against the installed Cloudflare/Vite version.
The driver deliberately fails rather than substituting a mocked UI or weakening auth.

Coverage intended: initial delayed load; notebook navigation and persistence; two-tab
revision conflict; lost save acknowledgement after a real commit; download/restore;
all 18 main views, takeover replacement, invoice capture dialog opening, role and forecast draft persistence, and blocked premature close; mobile menu and horizontal overflow. It records a Playwright trace,
a narrow-screen screenshot and results under ignored `outputs/browser/`.

Additional browser work remains: detailed invoice/journal dialogs, CSV uploads, bank
matching, period locks and all report/workpaper tabs. The numerical/workflow suites
exercise their engine logic, not those UI interactions.

References: Playwright Python browser and screenshot documentation at
https://playwright.dev/python/docs/browsers and
https://playwright.dev/python/docs/screenshots ; Cloudflare local D1 documentation at
https://developers.cloudflare.com/d1/best-practices/local-development/ .
