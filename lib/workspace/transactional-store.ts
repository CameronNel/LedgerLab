/** Offline persistence. The revision check and payload write share one IDB transaction.
 * localStorage is a one-time migration source, never a cross-tab transaction boundary.
 */
import { applyCommand } from '../accounting/engine';
import type { Command, WorkspaceEnvelope } from '../accounting/types';
import { LocalWorkspaceStore, LocalStoreError, LOCAL_STATE_BYTE_LIMIT, validLocalEnvelope } from './local-store';

export const LOCAL_DATABASE_NAME = 'ledgerlab-workspace-v1';
const TABLE = 'workspace';
const PAYLOAD = 'current';
const REVISION = 'revision';
type Operation = { type: 'read' }
  | { type: 'update'; revision: number; command: Command }
  | { type: 'recover'; value: WorkspaceEnvelope; confirmation: string };

function check(value: WorkspaceEnvelope): void {
  if (!validLocalEnvelope(value)) throw new LocalStoreError('The saved workspace failed validation. Download it for recovery; it has not been replaced.', 'corrupt');
  if (new TextEncoder().encode(JSON.stringify(value.state)).byteLength > LOCAL_STATE_BYTE_LIMIT)
    throw new LocalStoreError('Not saved: workspace exceeds the 1.5 MB limit. Export your confirmed work and reduce working-file size.', 'quota');
}
function increment(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(value + 1))
    throw new LocalStoreError('The saved revision is invalid. Recover a backup before continuing.', 'corrupt');
  return value + 1;
}

