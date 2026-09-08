import { initialState, validateBackup } from '../accounting/engine';
import type { Command, PracticeState, WorkspaceEnvelope } from '../accounting/types';
import { createNotebookDraft, reconcileNotebookDraft, resolveNotebookDraft, notebookConflict, type NotebookDraft } from './notebook-draft';

export type WorkspaceSnapshot = {
  state: PracticeState;
  revision: number;
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
  requiresReload: boolean;
  problem: 'load' | 'save' | 'conflict' | 'uncertain' | null;
  generation: number;
  notebook: NotebookDraft;
};
export type WorkspaceResult = { ok: true } | { ok: false; error: string; busy?: boolean };
export type WorkspaceFetch = (input: string, init?: RequestInit) => Promise<Response>;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function envelope(value: unknown): WorkspaceEnvelope {
  if (!record(value) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0 ||
      typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) ||
      !record(value.state) || validateBackup(value.state as PracticeState)) {
    throw new Error('The server did not return a valid saved workspace.');
  }
  return value as WorkspaceEnvelope;
}

function failureMessage(value: unknown, fallback: string): string {
  return record(value) && typeof value.error === 'string' && value.error.trim()
    ? value.error.slice(0, 1000) : fallback;
}

/** Single-flight save/load coordination, shared by the UI and executable regressions.
 * An uncertain write is never automatically retried: it may already have committed.
 * Reload first, then let the user inspect the saved ledger before another action.
 */
export class WorkspaceSession {
  private snapshot: WorkspaceSnapshot = {
    state: initialState(), revision: 0, loaded: false, loading: false, saving: false,
    error: '', requiresReload: false, problem: null, generation: 0,
    notebook: createNotebookDraft(271828, ''),
  };
  private readonly serverSnapshot = this.snapshot;
  private readonly listeners = new Set<() => void>();
  private pendingLoad: Promise<WorkspaceResult> | null = null;
  private pendingSave = false;

  constructor(private readonly fetcher: WorkspaceFetch) {}

  getSnapshot = (): WorkspaceSnapshot => this.snapshot;
  getServerSnapshot = (): WorkspaceSnapshot => this.serverSnapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(patch: Partial<WorkspaceSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  editNotebook = (text: string): void => {
    this.update({ notebook: { ...this.snapshot.notebook, text } });
  };
  resolveNotebook = (keepDraft: boolean): void => {
    this.update({ notebook: resolveNotebookDraft(this.snapshot.notebook, keepDraft) });
  };

  load = (): Promise<WorkspaceResult> => {
    if (this.pendingSave) return Promise.resolve({ ok: false, busy: true,
      error: 'Wait for the current save to finish before reloading.' });
    // React Strict Mode and double-clicked reloads share one request.
    if (this.pendingLoad) return this.pendingLoad;
    this.update({ loading: true });
    const task = this.performLoad();
    this.pendingLoad = task;
    void task.finally(() => { if (this.pendingLoad === task) this.pendingLoad = null; });
    return task;
  };

  private async performLoad(): Promise<WorkspaceResult> {
    try {
      const response = await this.fetcher('/api/workspace', { cache: 'no-store' });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(failureMessage(data, 'Your workspace could not be loaded.'));
      const saved = envelope(data);
      if (this.snapshot.loaded && saved.revision < this.snapshot.revision) {
        throw new Error('An older workspace was returned. Reload again before continuing.');
      }
      const replaced = this.snapshot.loaded && saved.state.seed !== this.snapshot.state.seed;
      this.update({ state: saved.state, revision: saved.revision, loaded: true, loading: false,
        error: '', requiresReload: false, problem: null,
        generation: this.snapshot.generation + Number(replaced),
        notebook: reconcileNotebookDraft(this.snapshot.notebook, saved.state.seed, saved.state.notes) });
      return { ok: true };
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Your workspace could not be loaded.';
      const error = `${detail} ${this.snapshot.loaded ? 'Your last confirmed saved state has not been replaced.' : 'Your saved work has not been replaced with a blank case.'}`;
      this.update({ loading: false, error, requiresReload: true, problem: 'load' });
      return { ok: false, error };
    }
  }

  save = async (command: Command): Promise<WorkspaceResult> => {
    if (this.pendingSave || this.pendingLoad || this.snapshot.loading) {
      return { ok: false, busy: true, error: 'A workspace request is still in progress.' };
    }
    if (!this.snapshot.loaded) return { ok: false, error: 'Load your saved workspace before making changes.' };
    if (this.snapshot.requiresReload) return { ok: false,
      error: 'Reload and inspect your saved work before making another change.' };
    if (command.type === 'saveNotes' && notebookConflict(this.snapshot.notebook)) {
      return { ok: false, error: 'Choose whether to use the saved notebook or keep your draft before saving.' };
    }
    const submittedNotebook = this.snapshot.notebook;
    this.pendingSave = true;
    this.update({ saving: true, error: '', problem: null });
    try {
      const response = await this.fetcher('/api/workspace', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: this.snapshot.revision, command }),
      });
      // An HTML gateway error or lost acknowledgement does not prove a failed write.
      const data: unknown = await response.json();
      if (!response.ok) {
        const conflict = response.status === 409;
        const uncertain = ![400, 401, 403, 409, 413, 415].includes(response.status);
        const detail = failureMessage(data, 'Your change could not be saved.');
        const error = uncertain
          ? `${detail} The save outcome is unconfirmed. Reload and inspect the saved work before retrying.`
          : detail;
        this.update({ error, requiresReload: conflict || uncertain || response.status === 401,
          problem: conflict ? 'conflict' : uncertain ? 'uncertain' : 'save' });
        return { ok: false, error };
      }
      const saved = envelope(data);
      if (saved.revision !== this.snapshot.revision + 1) {
        throw new Error('The save acknowledgement has an unexpected revision.');
      }
      const replaced = command.type === 'newCase' || command.type === 'importBackup' || command.type === 'startCareer';
      let notebook = replaced ? createNotebookDraft(saved.state.seed, saved.state.notes)
        : reconcileNotebookDraft(this.snapshot.notebook, saved.state.seed, saved.state.notes);
      // Typing after submitting a notebook is a newer local edit, not another-tab conflict.
      if (!replaced && command.type === 'saveNotes' && this.snapshot.notebook.text !== submittedNotebook.text) {
        notebook = { ...this.snapshot.notebook, base: saved.state.notes, remote: saved.state.notes };
      }
      this.update({ state: saved.state, revision: saved.revision,
        error: '', requiresReload: false, problem: null,
        generation: this.snapshot.generation + Number(replaced), notebook });
      return { ok: true };
    } catch {
      const error = 'The save outcome is unconfirmed. Your last confirmed saved state has been kept. Reload and inspect the saved work before retrying; the change may already be saved.';
      this.update({ error, requiresReload: true, problem: 'uncertain' });
      return { ok: false, error };
    } finally {
      this.pendingSave = false;
      this.update({ saving: false });
    }
  };
}

export function workspaceStatus(snapshot: WorkspaceSnapshot): string {
  if (snapshot.saving) return 'Saving…';
  if (snapshot.loading) return snapshot.loaded ? 'Reloading saved work…' : 'Loading workspace…';
  if (snapshot.problem === 'uncertain') return 'Save status unconfirmed';
  if (snapshot.requiresReload) return snapshot.loaded ? 'Reload required' : 'Workspace unavailable';
  if (snapshot.error) return 'Change not saved';
  return snapshot.loaded ? 'Saved workspace' : 'Loading workspace…';
}
