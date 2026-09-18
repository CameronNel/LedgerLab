#!/usr/bin/env python3
"""Check text geometry of safety controls, not merely their border boxes."""
from pathlib import Path
import json, os, sys
from playwright.sync_api import sync_playwright

html = Path(sys.argv[1]).read_text()
out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
checks = []; errors = []

def ck(value, label):
    assert value, label
    checks.append(label)
    print(f'PASS {len(checks)} {label}', flush=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM', '/usr/bin/chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390, 'height':844}, accept_downloads=True)
    page.on('pageerror', lambda error: errors.append(str(error)))
    # Opaque origin deliberately exercises the prominently labelled memory-only warning.
    page.set_content(html)
    page.wait_for_function('!!window.ledgerlabPreview')
    backup = page.locator('.pc-storage-banner [data-action=backup-now]')
    for width in (320, 390, 600, 768, 1440):
        page.set_viewport_size({'width':width, 'height':900})
        backup.wait_for(state='visible')
        geometry = backup.evaluate('''button => {
          const box=button.getBoundingClientRect(), label=button.querySelector('span');
          const range=document.createRange(); range.selectNodeContents(label);
          const rects=Array.from(range.getClientRects());
          return {
            buttonFits:box.left>=0 && box.right<=innerWidth+1,
            labelFits:rects.length>0 && rects.every(r=>r.left>=box.left-1 && r.right<=box.right+1 && r.top>=box.top-1 && r.bottom<=box.bottom+1),
            noOverflow:button.scrollWidth<=button.clientWidth+1,
            text:label.textContent,
            iconHidden:getComputedStyle(button.querySelector('svg')).display==='none'
          };
        }''')
        ck(geometry['buttonFits'], f'{width}px: backup button is within the viewport')
        ck(geometry['labelFits'] and geometry['noOverflow'], f'{width}px: every line of the backup label stays inside its button')
        ck(geometry['text']=='Backup saved work', f'{width}px: the complete backup label is retained')
        if width<=600:
            ck(geometry['iconHidden'], f'{width}px: decorative icon gives its space to the safety label')
        if width==390:
            page.screenshot(path=str(out/'mobile-backup-readable.png'), animations='disabled')
    page.set_viewport_size({'width':320, 'height':900})
    with page.expect_download() as download:
        backup.click()
    payload=json.loads(Path(download.value.path()).read_text())
    ck(payload.get('format')=='LedgerLab backup' and isinstance(payload.get('state'),dict), 'Small-screen backup action still exports a valid backup')
    ck(errors==[], 'Responsive safety-control journey has no uncaught page errors')
    browser.close()

(out/'results.json').write_text(json.dumps({'assertions':len(checks),'checks':checks,'page_errors':errors}, indent=2))
print(f'Responsive safety controls: {len(checks)} assertions passed.', flush=True)
