#!/usr/bin/env python3
"""Real-origin transactional storage, migration, rollback, restart and competing tabs.
Uses a disposable profile and synthetic data. Never touches a learner's browser.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import json, os, sys
from playwright.sync_api import sync_playwright

HTML = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
KEY = 'ledgerlab-finance-pc-preview-v1'
DATABASE = 'ledgerlab-workspace-v1'
checks = []; errors = []

def ck(value, label):
    assert value, label
    checks.append(label)
    print(f'PASS {len(checks)} {label}', flush=True)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        data = HTML.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers(); self.wfile.write(data)
    def log_message(self, *args): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'

def ready(page):
    page.wait_for_function('!!window.ledgerlabPreview')
    page.wait_for_function('!ledgerlabPreview.session.getSnapshot().loading && !ledgerlabPreview.model().saving')

def save(page, note):
    return page.evaluate('(notes)=>ledgerlabPreview.session.save({type:"saveNotes",notes})', note)

# Inspect the actual storage boundary, not a test double of the adapter.
DB_OPERATION = '''({database,operation,value}) => new Promise((resolve,reject)=>{
  const request=indexedDB.open(database,1);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
    const db=request.result,tx=db.transaction('workspace',operation==='read'?'readonly':'readwrite');
    const table=tx.objectStore('workspace');let result;
    const item=operation==='read'?table.get('current'):operation==='delete'?table.delete('current'):table.put(value,'current');
    item.onsuccess=()=>{result=item.result};
    tx.oncomplete=()=>{db.close();resolve(result??null)};
    tx.onabort=()=>{db.close();reject(tx.error)};
  };
})'''

def stored(page):
    return page.evaluate(DB_OPERATION, {'database': DATABASE, 'operation': 'read'})

def corrupt(page, value):
    page.evaluate(DB_OPERATION, {'database': DATABASE, 'operation': 'write', 'value': value})

def restore_put(page):
    page.evaluate('() => { IDBObjectStore.prototype.put=window.originalPut; }')
    ck(page.evaluate('ledgerlabPreview.session.load()')['ok'], 'Reload after rejected transaction succeeds')

try:
  with TemporaryDirectory(prefix='ledgerlab-storage-profile-') as profile, sync_playwright() as pw:
    executable = os.environ.get('CHROMIUM', '/usr/bin/chromium')
    def launch():
        context = pw.chromium.launch_persistent_context(profile, executable_path=executable,
            args=['--no-sandbox'], viewport={'width': 1440, 'height': 900}, accept_downloads=True)
        context.on('page', lambda p: p.on('pageerror', lambda e: errors.append(str(e))))
        return context

    ctx = launch(); page = ctx.pages[0]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url); ready(page)
    ck(page.evaluate('ledgerlabPreview.model().storageMode') == 'browser', 'Real HTTP origin uses persistent browser storage')
    ck(save(page, 'Persistent case survives a browser process restart.')['ok'], 'Notebook saves through the transaction adapter')
    before = stored(page)
    ck(before['state']['notes'].startswith('Persistent case'), 'Acknowledged payload is present in IndexedDB')
    page.reload(); ready(page)
    ck(page.evaluate('ledgerlabPreview.model().state.notes').startswith('Persistent case'), 'Confirmed notebook survives page reload')
    ctx.close(); ctx = launch(); page = ctx.pages[0]; page.goto(url); ready(page)
    ck(page.evaluate('ledgerlabPreview.model().state.notes').startswith('Persistent case'), 'Confirmed notebook survives browser process restart')
    backup = page.evaluate('ledgerlabPreview.model().state')

    # A thrown quota error and a later transaction abort are separate failure paths.
    page.evaluate('''() => { window.originalPut=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,key){
        if(this.name==='workspace' && key==='current')throw new DOMException('quota','QuotaExceededError');
        return window.originalPut.call(this,value,key);
      };
    }''')
    failed = save(page, 'This must not replace the confirmed notebook.')
    ck(not failed['ok'], 'Quota failure is never acknowledged as saved')
    ck('not saved' in page.evaluate('ledgerlabPreview.model().error').lower(), 'Quota failure gives an explicit save error')
    ck(stored(page) == before, 'Quota failure leaves the exact previous envelope intact')
    ck(page.evaluate('ledgerlabPreview.model().state.notes') == backup['notes'], 'Quota failure preserves the last confirmed UI state')
    restore_put(page)
    page.evaluate('''() => { window.originalPut=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,key){
        const request=window.originalPut.call(this,value,key);
        if(this.name==='workspace' && key==='current')request.addEventListener('success',()=>this.transaction.abort(),{once:true});
        return request;
      };
    }''')
    ck(not save(page, 'A successful put is not a committed transaction.')['ok'], 'Abort after a successful put is not acknowledged')
    ck(stored(page) == before, 'Transaction rollback preserves both the previous payload and revision')
    restore_put(page)

    # Exercise the actual same-revision collision repeatedly, alternating start order.
    second = ctx.new_page(); second.goto(url); ready(second)
    rounds = int(os.environ.get('LEDGERLAB_RACE_ROUNDS', '50'))
    assert 1 <= rounds <= 500
    for i in range(rounds):
        for tab in (page, second):
            assert tab.evaluate('ledgerlabPreview.session.load()')['ok']
            ready(tab)
        revisions = [p.evaluate('ledgerlabPreview.session.getSnapshot().revision') for p in (page, second)]
        assert revisions[0] == revisions[1], 'Race precondition: both tabs loaded the same revision'
        notes = [f'Competing writer A / {i}', f'Competing writer B / {i}']
        order = (0, 1) if i % 2 == 0 else (1, 0)
        tabs = (page, second)
        for n in order:
            tabs[n].evaluate('(notes)=>{window.race=ledgerlabPreview.session.save({type:"saveNotes",notes});}', notes[n])
        results = [p.evaluate('window.race') for p in tabs]
        assert sum(bool(r['ok']) for r in results) == 1, f'Race {i}: {results}'
        winner = 0 if results[0]['ok'] else 1
        envelope = stored(page)
        assert envelope['revision'] == revisions[0] + 1, f'Race {i}: revision advanced more than once'
        assert envelope['state']['notes'] == notes[winner], f'Race {i}: winning payload was overwritten'
        loser = tabs[1 - winner]
        assert 'reload' in loser.evaluate('ledgerlabPreview.model().error').lower()
        assert 'Another tab' in loser.evaluate('ledgerlabPreview.model().storageNotice')
        assert loser.evaluate('ledgerlabPreview.session.load()')['ok']
        assert loser.evaluate('ledgerlabPreview.model().state.notes') == notes[winner]
    ck(True, f'{rounds} repeated same-revision races: one commit, one conflict, exact winning payload and revision')

    # Do not require Web Locks for correctness: browsers without that API retain CAS.
    for tab in (page, second):
        tab.evaluate('() => { Object.defineProperty(navigator,"locks",{configurable:true,value:undefined}); }')
        assert tab.evaluate('ledgerlabPreview.session.load()')['ok']
    page.evaluate('()=>{window.race=ledgerlabPreview.session.save({type:"saveNotes",notes:"No Web Locks A"});}')
    second.evaluate('()=>{window.race=ledgerlabPreview.session.save({type:"saveNotes",notes:"No Web Locks B"});}')
    results = [p.evaluate('window.race') for p in (page, second)]
    ck(sum(bool(r['ok']) for r in results) == 1, 'Atomic saves remain safe without Web Locks')
    for tab in (page, second): assert tab.evaluate('ledgerlabPreview.session.load()')['ok']

    # A lost acknowledgement must not turn a committed transaction into an automatic retry.
    prior = page.evaluate('ledgerlabPreview.model().state.notes')
    page.evaluate('ledgerlabPreview.dropNextAcknowledgement()')
    ck(not save(page, 'Committed but acknowledgement lost.')['ok'], 'Lost acknowledgement reports an uncertain outcome')
    ck(page.evaluate('ledgerlabPreview.model().state.notes') == prior, 'Uncertain outcome keeps last confirmed UI state')
    ck(stored(page)['state']['notes'] == 'Committed but acknowledgement lost.', 'Lost acknowledgement fixture truly committed')
    ck(not save(page, 'Do not retry automatically.')['ok'], 'Uncertain saves block another write until reload')
    ck(page.evaluate('ledgerlabPreview.session.load()')['ok'], 'Reload resolves an uncertain transaction')
    ck(page.evaluate('ledgerlabPreview.model().state.notes') == 'Committed but acknowledgement lost.', 'Reload adopts the committed payload')

    # Corrupt payload and stale tab: recovery is explicit and never reuses an old revision.
    assert second.evaluate('ledgerlabPreview.session.load()')['ok']
    previous_revision = stored(page)['revision']
    corrupt(page, '{ corrupt saved workspace')
    page.bring_to_front()
    page.reload(); page.locator('.pc-recovery').wait_for()
    ck(page.locator('.finance-pc').count() == 0, 'Corrupt startup stops before creating a fresh desktop')
    ck(stored(page) == '{ corrupt saved workspace', 'Corrupt payload is left untouched')
    with page.expect_download() as download: page.locator('[data-recover-download]').click()
    recovery = json.loads(Path(download.value.path()).read_text())
    ck(recovery['workspace'] == '{ corrupt saved workspace', 'Recovery download retains the original corrupt payload')
    page.locator('[data-recover-new]').click()
    ck('REPLACE SAVED DATA' in page.locator('[data-recover-status]').inner_text(), 'Recovery requires explicit confirmation')
    ck(stored(page) == '{ corrupt saved workspace', 'Rejected recovery does not overwrite data')
    page.locator('[data-recover-file]').set_input_files({'name':'case-backup.json','mimeType':'application/json','buffer':json.dumps({'state':backup}).encode()})
    page.wait_for_function('document.querySelector("[data-recover-status]").textContent.includes("Backup validated")')
    # The competing tab remains open for the stale-write check. Foreground this tab for the compositor.
    page.bring_to_front()
    page.screenshot(path=str(OUT/'storage-recovery.png'), animations='disabled')
    page.locator('[data-recover-confirm]').fill('REPLACE SAVED DATA')
    page.locator('[data-recover-restore]').click(); ready(page)
    ck(page.evaluate('ledgerlabPreview.model().state.notes') == backup['notes'], 'Validated backup recovery restores the original notebook')
    ck(stored(page)['revision'] > previous_revision, 'Recovery never reuses the pre-corruption revision')
    ck(not save(second, 'A stale tab must not overwrite restored data.')['ok'], 'Pre-recovery tab cannot overwrite the restored workspace')
    ck(stored(page)['state']['notes'] == backup['notes'], 'Rejected stale write preserves recovered data')
    second.close()
    page.evaluate(DB_OPERATION, {'database':DATABASE,'operation':'delete'})
    ck(not page.evaluate('ledgerlabPreview.session.load()')['ok'], 'Removed database payload is detected')
    ck(stored(page) is None, 'Removed saved data is not silently reseeded')
    page.reload(); page.locator('.pc-recovery').wait_for()
    ck(stored(page) is None, 'Missing payload remains a recovery case after a full reload')
    ctx.close()

    # Migration uses an independent profile and leaves older-version bytes available for recovery.
    with TemporaryDirectory(prefix='ledgerlab-migration-') as migration_profile:
        ctx = pw.chromium.launch_persistent_context(migration_profile, executable_path=executable, args=['--no-sandbox'])
        ctx.on('page', lambda p: p.on('pageerror', lambda e: errors.append(str(e))))
        legacy = {'state':backup,'revision':7,'updatedAt':'2026-09-18T08:00:00.000Z'}
        legacy_text = json.dumps(legacy)
        ctx.add_init_script(f'if(localStorage.getItem({json.dumps(KEY)})===null)localStorage.setItem({json.dumps(KEY)},{json.dumps(legacy_text)});')
        page = ctx.pages[0]; page.goto(url); ready(page)
        ck(page.evaluate('ledgerlabPreview.model().state.notes') == backup['notes'], 'Existing localStorage data migrates on first use')
        ck(stored(page)['revision'] == 7, 'Migration retains the existing revision')
        ck(save(page, 'New transactional continuation.')['ok'], 'Migrated workspace can be saved normally')
        ck(page.evaluate('(key)=>localStorage.getItem(key)', KEY) == legacy_text, 'Migration and later saves leave original legacy bytes untouched')
        page.reload(); ready(page)
        ck(page.evaluate('ledgerlabPreview.model().state.notes') == 'New transactional continuation.', 'Reload never overwrites newer database work with the legacy copy')
        ctx.close()
    ck(errors == [], 'No uncaught errors during persistence, rollback, recovery and migration')
finally:
    server.shutdown(); server.server_close()

(OUT/'results.json').write_text(json.dumps({'assertions':len(checks),'race_rounds':rounds,'checks':checks,'page_errors':errors},indent=2))
print(f'Transactional storage Chromium: {len(checks)} assertions; {rounds} competing-writer rounds passed.',flush=True)
