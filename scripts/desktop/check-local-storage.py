#!/usr/bin/env python3
"""Actual localhost-origin storage, restart, quota, recovery and two-tab acceptance.
No live learner data: uses an isolated temporary browser profile and generated case.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import json, os, sys
from playwright.sync_api import sync_playwright
HTML=Path(sys.argv[1]); OUT=Path(sys.argv[2]); OUT.mkdir(parents=True,exist_ok=True)
KEY='ledgerlab-finance-pc-preview-v1'; checks=[]; errors=[]
def ck(value,label):
    assert value,label
    checks.append(label); print(f'PASS {len(checks)} {label}',flush=True)
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        data=HTML.read_bytes(); self.send_response(200); self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(data)
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
def ready(page):
    page.wait_for_function('!!window.ledgerlabPreview');page.wait_for_function('!ledgerlabPreview.model().saving')
def save(page,note): return page.evaluate('(notes)=>ledgerlabPreview.session.save({type:"saveNotes",notes})',note)
with TemporaryDirectory(prefix='ledgerlab-storage-profile-') as profile, sync_playwright() as pw:
    def launch():
        c=pw.chromium.launch_persistent_context(profile,executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'],viewport={'width':1440,'height':900},accept_downloads=True)
        c.on('page',lambda p:p.on('pageerror',lambda e:errors.append(str(e))));return c
    ctx=launch();page=ctx.pages[0];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url);ready(page)
    ck(page.evaluate('ledgerlabPreview.model().storageMode')=='browser','Real HTTP origin uses browser storage')
    ck(page.evaluate('!!navigator.locks'),'Cross-tab Web Locks supported on test origin')
    ck(save(page,'Persistent case survives a browser process restart.')['ok'],'Notebook saved through actual persistent adapter')
    raw=page.evaluate('(key)=>localStorage.getItem(key)',KEY)
    ck(json.loads(raw)['state']['notes'].startswith('Persistent case'),'Confirmed payload stored in localStorage')
    page.reload();ready(page)
    ck(page.evaluate('ledgerlabPreview.model().state.notes').startswith('Persistent case'),'Saved notebook survives page reload')
    ctx.close();ctx=launch();page=ctx.pages[0];page.goto(url);ready(page)
    ck(page.evaluate('ledgerlabPreview.model().state.notes').startswith('Persistent case'),'Saved notebook survives Chromium process restart')
    backup=page.evaluate('ledgerlabPreview.model().state')
    # Failed persistent writes must not claim success or update state.
    page.evaluate('''() => {window.originalSetItem=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){if(k==='ledgerlab-finance-pc-preview-v1')throw new DOMException('quota','QuotaExceededError');return window.originalSetItem.call(this,k,v)}}''')
    result=save(page,'This must not replace the confirmed notebook.')
    ck(not result['ok'],'Quota failure is not acknowledged as saved')
    ck('not saved' in page.evaluate('ledgerlabPreview.model().error').lower(),'Quota error is explicit in save status')
    ck(page.evaluate('(key)=>localStorage.getItem(key)',KEY)==raw,'Quota failure preserves exact original stored bytes')
    ck(page.evaluate('ledgerlabPreview.model().state.notes')==backup['notes'],'Quota failure keeps last confirmed state')
    page.evaluate('Storage.prototype.setItem=window.originalSetItem');page.evaluate('ledgerlabPreview.session.load()')
    # Cross-tab race: both tabs loaded same revision, only one may commit.
    second=ctx.new_page();second.goto(url);ready(second)
    page.evaluate('()=>{window.race=ledgerlabPreview.session.save({type:"saveNotes",notes:"First competing writer"})}')
    second.evaluate('()=>{window.race=ledgerlabPreview.session.save({type:"saveNotes",notes:"Second competing writer"})}')
    a=page.evaluate('window.race');b=second.evaluate('window.race')
    ck(sum(bool(r['ok']) for r in [a,b])==1,'Exactly one same-revision tab write succeeds')
    loser=second if a['ok'] else page
    ck('reload' in loser.evaluate('ledgerlabPreview.model().error').lower(),'Losing tab receives conflict instead of overwrite')
    ck('Another tab' in loser.locator('.pc-storage-banner').inner_text(),'External save is visibly signalled')
    loser.evaluate('ledgerlabPreview.session.load()');ready(loser)
    ck(loser.evaluate('ledgerlabPreview.model().state.notes')==('First competing writer' if a['ok'] else 'Second competing writer'),'Reload adopts the winning saved state')
    second.close()
    # Invalid bytes on startup must show recovery, never silently seed a fresh case.
    page.evaluate('(key)=>localStorage.setItem(key,"{ corrupt saved workspace")',KEY);page.reload()
    page.locator('.pc-recovery').wait_for()
    ck(page.locator('.finance-pc').count()==0,'Corrupt startup stops before creating a fresh desktop')
    ck(page.evaluate('(key)=>localStorage.getItem(key)',KEY)=='{ corrupt saved workspace','Corrupt bytes remain untouched')
    with page.expect_download() as dl:page.locator('[data-recover-download]').click()
    ck(Path(dl.value.path()).read_text()=='{ corrupt saved workspace','Recovery download preserves exact stored text')
    page.locator('[data-recover-new]').click()
    ck('REPLACE SAVED DATA' in page.locator('[data-recover-status]').inner_text(),'Recovery refuses replacement without explicit confirmation')
    ck(page.evaluate('(key)=>localStorage.getItem(key)',KEY)=='{ corrupt saved workspace','Rejected recovery does not overwrite data')
    page.locator('[data-recover-file]').set_input_files({'name':'case-backup.json','mimeType':'application/json','buffer':json.dumps({'state':backup}).encode()})
    page.wait_for_function('document.querySelector("[data-recover-status]").textContent.includes("Backup validated")')
    page.screenshot(path=str(OUT/'storage-recovery.png'))
    page.locator('[data-recover-confirm]').fill('REPLACE SAVED DATA');page.locator('[data-recover-restore]').click();ready(page)
    ck(page.evaluate('ledgerlabPreview.model().state.notes')==backup['notes'],'Explicit validated backup restore recovers original notebook')
    # Removal after a confirmed read is not an invitation to silently reset.
    page.evaluate('(key)=>localStorage.removeItem(key)',KEY)
    result=page.evaluate('ledgerlabPreview.session.load()')
    ck(not result['ok'],'Removed storage after a confirmed save is detected')
    ck(page.evaluate('(key)=>localStorage.getItem(key)',KEY) is None,'Missing saved data is not silently replaced')
    ck(errors==[],'No uncaught errors during storage/restart/recovery scenarios')
    ctx.close()
server.shutdown()
(OUT/'results.json').write_text(json.dumps({'assertions':len(checks),'checks':checks,'page_errors':errors},indent=2))
print(f'Local storage Chromium: {len(checks)} assertions passed.',flush=True)
