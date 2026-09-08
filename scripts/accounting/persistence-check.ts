import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { initialState, applyCommand, invoiceJournalLines } from '../../lib/accounting/engine';
import { WorkspaceSession, workspaceStatus, type WorkspaceFetch } from '../../lib/workspace/session';
import { createNotebookDraft, reconcileNotebookDraft, notebookConflict, resolveNotebookDraft } from '../../lib/workspace/notebook-draft';
import { createWorkspaceHandlers, MAX_ACTION_BYTES, MAX_STATE_BYTES, type WorkspaceDatabase } from '../../lib/workspace/service';
import { companyForState } from '../../lib/accounting/career';
import { blankForecast,careerTasks } from '../../lib/accounting/career-work';
import {dayTasks,dayTaskStatus} from '../../lib/accounting/workday';
import type {DailySubmission} from '../../lib/accounting/workday-types';
import type { Command, PracticeState, WorkspaceEnvelope } from '../../lib/accounting/types';

let checks = 0;
function check(value: unknown, message: string): asserts value { assert.ok(value, message); checks++; }
function equal(actual: unknown, expected: unknown, message: string) { assert.deepEqual(actual, expected, message); checks++; }
const NOW = '2026-09-07T10:00:00.000Z';
const saved = (state = initialState(), revision = 0): WorkspaceEnvelope => ({ state, revision, updatedAt: NOW });
const response = (data: unknown, status = 200) => Response.json(data, { status });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function queueFetch(...steps: (Response | Error | (() => Promise<Response>))[]) {
  const calls: { input: string; init?: RequestInit }[] = [];
  const fetch: WorkspaceFetch = async (input, init) => {
    calls.push({ input, init });
    const step = steps.shift();
    if (!step) throw new Error('Unexpected fetch');
    if (step instanceof Error) throw step;
    return typeof step === 'function' ? step() : step;
  };
  return { fetch, calls };
}

