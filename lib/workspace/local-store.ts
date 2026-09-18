/** Offline adapter only. A failed persistent write is never acknowledged as saved. */
import { validateBackup } from '../accounting/engine';
import type { WorkspaceEnvelope } from '../accounting/types';
export const LOCAL_WORKSPACE_KEY = 'ledgerlab-finance-pc-preview-v1';
export const LOCAL_STATE_BYTE_LIMIT = 1_500_000;
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export class LocalStoreError extends Error {
    constructor(message: string, readonly kind: 'corrupt' | 'unavailable' | 'quota' | 'conflict') { super(message); }
}
export function validLocalEnvelope(value: unknown): value is WorkspaceEnvelope {
    if (!value || typeof value !== 'object') return false;
    const data = value as WorkspaceEnvelope;
    try { return Number.isSafeInteger(data.revision) && data.revision >= 0
        && typeof data.updatedAt === 'string' && Number.isFinite(Date.parse(data.updatedAt))
        && !!data.state && !validateBackup(data.state); } catch { return false; }
}
export class LocalWorkspaceStore {
    readonly mode: 'browser' | 'memory';
    private port: StoragePort | undefined;
    private memory: WorkspaceEnvelope;
    private seenStored = false;
    private raw: string | null = null;
    constructor(getStorage: () => StoragePort, initial: WorkspaceEnvelope) {
        this.memory = structuredClone(initial);
        try { this.port = getStorage(); this.raw = this.port.getItem(LOCAL_WORKSPACE_KEY); this.mode = 'browser'; }
        catch { this.port = undefined; this.mode = 'memory'; }
    }
    read(): WorkspaceEnvelope {
        if (!this.port) return structuredClone(this.memory);
        try { this.raw = this.port.getItem(LOCAL_WORKSPACE_KEY); }
        catch { throw new LocalStoreError('Browser storage is no longer accessible. Your last confirmed work is kept. Export a backup before continuing.', 'unavailable'); }
        if (this.raw === null) {
            if (this.seenStored) throw new LocalStoreError('Saved browser data was removed in another tab. No fresh case will overwrite it. Restore a backup explicitly.', 'conflict');
            return structuredClone(this.memory);
        }
        this.seenStored = true;
        let data: unknown;
        try { data = JSON.parse(this.raw); }
        catch { throw new LocalStoreError('Saved browser data is not valid JSON. Download it for recovery or restore a valid backup. It has not been replaced.', 'corrupt'); }
        if (!validLocalEnvelope(data)) throw new LocalStoreError('Saved browser data failed validation. Download it for recovery or restore a valid backup. It has not been replaced.', 'corrupt');
        this.memory = data;
        return structuredClone(data);
    }
    write(value: WorkspaceEnvelope): void {
        if (!validLocalEnvelope(value)) throw new LocalStoreError('The workspace did not pass validation. Nothing was saved.', 'corrupt');
        if (new TextEncoder().encode(JSON.stringify(value.state)).byteLength > LOCAL_STATE_BYTE_LIMIT)
            throw new LocalStoreError('Workspace exceeds the 1.5 MB state limit. Export your work and reduce working-file size before saving.', 'quota');
        const raw = JSON.stringify(value);
        if (this.port) {
            try { this.port.setItem(LOCAL_WORKSPACE_KEY, raw); }
            catch { throw new LocalStoreError('Not saved: browser storage is full or blocked. Export your confirmed work, free space and retry. Your existing save and current draft are unchanged.', 'quota'); }
            this.seenStored = true;
        }
        this.raw = raw;
        this.memory = structuredClone(value);
    }
    /** Only explicit restore/new-case recovery may replace unparseable bytes. */
    recover(value: WorkspaceEnvelope, confirmation: string): void {
        if (confirmation !== 'REPLACE SAVED DATA') throw new Error('Type REPLACE SAVED DATA to confirm recovery.');
        this.write(value);
    }
    recoveryText(): string | null { return this.raw; }
}