export class TransactionalWorkspaceStore {
  readonly mode: 'browser' | 'memory';
  private connection: Promise<IDBDatabase> | undefined;
  private confirmed: WorkspaceEnvelope | undefined;
  private recoveryRaw: string | null = null;
  constructor(private readonly legacy: LocalWorkspaceStore, private readonly factory: () => IDBFactory = () => indexedDB) {
    this.mode = legacy.mode;
  }
  snapshot(): WorkspaceEnvelope {
    if (!this.confirmed) throw new Error('Load the workspace before reading its confirmed snapshot.');
    return structuredClone(this.confirmed);
  }
  recoveryText(): string | null { return this.recoveryRaw ?? this.legacy.recoveryText(); }
  read(): Promise<WorkspaceEnvelope> { return this.run({ type: 'read' }); }
  update(revision: number, command: Command): Promise<WorkspaceEnvelope> {
    return this.run({ type: 'update', revision, command });
  }
  recover(value: WorkspaceEnvelope, confirmation: string): Promise<WorkspaceEnvelope> {
    return this.run({ type: 'recover', value, confirmation });
  }
  private open(): Promise<IDBDatabase> {
    if (this.connection) return this.connection;
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new LocalStoreError('Browser database is blocked or unavailable. Close other LedgerLab tabs and reload. Existing data has not been replaced; download recovery data before changing browser settings.', 'unavailable'));
      };
      const timer = setTimeout(fail, 8000);
      try {
        const request = this.factory().open(LOCAL_DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(TABLE)) request.result.createObjectStore(TABLE);
        };
        request.onerror = fail;
        request.onblocked = fail;
        request.onsuccess = () => {
          const db = request.result;
          if (settled) { db.close(); return; }
          settled = true;
          clearTimeout(timer);
          db.onversionchange = () => { db.close(); this.connection = undefined; };
          db.onclose = () => { this.connection = undefined; };
          resolve(db);
        };
      } catch { fail(); }
    });
    this.connection = pending;
    void pending.catch(() => { if (this.connection === pending) this.connection = undefined; });
    return pending;
  }
  private async run(operation: Operation): Promise<WorkspaceEnvelope> {
    if (operation.type === 'recover') {
      if (operation.confirmation !== 'REPLACE SAVED DATA') throw new Error('Type REPLACE SAVED DATA to confirm recovery.');
      check(operation.value);
    }
    if (this.mode === 'memory') {
      const saved = this.legacy.read();
      const next = this.apply(saved, operation);
      if (operation.type !== 'read') this.legacy.write(next);
      this.confirmed = structuredClone(next);
      return structuredClone(next);
    }
    const db = await this.open();
    return new Promise<WorkspaceEnvelope>((resolve, reject) => {
      let result: WorkspaceEnvelope | undefined;
      let reason: unknown;
      let tx: IDBTransaction;
      try { tx = db.transaction(TABLE, 'readwrite'); }
      catch { reject(new LocalStoreError('Not saved: the browser database closed. Reload and inspect your confirmed work before retrying.', 'unavailable')); return; }
      // A request's success is not a committed save. Only transaction completion acknowledges it.
      tx.oncomplete = () => {
        if (!result) { reject(new LocalStoreError('The database returned no workspace. Nothing was acknowledged as saved.', 'corrupt')); return; }
        this.confirmed = structuredClone(result);
        this.recoveryRaw = null;
        resolve(structuredClone(result));
      };
      tx.onabort = () => reject(reason ?? new LocalStoreError('Not saved: the browser transaction was aborted or storage is full. Your previous confirmed save is unchanged. Export your work before retrying.', 'quota'));
      const table = tx.objectStore(TABLE);
      const payloadRequest = table.get(PAYLOAD);
      const revisionRequest = table.get(REVISION);
      let remaining = 2;
      const process = () => {
        if (--remaining !== 0) return;
        try {
          const payload: unknown = payloadRequest.result;
          const revision: unknown = revisionRequest.result;
          if (operation.type === 'recover') {
            const known = [this.confirmed?.revision, revision,
              validLocalEnvelope(payload) ? payload.revision : undefined]
              .filter((v): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0);
            // Keep a separate revision record, so recovery after payload corruption cannot reuse an old revision.
            const next = { ...operation.value, revision: increment(Math.max(0, ...known)), updatedAt: new Date().toISOString() };
            check(next);
            table.put(next, PAYLOAD); table.put(next.revision, REVISION); result = next;
            return;
          }
          let saved: WorkspaceEnvelope;
          if (payload === undefined && revision === undefined && !this.confirmed) {
            // Both tabs may attempt migration, but IDB serializes this transaction with subsequent saves.
            saved = this.legacy.read(); check(saved);
            table.put(saved, PAYLOAD); table.put(saved.revision, REVISION);
          } else {
            this.recoveryRaw = JSON.stringify({ workspace: payload ?? null, revision: revision ?? null }, null, 2);
            if (payload === undefined) throw new LocalStoreError('Saved browser data was removed. No fresh case will replace it. Restore a backup explicitly.', 'conflict');
            if (!validLocalEnvelope(payload) || payload.revision !== revision)
              throw new LocalStoreError('Saved browser data failed validation. Download it for recovery or restore a valid backup. It has not been replaced.', 'corrupt');
            saved = payload; check(saved);
          }
          result = this.apply(saved, operation);
          if (operation.type === 'update') {
            table.put(result, PAYLOAD); table.put(result.revision, REVISION);
          }
        } catch (error) {
          reason = error instanceof DOMException
            ? new LocalStoreError('Not saved: browser storage is full, blocked or the transaction failed. Your previous confirmed save is unchanged.', 'quota')
            : error;
          tx.abort();
        }
      };
      payloadRequest.onsuccess = process;
      revisionRequest.onsuccess = process;
    });
  }
  private apply(saved: WorkspaceEnvelope, operation: Operation): WorkspaceEnvelope {
    if (operation.type === 'read') return saved;
    if (operation.type === 'recover') return { ...operation.value, revision: increment(saved.revision), updatedAt: new Date().toISOString() };
    if (operation.revision !== saved.revision)
      throw new LocalStoreError('Another tab changed this case. Reload and inspect the saved work before retrying.', 'conflict');
    const now = new Date().toISOString();
    const next = { state: applyCommand(saved.state, operation.command, now), revision: increment(saved.revision), updatedAt: now };
    check(next);
    return next;
  }
}