async function sessionChecks() {
  const delayed = deferred<Response>(), loadedState = { ...initialState(42), notes: 'Previously saved notebook' };
  const transport = queueFetch(() => delayed.promise);
  const session = new WorkspaceSession(transport.fetch);
  equal(session.getSnapshot(), session.getServerSnapshot(), 'Initial SSR snapshot is stable');
  const before = session.getSnapshot();
  equal(await session.save({ type: 'saveNotes', notes: 'Too early' }),
    { ok: false, error: 'Load your saved workspace before making changes.' }, 'Posting before load is blocked');
  equal(transport.calls.length, 0, 'Premature save makes no network request');
  let notifications = 0; const unsubscribe = session.subscribe(() => { notifications++; });
  const first = session.load(), second = session.load();
  equal(first, second, 'Concurrent loads share the same promise');
  equal(transport.calls.length, 1, 'Strict Mode duplicate load is deduplicated');
  check(session.getSnapshot().loading, 'Loading flag is set synchronously');
  check(!(await session.save({ type: 'saveNotes', notes: 'Still too early' })).ok, 'Save during load is blocked');
  delayed.resolve(response(saved(loadedState, 4)));
  check((await first).ok, 'Saved workspace loads successfully');
  equal(session.getSnapshot().state.notes, loadedState.notes, 'Late load shows saved notebook, not initial blank state');
  equal(session.getSnapshot().notebook.text, loadedState.notes, 'Draft is initialised from the loaded case');
  equal(session.getSnapshot().revision, 4, 'Loaded revision retained');
  equal(session.getServerSnapshot(), before, 'Server hydration snapshot remains stable');
  check(notifications >= 2, 'Subscribers observe loading and saved state');
  unsubscribe(); const n = notifications; session.editNotebook('Local draft');
  equal(notifications, n, 'Unsubscribed components receive no update');

  const wait = deferred<Response>(), posted = { ...initialState(), notes: 'Saved' };
  const writeTransport = queueFetch(response(saved()), () => wait.promise);
  const writes = new WorkspaceSession(writeTransport.fetch); await writes.load();
  writes.editNotebook('Saved');
  const pending = writes.save({ type: 'saveNotes', notes: 'Saved' });
  check(writes.getSnapshot().saving, 'Saving state is immediate');
  check(!(await writes.save({ type: 'saveNotes', notes: 'Duplicate' })).ok, 'Rapid duplicate click blocked');
  check(!(await writes.load()).ok, 'Reload cannot race an in-flight write');
  equal(writeTransport.calls.length, 2, 'Only one load and one write were sent');
  equal(JSON.parse(String(writeTransport.calls[1].init?.body)).revision, 0, 'Write uses last confirmed revision');
  wait.resolve(response(saved(posted, 1)));
  check((await pending).ok, 'Valid acknowledgement accepted');
  equal(writes.getSnapshot().state.notes, 'Saved', 'Acknowledged notebook stored');
  equal(writes.getSnapshot().notebook.text, 'Saved', 'Acknowledged draft matches saved text');
  equal(writes.getSnapshot().notebook.base, 'Saved', 'Successful save advances draft baseline');
  equal(workspaceStatus(writes.getSnapshot()), 'Saved workspace', 'Idle status does not imply unsaved forms were saved');

  for (const failure of [response({ error: 'Invalid accounting entry' }, 400), response({ error: 'Too large' }, 413), response({ error: 'Media type' }, 415)]) {
    const transport = queueFetch(response(saved()), failure, response(saved(posted, 1)));
    const s = new WorkspaceSession(transport.fetch); await s.load(); const original = s.getSnapshot().state;
    check(!(await s.save({ type: 'saveNotes', notes: 'Bad attempt' })).ok, 'Rejected save reports failure');
    equal(s.getSnapshot().state, original, 'Rejected save cannot replace confirmed state');
    equal(s.getSnapshot().revision, 0, 'Rejected save cannot advance revision');
    equal(workspaceStatus(s.getSnapshot()), 'Change not saved', 'Validation failure remains visibly unsaved');
    check(!s.getSnapshot().requiresReload, 'Definite rejection permits a corrected retry');
    check((await s.save({ type: 'saveNotes', notes: 'Saved' })).ok, 'Corrected action can be retried');
  }
  for (const failure of [new Error('Connection reset'), response({ error: 'Database response lost' }, 503), response({ error: 'Request timed out' }, 408),
    new Response('<html>Gateway failed</html>', { status: 502 }), response({ bogus: true }),
    response(saved(initialState(), 8)), response({ ...saved(), state: null })]) {
    const transport = queueFetch(response(saved()), failure, response(saved(posted, 1)));
    const s = new WorkspaceSession(transport.fetch); await s.load(); s.editNotebook('Preserve this draft');
    check(!(await s.save({ type: 'saveNotes', notes: 'Preserve this draft' })).ok, 'Uncertain acknowledgement fails closed');
    equal(s.getSnapshot().state.notes, '', 'Unconfirmed write cannot alter confirmed UI state');
    equal(s.getSnapshot().notebook.text, 'Preserve this draft', 'Unconfirmed write preserves notebook draft');
    equal(workspaceStatus(s.getSnapshot()), 'Save status unconfirmed', 'Unknown outcomes are not labelled failed or saved');
    check(s.getSnapshot().requiresReload, 'Unknown outcome requires inspection before retry');
    check(!(await s.save({ type: 'saveNotes', notes: 'Do not replay' })).ok, 'No blind replay of uncertain write');
    equal(transport.calls.length, 2, 'Blocked replay makes no POST');
    check((await s.load()).ok, 'Reload recovers confirmed saved state');
    check(!s.getSnapshot().requiresReload, 'Successful reload clears reload gate');
  }
  const conflictTransport = queueFetch(response(saved()), response({ error: 'Another tab changed this case', conflict: true }, 409),
    response(saved({ ...initialState(), notes: 'Other tab notes' }, 1)), response(saved({ ...initialState(), notes: 'My own notes' }, 2)));
  const conflict = new WorkspaceSession(conflictTransport.fetch); await conflict.load(); conflict.editNotebook('My own notes');
  check(!(await conflict.save({ type: 'saveNotes', notes: 'My own notes' })).ok, 'Revision conflict rejected');
  equal(workspaceStatus(conflict.getSnapshot()), 'Reload required', 'Conflict remains visible');
  await conflict.load(); equal(conflict.getSnapshot().notebook.text, 'My own notes', 'Reload preserves unsaved notebook');
  check(notebookConflict(conflict.getSnapshot().notebook), 'Independent changes produce an explicit notebook conflict');
  check(!(await conflict.save({ type: 'saveNotes', notes: 'My own notes' })).ok, 'Unresolved notebook conflict cannot overwrite saved notes');
  equal(conflictTransport.calls.length, 3, 'Unresolved notebook does not POST');
  conflict.resolveNotebook(true); check(!notebookConflict(conflict.getSnapshot().notebook), 'Keep my draft explicitly rebases it');
  check((await conflict.save({ type: 'saveNotes', notes: 'My own notes' })).ok, 'Resolved notebook draft saves');

  for (const badLoad of [new Error('Offline'), response({ error: 'Not signed in' }, 401), response(null),
    response({ ...saved(), revision: -1 }), response({ ...saved(), revision: 0.5 }), response({ ...saved(), updatedAt: 'not a date' })]) {
    const s = new WorkspaceSession(queueFetch(badLoad).fetch);
    check(!(await s.load()).ok, 'Malformed/failed initial load rejected');
    check(!s.getSnapshot().loaded, 'Failed load never unlocks the blank initial workspace');
    equal(workspaceStatus(s.getSnapshot()), 'Workspace unavailable', 'Load failure is not a saved success');
    check(!(await s.save({ type: 'saveNotes', notes: 'Blank replacement' })).ok, 'Cannot save over unloaded workspace');
  }
  const stale = new WorkspaceSession(queueFetch(response(saved(posted, 3)), response(saved(initialState(), 2))).fetch);
  await stale.load(); check(!(await stale.load()).ok, 'Older reload revision rejected');
  equal(stale.getSnapshot().state.notes, 'Saved', 'Older GET cannot undo latest confirmed state');
  check(stale.getSnapshot().requiresReload, 'Stale GET blocks writes until resolved');

  const reset = new WorkspaceSession(queueFetch(response(saved()), response(saved(initialState(), 1))).fetch);
  await reset.load(); reset.editNotebook('Draft that will be replaced after confirmation');
  await reset.save({ type: 'newCase', seed: 271828 });
  equal(reset.getSnapshot().generation, 1, 'Same-seed new case resets view/form generation');
  equal(reset.getSnapshot().notebook.text, '', 'Confirmed same-seed new case resets draft');
  const restore = new WorkspaceSession(queueFetch(response(saved()), response(saved(posted, 1))).fetch);
  await restore.load(); await restore.save({ type: 'importBackup', state: posted });
  equal(restore.getSnapshot().generation, 1, 'Same-seed backup restore resets view/form generation');
  equal(restore.getSnapshot().notebook.text, 'Saved', 'Backup restore updates notebook');
  const otherCase = new WorkspaceSession(queueFetch(response(saved()), response(saved(initialState(7), 1))).fetch);
  await otherCase.load(); otherCase.editNotebook('Old case'); await otherCase.load();
  equal(otherCase.getSnapshot().generation, 1, 'Different case loaded from another tab resets views');
  equal(otherCase.getSnapshot().notebook.seed, 7, 'Old notebook is not reused for a different seed');
  const typed = deferred<Response>();
  const editing = new WorkspaceSession(queueFetch(response(saved()), () => typed.promise).fetch);
  await editing.load(); editing.editNotebook('Submitted'); const submit = editing.save({ type: 'saveNotes', notes: 'Submitted' });
  editing.editNotebook('Typed after submission'); typed.resolve(response(saved({ ...initialState(), notes: 'Submitted' }, 1))); await submit;
  equal(editing.getSnapshot().notebook.text, 'Typed after submission', 'Newer typing is not lost on acknowledgement');
  check(!notebookConflict(editing.getSnapshot().notebook), 'Own post-submission typing is not a remote conflict');
  equal(editing.getSnapshot().notebook.base, 'Submitted', 'Post-submission draft rebased to confirmed save');
}

