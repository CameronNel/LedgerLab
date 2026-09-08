#!/usr/bin/env python3
"""Browser regression driver for the real LedgerLab app on loopback only.

Requires a running local Vinext/Workers development server with the local D1
migration applied. It creates a random fictional QA owner; never uses live data.
Run: python scripts/browser/check.py --base-url http://127.0.0.1:5173
"""
import argparse
import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from playwright.async_api import async_playwright, expect

VIEWS = ["career", "overview", "practice", "documents", "ledger", "receivables", "payables",
         "bank", "payroll", "close", "assets", "inventory", "provisions", "tax",
         "reports", "audit", "knowledge", "settings"]


def local_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise argparse.ArgumentTypeError("Use an HTTP loopback URL only. This script must not target a published site.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
        raise argparse.ArgumentTypeError("Use only the local server origin, without credentials, paths or query parameters.")
    return value.rstrip("/")


async def main(args):
    output = Path(args.artifacts) / uuid4().hex[:10]
    output.mkdir(parents=True, exist_ok=True)
    results = []
    errors = []
    async with async_playwright() as playwright:
        launch = {"headless": True}
        if args.chromium:
            launch["executable_path"] = args.chromium
        browser = await playwright.chromium.launch(**launch)
        context = await browser.new_context(viewport={"width": 1440, "height": 1000}, extra_http_headers={
            "oai-authenticated-user-id": f"ledgerlab-local-qa-{uuid4()}",
            "oai-authenticated-user-email": "ledgerlab-qa@example.invalid",
            "oai-authenticated-user-full-name": "Local%20QA",
            "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
        })
        await context.tracing.start(screenshots=True, snapshots=True)
        page = await context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        # Restrict the local test browser, including any navigation/redirect, to loopback.
        async def local_only(route):
            host = urlparse(route.request.url).hostname
            if host not in {"127.0.0.1", "localhost", "::1"}:
                await route.abort()
            else:
                await route.continue_()
        await context.route("**/*", local_only)
        api = args.base_url + "/api/workspace"

        async def get_state():
            reply = await context.request.get(api, max_redirects=0)
            if reply.status != 200:
                raise AssertionError(f"Local workspace API returned {reply.status}. Apply the local D1 migration first: {await reply.text()}")
            return await reply.json()

        async def action(command):
            current = await get_state()
            reply = await context.request.post(api, data={"revision": current["revision"], "command": command}, max_redirects=0)
            if reply.status != 200:
                raise AssertionError(f"Fixture action returned {reply.status}: {await reply.text()}")
            return await reply.json()

        try:
            anonymous = await browser.new_context()
            denied = await anonymous.request.get(api, max_redirects=0)
            assert denied.status == 401, "Unauthenticated local API must remain protected"
            await anonymous.close()
            await action({"type": "saveNotes", "notes": "Notebook saved before the browser opens"})
            results.append("Local API authentication and isolated fixture creation")

            # Hold the first workspace GET: the app must not mount a blank notebook.
            gate = asyncio.Event()
            requested = asyncio.Event()
            async def delayed_load(route):
                requested.set()
                await gate.wait()
                await route.continue_()
            await page.route("**/api/workspace", delayed_load, times=1)
            await page.goto(args.base_url + "/#settings", wait_until="domcontentloaded")
            await asyncio.wait_for(requested.wait(), timeout=30)
            await expect(page.get_by_role("heading", name="Loading your saved practice…")).to_be_visible()
            await expect(page.get_by_role("textbox", name="Practice notebook", exact=True)).to_have_count(0)
            gate.set()
            notebook = page.get_by_role("textbox", name="Practice notebook", exact=True)
            await expect(notebook).to_have_value("Notebook saved before the browser opens")
            results.append("Slow initial load does not mount a stale blank notebook")

            await notebook.fill("Unsaved draft retained across navigation")
            await page.get_by_role("button", name="Overview", exact=True).click()
            await page.get_by_role("button", name="Case, notebook & data", exact=True).click()
            await expect(notebook).to_have_value("Unsaved draft retained across navigation")
            await page.get_by_role("button", name="Save notebook", exact=True).click()
            await expect(page.locator(".save-status")).to_have_text("Saved workspace")
            await expect(page.get_by_role("button", name="Save notebook", exact=True)).to_be_disabled()
            assert (await get_state())["state"]["notes"] == "Unsaved draft retained across navigation"
            results.append("Notebook navigation, save button and persisted state agree")

            second = await context.new_page()
            second.on("pageerror", lambda error: errors.append(str(error)))
            await second.goto(args.base_url + "/#settings")
            second_notebook = second.get_by_role("textbox", name="Practice notebook", exact=True)
            await expect(second_notebook).to_have_value("Unsaved draft retained across navigation")
            await second_notebook.fill("Draft from the second tab")
            await notebook.fill("Saved from the first tab")
            await page.get_by_role("button", name="Save notebook", exact=True).click()
            await expect(page.locator(".save-status")).to_have_text("Saved workspace")
            await expect(page.get_by_role("button", name="Save notebook", exact=True)).to_be_disabled()
            await second.get_by_role("button", name="Save notebook", exact=True).click()
            await expect(second.locator(".alert-bar")).to_contain_text("another tab")
            await second.get_by_role("button", name="Reload saved work", exact=True).click()
            await expect(second_notebook).to_have_value("Draft from the second tab")
            await expect(second.get_by_text("The saved notebook changed", exact=True)).to_be_visible()
            await expect(second.get_by_role("button", name="Save notebook", exact=True)).to_be_disabled()
            await second.get_by_role("button", name="Keep my draft", exact=True).click()
            await second.get_by_role("button", name="Save notebook", exact=True).click()
            await expect(second.locator(".save-status")).to_have_text("Saved workspace")
            await expect(second.get_by_role("button", name="Save notebook", exact=True)).to_be_disabled()
            assert (await get_state())["state"]["notes"] == "Draft from the second tab"
            results.append("Two-tab conflict preserves draft and requires an explicit choice")
            await second.close()
            await page.reload()
            await expect(notebook).to_have_value("Draft from the second tab")

            async def lose_acknowledgement(route):
                reply = await route.fetch()
                assert reply.status == 200, "Simulated loss must occur after a successful server commit"
                await route.abort("failed")
            await page.route("**/api/workspace", lose_acknowledgement, times=1)
            await notebook.fill("Saved despite a lost acknowledgement")
            await page.get_by_role("button", name="Save notebook", exact=True).click()
            await expect(page.locator(".save-status")).to_have_text("Save status unconfirmed")
            actual = await get_state()
            assert actual["state"]["notes"] == "Saved despite a lost acknowledgement"
            await page.get_by_role("button", name="Save notebook", exact=True).click()
            assert (await get_state())["revision"] == actual["revision"], "Blocked retry must not post again"
            await page.get_by_role("button", name="Reload saved work", exact=True).click()
            await expect(page.locator(".save-status")).to_have_text("Saved workspace")
            await expect(page.get_by_role("button", name="Save notebook", exact=True)).to_be_disabled()
            await expect(notebook).to_have_value("Saved despite a lost acknowledgement")
            results.append("Committed-but-lost response is recovered without duplicate posting")

            async with page.expect_download() as download_event:
                await page.get_by_role("button", name="Download full backup", exact=True).click()
            download = await download_event.value
            backup_path = output / "fixture-backup.json"
            await download.save_as(str(backup_path))
            backup = json.loads(backup_path.read_text())
            assert backup["state"]["notes"] == "Saved despite a lost acknowledgement"
            await notebook.fill("Change before restore")
            await page.get_by_role("button", name="Save notebook", exact=True).click()
            await expect(page.locator(".save-status")).to_have_text("Saved workspace")
            await expect(page.get_by_role("button", name="Save notebook", exact=True)).to_be_disabled()
            await page.locator('input[type="file"][accept*="json"]').set_input_files(str(backup_path))
            await page.get_by_role("button", name="Restore backup", exact=True).click()
            await expect(notebook).to_have_value("Saved despite a lost acknowledgement")
            results.append("Backup download and same-seed restore update the visible notebook")

            for view in VIEWS:
                await page.goto(args.base_url + "/#" + view)
                await expect(page.locator(".save-status")).to_have_text("Saved workspace")
                await expect(page.locator(".workspace-content h1").first).to_be_visible()
                assert not errors, f"Browser errors in {view}: {errors}"
            results.append("All 18 navigation views render without page exceptions")
            await page.goto(args.base_url + "/#career")
            await page.get_by_role("button", name="Set up my takeover", exact=True).click()
            await page.get_by_role("textbox", name="Confirm takeover replacement", exact=True).fill("START TAKEOVER")
            async with page.expect_download():
                await page.get_by_role("button", name="Download backup & start takeover", exact=True).click()
            await expect(page.get_by_role("heading", name="Your finance desk", exact=True)).to_be_visible()
            takeover = (await get_state())["state"]
            assert takeover["career"]["activeMonth"] == "2025-07" and takeover["journals"] == []
            assert takeover["mode"] == "exam", "Takeover starts without worked-answer access"
            await page.get_by_role("tab", name="Processing queue", exact=True).click()
            await expect(page.get_by_role("heading", name="Unprocessed evidence and monthly work", exact=True)).to_be_visible()
            await page.get_by_role("button", name="Capture invoice", exact=True).first.click()
            await expect(page.get_by_role("dialog")).to_be_visible()
            await page.keyboard.press("Escape")
            await page.get_by_role("tab", name="Role deliverables", exact=True).click()
            await page.get_by_role("button", name="Save draft", exact=True).click()
            await expect(page.locator(".save-status")).to_have_text("Saved workspace")
            assert (await get_state())["state"]["career"]["submissions"], "Role draft must persist"
            await page.get_by_role("tab", name="13-week cash forecast", exact=True).click()
            await page.get_by_role("button", name="Save forecast draft", exact=True).click()
            await expect(page.locator(".save-status")).to_have_text("Saved workspace")
            assert (await get_state())["state"]["career"]["forecasts"]["2025-07"]["status"] == "draft"
            await page.get_by_role("tab", name="Close & advance", exact=True).click()
            await expect(page.get_by_role("button", name="Close July 2025", exact=True)).to_be_disabled()
            await page.reload()
            await expect(page.get_by_role("heading", name="Your finance desk", exact=True)).to_be_visible()
            results.append("Takeover setup, source-capture dialog, role/forecast draft persistence and blocked premature close")
            await page.set_viewport_size({"width": 390, "height": 844})
            await page.goto(args.base_url + "/#settings")
            await expect(notebook).to_be_visible()
            await page.screenshot(path=str(output / "settings-mobile.png"), full_page=True)
            overflow = await page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
            assert not overflow, "Narrow-screen page should not overflow horizontally"
            await page.get_by_role("button", name="Toggle navigation", exact=True).click()
            await page.get_by_role("button", name="Overview", exact=True).click()
            await expect(page.locator(".workspace-content h1").first).to_be_visible()
            results.append("390-pixel viewport and mobile navigation")
            assert not errors, errors
            print(f"PASS: {len(results)} browser workflow groups")
        finally:
            await context.tracing.stop(path=str(output / "trace.zip"))
            (output / "results.json").write_text(json.dumps({"completed": results, "browser_errors": errors}, indent=2))
            await browser.close()
            print(f"Local QA artifacts: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", type=local_url, default="http://127.0.0.1:5173")
    parser.add_argument("--chromium", help="Optional installed Chromium executable path")
    parser.add_argument("--artifacts", default="outputs/browser", help="Local-only QA output directory")
    asyncio.run(main(parser.parse_args()))
