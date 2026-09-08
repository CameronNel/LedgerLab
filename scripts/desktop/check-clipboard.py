#!/usr/bin/env python3
"""Extra Chromium tests: formula-aware cuts, sheet duplication, formatting and screenshot.
Usage: python scripts/desktop/check-clipboard.py WORKSTATION.html OUTPUT_DIRECTORY
"""
from pathlib import Path
import json, sys, os
HTML_PATH=Path(sys.argv[1]); OUT=Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
from playwright.sync_api import sync_playwright, expect
checks=[]
def ck(v,s):
 assert v,s
 checks.append(s)
 print('PASS',s,flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox']);page=b.new_page(viewport={'width':1600,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(HTML_PATH.read_text());page.wait_for_function('!!window.ledgerlabPreview');page.evaluate("ledgerlabPreview.desktop.newWorkbook('blank')");w=page.locator('.pc-window[data-active=true]');w.locator('[data-window-action=max]').click()
 def go(s):
  q=w.get_by_label('Name box',exact=True);q.fill(s);q.press('Enter')
 def enter(s,t):
  go(s);w.locator('.xl-grid-scroll').press('F2');x=w.locator('.xl-cell-editor');x.fill(t);x.press('Enter')
 def act(a):w.locator(f'[data-xl="{a}"]').click()
 def raw(s):go(s);return w.get_by_label('Formula bar',exact=True).input_value()
 def val(s):return w.locator(f'td[aria-label="{s}"] .xl-cell-value').inner_text()
 enter('A1','10');enter('B1','=A1*2');enter('C1','=B1+1');go('B1');act('cut');go('D1');act('paste');ck(raw('B1')=='','Cut removes the source only after paste');ck(raw('D1')=='=A1*2','Cut preserves unmoved formula references');ck(val('C1')=='21' and raw('C1')=='=D1+1','Dependent formula follows a same-sheet move')
 go('D1');act('cut');act('add-sheet');go('B2');act('paste');ck(val('B2')=='20','Cross-sheet cut retains the original precedent');ck('Workpaper' in raw('B2'),'Cross-sheet move qualifies source-sheet references');w.locator('[data-sheet]').first.click();ck(val('C1')=='21','Dependants continue calculating after a cross-sheet move');ck(val('D1')=='','Cross-sheet move clears the original cell');w.locator('.xl-grid-scroll').press('Control+z');w.locator('[data-sheet]').first.click();ck(val('D1')=='20' and raw('C1')=='=D1+1','Undo restores both sheets and dependent references')
 w.locator('[data-ribbon=view]').click();act('duplicate-sheet');ck(w.locator('[data-sheet]').count()==3 and val('D1')=='20','Duplicate worksheet preserves its cells');w.locator('[data-ribbon=home]').click();go('D1');act('italic');act('underline');act('align-center');act('wrap');ck(w.locator('td[aria-label=D1]').evaluate("e=>getComputedStyle(e).fontStyle==='italic' && getComputedStyle(e).textAlign==='center' && getComputedStyle(e).textDecorationLine.includes('underline')"),'Italic, underline and alignment controls apply');ck('white-space:normal' in w.locator('td[aria-label=D1]').get_attribute('style'),'Wrap control applies');go('B5');enter('B5','1.2345');go('B5');act('decimals-more');ck(val('B5')=='1.235','Increase decimals applies');act('decimals-less');ck(val('B5')=='1.23','Decrease decimals applies')
 # A clean separate page supplies a representative screenshot without test-error toasts.
 fresh=b.new_page(viewport={'width':1600,'height':1050});fresh.set_content(HTML_PATH.read_text());fresh.wait_for_function('!!window.ledgerlabPreview');fresh.evaluate("ledgerlabPreview.desktop.newWorkbook('bank')");fresh.locator('.pc-window[data-active=true] [data-window-action=max]').click();fresh.screenshot(path=str(OUT/'workstation-spreadsheet.png'));ck(not errors,'No uncaught browser errors in cut and format checks');(OUT/'clipboard-verification.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors},indent=2));b.close()