function notebookChecks() {
  const clean = createNotebookDraft(42, 'Original');
  equal(reconcileNotebookDraft(clean, 42, 'New saved text'), createNotebookDraft(42, 'New saved text'), 'Clean editor tracks remote text');
  const dirty = { ...clean, text: 'Local edits' };
  equal(reconcileNotebookDraft(dirty, 42, 'Original'), dirty, 'Unrelated saved actions cannot erase local edits');
  const conflicted = reconcileNotebookDraft(dirty, 42, 'Remote edits');
  check(notebookConflict(conflicted), 'Divergent edits detected');
  equal(resolveNotebookDraft(conflicted, false).text, 'Remote edits', 'Use saved notebook selects remote text');
  equal(resolveNotebookDraft(conflicted, true).text, 'Local edits', 'Keep draft retains local text');
  check(!notebookConflict(resolveNotebookDraft(conflicted, true)), 'Explicit keep resolves conflict');
  equal(reconcileNotebookDraft(dirty, 42, 'Local edits'), createNotebookDraft(42, 'Local edits'), 'Matching acknowledgement cleans draft');
  equal(reconcileNotebookDraft(dirty, 7, 'Another case'), createNotebookDraft(7, 'Another case'), 'New case creates separate draft');
  check(!notebookConflict({ ...conflicted, text: conflicted.remote }), 'Typing the remote version resolves difference');
}

function makeSqlite() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('drizzle/0000_careless_shadow_king.sql', 'utf8'));
  const sql: string[] = [];
  const database: WorkspaceDatabase = { prepare(text: string) {
    sql.push(text); let values: SQLInputValue[] = [];
    const statement = {
      bind(...input: unknown[]) { values = input as SQLInputValue[]; return statement; },
      async first<T>(): Promise<T | null> { return (sqlite.prepare(text).get(...values) as T | undefined) ?? null; },
      async run() { const result = sqlite.prepare(text).run(...values); return { meta: { changes: Number(result.changes) } }; },
    };
    return statement;
  } };
  return { database, sqlite, sql };
}
const request = (payload: unknown, extra: Record<string, string> = {}) => new Request('http://localhost/api/workspace', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...extra }, body: JSON.stringify(payload),
});

async function apiChecks() {
  const { database, sqlite, sql } = makeSqlite(); let owner: string | null = null;
  const handlers = createWorkspaceHandlers({ owner: async () => owner, database: () => database, now: () => NOW });
  equal((await handlers.GET()).status, 401, 'GET requires identity');
  equal((await handlers.POST(request({ revision: 0, command: { type: 'saveNotes', notes: 'x' } }))).status, 401, 'POST requires identity');
  equal(sql.length, 0, 'Unauthenticated requests never touch storage');
  owner = 'alice'; const initial = await handlers.GET(); equal(initial.status, 200, 'New owner gets workspace');
  equal(initial.headers.get('cache-control'), 'private, no-store', 'Saved state is not publicly cacheable');
  equal(initial.headers.get('x-content-type-options'), 'nosniff', 'Responses preserve content-type protection');
  equal((await initial.json()).revision, 0, 'Fresh workspace starts at revision zero');
  equal((await handlers.GET()).status, 200, 'Repeated GET retains same workspace');
  equal(sqlite.prepare('SELECT COUNT(*) AS n FROM accounting_workspaces').get()?.n, 1, 'GET is idempotent for existing owner');
  const action = { revision: 0, command: { type: 'saveNotes', notes: 'Alice notebook' } };
  equal((await handlers.POST(request(action, { Origin: 'https://another.example' }))).status, 403, 'Cross-origin POST rejected');
  equal((await handlers.POST(request(action, { 'Sec-Fetch-Site': 'cross-site' }))).status, 403, 'Cross-site browser request rejected');
  equal((await handlers.POST(request(action, { 'Content-Type': 'text/plain' }))).status, 415, 'Non-JSON request rejected');
  equal((await handlers.POST(request(action, { 'Content-Type': 'application/json-malicious' }))).status, 415, 'JSON substring is not a valid media type');
  for (const body of [null, [], 1, 'x', {}, { revision: -1, command: { type: 'saveNotes', notes: 'x' } },
    { revision: 0.1, command: { type: 'saveNotes', notes: 'x' } }, { revision: '0', command: { type: 'saveNotes', notes: 'x' } },
    { revision: Number.MAX_SAFE_INTEGER + 1, command: { type: 'saveNotes', notes: 'x' } },
    { revision: 0, command: null }, { revision: 0, command: [] }, { revision: 0, command: {} },
    { revision: 0, command: { type: '' } }, { revision: 0, command: { type: 'unknown' } }]) {
    equal((await handlers.POST(request(body))).status, 400, 'Malformed action returns 400, not service unavailable');
  }
  equal((await handlers.POST(new Request('http://localhost/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }))).status, 400, 'Invalid JSON rejected');
  equal((await handlers.POST(new Request('http://localhost/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' } }))).status, 400, 'Absent request body rejected');
  equal((await handlers.POST(new Request('http://localhost/api/workspace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: new Uint8Array([0xff]) }))).status, 400, 'Invalid UTF-8 rejected');
  equal((await handlers.POST(request(action, { 'Content-Length': String(MAX_ACTION_BYTES + 1) }))).status, 413, 'Oversized declared body rejected');
  // Unicode payload has fewer UTF-16 characters than the old cap, but exceeds the byte cap.
  equal((await handlers.POST(request({ revision: 0, command: { type: 'saveNotes', notes: '€'.repeat(1_000_000) } }))).status, 413, 'Body limit counts UTF-8 bytes, not JS characters');
  equal((await handlers.POST(request({ revision: 0, command: { type: 'saveNotes', notes: 'x'.repeat(MAX_ACTION_BYTES) } }))).status, 413, 'Actual body limit enforced without Content-Length');
  equal((await handlers.GET()).status, 200, 'Invalid requests do not break workspace');
  equal((await (await handlers.GET()).json()).revision, 0, 'Invalid actions are non-mutating');
  for (const malformedCommand of [
    { type: 'lockPeriod', locked: null, reason: 'Must not corrupt period status' },
    { type: 'unmatchBank' }, { type: 'deleteJournalTemplate' },
    { type: 'saveNotes', notes: 7 }, { type: 'setMode', mode: 'not-a-mode' },
  ]) {
    equal((await handlers.POST(request({ revision: 0, command: malformedCommand }))).status, 400,
      'Malformed nested command cannot commit a state rejected by backup validation');
    equal((await (await handlers.GET()).json()).revision, 0, 'Malformed nested command is non-mutating');
  }
  const valid = await handlers.POST(request(action, { 'Content-Type': 'Application/JSON; charset=utf-8' }));
  equal(valid.status, 200, 'Case-insensitive JSON media type with charset accepted');
  const first = await valid.json(); equal(first.revision, 1, 'Successful command advances revision once');
  equal(first.state.notes, 'Alice notebook', 'Notebook saved in SQLite through production handler');
  equal(first.state.auditLog[0].at, NOW, 'Saved action uses transaction timestamp');
  equal((await handlers.POST(request(action))).status, 409, 'Stale revision rejected');
  equal((await (await handlers.GET()).json()).state.notes, 'Alice notebook', 'Stale POST does not overwrite notebook');
  owner = 'bob'; const bob = await (await handlers.GET()).json(); equal(bob.state.notes, '', 'Different owner cannot see first owner notebook');
  equal(bob.revision, 0, 'Each owner has an independent revision');
  equal((await handlers.POST(request({ revision: 0, command: { type: 'saveNotes', notes: 'Bob notebook' } }))).status, 200, 'Second owner can save own workspace');
  owner = 'alice'; equal((await (await handlers.GET()).json()).state.notes, 'Alice notebook', 'Second owner write does not change first owner state');
  check(sql.filter(s => s.startsWith('SELECT')).every(s => s.includes('WHERE owner_id = ?')), 'Every production SELECT filters by bound owner');
  check(sql.filter(s => s.startsWith('UPDATE')).every(s => s.includes('WHERE owner_id = ? AND revision = ?')), 'Every production UPDATE is owner-filtered compare-and-swap');
  check(!sql.some(s => s.includes('Alice notebook') || s.includes("'alice'")), 'User data are bound, not interpolated into SQL');
  // Both requests read revision 1 before either UPDATE, then SQLite compare-and-swap chooses one.
  const races = await Promise.all(['First contender', 'Second contender'].map(notes => handlers.POST(request({ revision: 1, command: { type: 'saveNotes', notes } }))));
  equal(races.map(r => r.status).sort(), [200, 409], 'Concurrent writers: exactly one succeeds');
  equal((await (await handlers.GET()).json()).revision, 2, 'Concurrent race increments revision only once');
  const immutableBefore = (await (await handlers.GET()).json()).state;
  const journal = { id: 'PERSIST-1', date: '2025-12-31', description: 'API regression', reference: 'TEST', module: 'Manual journal',
    lines: [{ account: '6220', debit: 10000, credit: 0 }, { account: '2100', debit: 0, credit: 10000 }] };
  const broken = { ...journal, id: 'PERSIST-BAD', lines: [{ account: '6220', debit: 10000, credit: 0 }, { account: '2100', debit: 0, credit: 9999 }] };
  equal((await handlers.POST(request({ revision: 2, command: { type: 'importJournals', journals: [journal, broken] } }))).status, 400, 'One invalid journal rejects entire API batch');
  equal((await (await handlers.GET()).json()).state, immutableBefore, 'Failed batch leaves complete saved state unchanged');
  equal((await handlers.POST(request({ revision: 2, command: { type: 'postJournal', journal } }))).status, 200, 'Valid journal posts through SQL handler');
  const posted = await (await handlers.GET()).json(); equal(posted.state.journals.length, 1, 'Posted journal persists');
  equal((await handlers.POST(request({ revision: 3, command: { type: 'postJournal', journal } }))).status, 400, 'Duplicate journal cannot be posted again');
  equal((await (await handlers.GET()).json()).revision, 3, 'Duplicate journal does not advance revision');
  const legacy = initialState(); delete legacy.allocations; delete legacy.disclosures; delete legacy.evidenceRequests;
  delete legacy.journalTemplates; delete legacy.balanceReconciliations;
  equal((await handlers.POST(request({ revision: 3, command: { type: 'importBackup', state: legacy } }))).status, 200, 'Legacy backups restore through production handler');
  const enormous = initialState(); enormous.auditLog = Array.from({ length: 170 }, (_, i) => ({ id: `L-${i}`, at: NOW, action: 'Test', detail: 'x'.repeat(9500) }));
  check(JSON.stringify(enormous).length > MAX_STATE_BYTES && JSON.stringify(enormous).length < MAX_ACTION_BYTES, 'Oversized-state fixture tests state cap independently of request cap');
  equal((await handlers.POST(request({ revision: 4, command: { type: 'importBackup', state: enormous } }))).status, 413, 'Oversized saved state rejected');
  equal((await (await handlers.GET()).json()).revision, 4, 'State-size rejection leaves revision unchanged');
  const brokenDb = createWorkspaceHandlers({ owner: async () => 'alice', database: () => { throw new Error('Storage offline'); } });
  equal((await brokenDb.GET()).status, 503, 'Unavailable database returns controlled GET failure');
  equal((await brokenDb.POST(request(action))).status, 503, 'Unavailable database returns controlled POST failure');
  sqlite.close();
}

async function integratedRecoveryChecks() {
  const { database, sqlite } = makeSqlite();
  const api = createWorkspaceHandlers({ owner: async () => 'integration-owner', database: () => database, now: () => NOW });
  let dropAcknowledgement = true, posts = 0;
  const session = new WorkspaceSession(async (_url, init) => {
    if (init?.method !== 'POST') return api.GET();
    posts++;
    const result = await api.POST(new Request('http://localhost/api/workspace', init));
    if (dropAcknowledgement) { dropAcknowledgement = false; throw new Error('Connection dropped after SQLite commit'); }
    return result;
  });
  await session.load(); session.editNotebook('Actually saved despite lost response');
  check(!(await session.save({ type: 'saveNotes', notes: session.getSnapshot().notebook.text })).ok, 'Lost acknowledgement reports unconfirmed outcome');
  equal((await (await api.GET()).json()).state.notes, 'Actually saved despite lost response', 'Write really committed before simulated network failure');
  check(!(await session.save({ type: 'saveNotes', notes: 'Do not duplicate' })).ok, 'Session blocks blind retry after actual commit');
  equal(posts, 1, 'Lost acknowledgement cannot cause second POST');
  await session.load(); equal(session.getSnapshot().revision, 1, 'Reload discovers committed revision');
  equal(session.getSnapshot().notebook.text, 'Actually saved despite lost response', 'Reload recovers acknowledged notebook');
  check(!notebookConflict(session.getSnapshot().notebook), 'Recovered own write is not a conflict');
  const a = new WorkspaceSession(async (_url, init) => init?.method === 'POST' ? api.POST(new Request('http://localhost/api/workspace', init)) : api.GET());
  const b = new WorkspaceSession(async (_url, init) => init?.method === 'POST' ? api.POST(new Request('http://localhost/api/workspace', init)) : api.GET());
  await Promise.all([a.load(), b.load()]); a.editNotebook('Tab A'); b.editNotebook('Tab B');
  check((await a.save({ type: 'saveNotes', notes: 'Tab A' })).ok, 'First real session saves');
  check(!(await b.save({ type: 'saveNotes', notes: 'Tab B' })).ok, 'Second real session receives revision conflict');
  await b.load(); equal(b.getSnapshot().notebook.text, 'Tab B', 'Conflicting real session retains own draft');
  check(notebookConflict(b.getSnapshot().notebook), 'Two-tab conflict requires explicit notebook choice');
  b.resolveNotebook(false); equal(b.getSnapshot().notebook.text, 'Tab A', 'Choosing saved version resolves two-tab conflict');
  sqlite.close();
}

async function takeoverPersistenceChecks() {
  const {database,sqlite}=makeSqlite();
  const api=createWorkspaceHandlers({owner:async()=> 'takeover-owner',database:()=>database,now:()=>NOW});
  const session=new WorkspaceSession(async (_url,init)=>init?.method==='POST'?api.POST(new Request('http://localhost/api/workspace',init)):api.GET());
  check((await session.load()).ok,'Takeover session loads production workspace');
  session.editNotebook('Old unsaved draft already exported by the replacement UI.');
  const start:Command={type:'startCareer',seed:271828,startMonth:'2025-07',role:'financial-manager',scenario:'messy',confirmation:'START TAKEOVER'};
  check((await session.save(start)).ok,'Takeover creation persists through the real production handlers');
  equal(session.getSnapshot().notebook.text,'','Explicit takeover replacement does not carry the old notebook into the new role');
  equal(session.getSnapshot().state.career?.activeMonth,'2025-07','Active period survives acknowledgement');
  equal((await (await api.GET()).json()).state.career.startMonth,'2025-07','Takeover configuration stored in SQLite');
  let state=session.getSnapshot().state,c=companyForState(state);
  const source=c.documents.find(d=>d.kind==='Supplier invoice'&&d.date.startsWith('2025-07'))!;
  const journal={id:'API-TAKEOVER-CAPTURE',date:source.date,description:'Invoice captured through the production API',reference:source.id,sourceId:source.id,module:'Purchases',lines:invoiceJournalLines({...source,journalIds:['API-TAKEOVER-CAPTURE']},c)};
  check((await session.save({type:'captureSourceInvoice',documentId:source.id,journal})).ok,'New capture command saves through API boundary');
  equal((await (await api.GET()).json()).state.journals.length,1,'Captured journal is durable');
  const revision=session.getSnapshot().revision;
  check(!(await session.save({type:'captureSourceInvoice',documentId:source.id,journal:{...journal,id:'DUPLICATE'}})).ok,'API refuses repeated source capture');
  equal(session.getSnapshot().revision,revision,'Rejected source duplicate does not advance saved revision');
  check(!(await session.save({type:'advanceCareerMonth'})).ok,'API does not release an unclosed month');
  check(!(await session.save({type:'postJournal',journal:{...journal,id:'FUTURE',date:'2025-08-01'}})).ok,'API blocks future-period postings');
  check(!(await session.save({type:'postJournal',journal:{...journal,id:'UNKNOWN-SOURCE',sourceId:'NOT-RELEASED'}})).ok,'API blocks fabricated or unavailable sources');
  state=session.getSnapshot().state;c=companyForState(state);
  const task=careerTasks(c,state)[0];
  const submission={month:'2025-07',taskId:task.id,status:'draft' as const,figures:{},responses:{},evidence:[],updatedAt:''};
  check((await session.save({type:'saveCareerSubmission',submission})).ok,'Role work drafts persist before completion');
  check((await session.save({type:'saveCareerForecast',forecast:blankForecast('2025-07')})).ok,'Blank cash forecast may be retained as a draft');
  const before=await (await api.GET()).json();
  const malformed=[{type:'saveCareerForecast',forecast:null},{type:'saveCareerSubmission',submission:null},{type:'closeCareerMonth',reason:null},{type:'captureSourceInvoice',documentId:source.id,journal:null}];
  for(const command of malformed){equal((await api.POST(request({revision:before.revision,command}))).status,400,'Malformed takeover command is rejected by the production boundary');equal((await (await api.GET()).json()).revision,before.revision,'Malformed command cannot mutate the takeover');}
  const restore=structuredClone(before.state);restore.career.activeMonth='2025-08';
  check(!(await session.save({type:'importBackup',state:restore})).ok,'A backup cannot skip an unclosed takeover month');
  check((await session.load()).ok,'A takeover reload returns saved drafts and source entries');
  equal(session.getSnapshot().state.career?.forecasts['2025-07'].status,'draft','Forecast draft round-trips');
  equal(session.getSnapshot().state.career?.submissions['2025-07|'+task.id].status,'draft','Role draft round-trips');
  equal(session.getSnapshot().state.journals.length,1,'Rejected commands cannot erase or duplicate a capture');
  const journalSnapshot=structuredClone(session.getSnapshot().state.journals);
  check((await session.save({type:'submitMonthReview'})).ok,'Month review computed and persisted through production API');
  const receipt=structuredClone(session.getSnapshot().state.monthReviews?.at(-1));
  check(!!receipt&&receipt.blockers>0,'API accepts incomplete attempt for diagnostic feedback, not a close');
  equal(session.getSnapshot().state.journals,journalSnapshot,'API review cannot post a worked answer');
  check((await session.load()).ok,'Reviewed case reloads through API');
  equal(session.getSnapshot().state.monthReviews?.at(-1),receipt,'Review summary receipt round-trips through SQLite');
  check((await session.save({type:'submitMonthReview'})).ok,'Unchanged submit is idempotent at domain boundary');
  equal(session.getSnapshot().state.monthReviews?.length,1,'Unchanged API resubmission does not create another attempt');
  const receiptBackup=structuredClone(session.getSnapshot().state);receiptBackup.monthReviews![0].total++;
  check(!(await session.save({type:'importBackup',state:receiptBackup})).ok,'API rejects malformed review receipts on restore');
  equal(session.getSnapshot().state.monthReviews?.length,1,'Rejected receipt restore cannot overwrite history');

  sqlite.close();
}

async function dailyPersistenceChecks() {
  const {database,sqlite}=makeSqlite();let tick=0;
  const api=createWorkspaceHandlers({owner:async()=> 'daily-owner',database:()=>database,now:()=>new Date(Date.parse(NOW)+(tick++)*1000).toISOString()});
  const transport:WorkspaceFetch=async (_url,init)=>init?.method==='POST'?api.POST(new Request('http://localhost/api/workspace',init)):api.GET();
  const session=new WorkspaceSession(transport);check((await session.load()).ok,'Daily session reads production workspace');
  check((await session.save({type:'startCareer',seed:271828,startMonth:'2025-07',role:'financial-manager',scenario:'messy',daily:true,confirmation:'START TAKEOVER'})).ok,'Daily takeover persists through production API');
  equal(session.getSnapshot().state.workday?.today,'2025-07-01','New persisted job starts at first day');
  const state=session.getSnapshot().state,task=dayTasks(state).find(t=>t.id.endsWith('-welcome'))!;
  const answer:DailySubmission={taskId:task.id,status:'submitted',figures:Object.fromEntries(task.figures.map(f=>[f.id,f.expected])),decision:'',note:'Read the inherited handover, establish the bank reconciliation, request missing signed evidence and prioritise independent checks before changing the predecessor ledger.',evidence:task.evidence,blocker:'',owner:'',followUp:'',updatedAt:''};
  check((await session.save({type:'saveDailySubmission',submission:{...answer,figures:{bank:1}}})).ok,'Wrong daily figure persists as a reviewable response');
  check((await session.load()).ok,'Incorrect saved daily response reloads');
  equal(dayTaskStatus(task,session.getSnapshot().state).state,'Needs correction','Wrong response is not certified by persistence');
  check((await session.save({type:'saveDailySubmission',submission:answer})).ok,'Corrected daily response persists');
  equal(dayTaskStatus(task,session.getSnapshot().state).state,'Complete','Correct defined checks pass after acknowledgment');
  check((await session.save({type:'advanceWorkday',date:'2025-07-04',note:'Recorded open first-week work and moved to incoming supplier documents.',acknowledgeOutstanding:true})).ok,'Explicit simulated date persists through production handler');
  const before=await (await api.GET()).json();
  equal(before.state.workday.today,'2025-07-04','SQLite stores current simulated date');
  equal(before.state.workday.history.length,1,'SQLite stores end-day history');
  equal(before.state.workday.submissions[task.id].figures,answer.figures,'SQLite stores submitted figures');
  const journal=companyForState(session.getSnapshot().state,false).solutionJournals.find(j=>j.date==='2025-07-25'&&j.sourceId==='PAY-2025-07')!;
  const rejected:unknown[]=[{type:'postJournal',journal:{...journal,id:'FUTURE-API'}},{type:'submitMonthReview'},{type:'saveDailySubmission',submission:null},{type:'advanceWorkday',date:'2025-02-30',note:'Bad date',acknowledgeOutstanding:true},{type:'advanceWorkday',date:'2025-07-02',note:'Backward clock',acknowledgeOutstanding:true},{type:'advanceWorkday',date:'2025-07-07',note:44,acknowledgeOutstanding:true}];
  for(const command of rejected){equal((await api.POST(request({revision:before.revision,command}))).status,400,'Daily API rejects unavailable or malformed action');equal((await (await api.GET()).json()).revision,before.revision,'Rejected daily API action leaves revision unchanged');}
  const competing=new WorkspaceSession(transport);check((await competing.load()).ok,'Second daily workspace reads same revision');
  check((await session.save({type:'advanceWorkday',date:'2025-07-07',note:'New cash reporting request available.',acknowledgeOutstanding:true})).ok,'First tab advances daily clock');
  check(!(await competing.save({type:'advanceWorkday',date:'2025-07-08',note:'Stale competing date',acknowledgeOutstanding:true})).ok,'Stale competing clock change rejected');
  equal((await (await api.GET()).json()).state.workday.today,'2025-07-07','Stale tab does not overwrite saved daily clock');
  check((await competing.load()).ok,'Competing daily tab recovers by reloading');equal(competing.getSnapshot().state.workday?.history.length,2,'Recovered tab receives complete date log');
  const backup=structuredClone(competing.getSnapshot().state);check((await competing.save({type:'importBackup',state:backup})).ok,'Complete daily backup restores through production persistence');
  equal(competing.getSnapshot().state.workday,backup.workday,'Daily restore preserves responses, completion dates and date history');
  const broken=structuredClone(backup);broken.workday!.history[0].to='2025-07-01';check(!(await competing.save({type:'importBackup',state:broken})).ok,'API refuses corrupt backward day log');
  sqlite.close();
}

async function main() {
  notebookChecks(); await sessionChecks(); await apiChecks(); await integratedRecoveryChecks(); await takeoverPersistenceChecks(); await dailyPersistenceChecks();
  console.log(`PASS: ${checks} persistence, notebook, request-validation and SQLite concurrency checks.`);
  console.log('Uses the production handlers/session logic with a real in-memory SQLite adapter. This is not a browser, D1-hosting or identity-provider end-to-end test.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
