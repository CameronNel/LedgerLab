import { initialState, applyCommand, validateBackup } from '../accounting/engine';
import type { Command, PracticeState } from '../accounting/types';

export const MAX_ACTION_BYTES = 3_000_000;
export const MAX_STATE_BYTES = 1_500_000;
export type WorkspaceRow = { state_json: string; revision: number; updated_at: string };
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
};
export type WorkspaceDatabase = { prepare(sql: string): Statement };
export type WorkspaceDependencies = {
  owner: () => Promise<string | null>;
  database: () => WorkspaceDatabase;
  now?: () => string;
  onError?: (message: string, cause: unknown) => void;
};
class RequestProblem extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
const reply = (data: unknown, status = 200) => Response.json(data, { status,
  headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

async function readAction(request: Request): Promise<{ revision: number; command: Command }> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestProblem('Send a JSON workspace action.', 415);
  }
  const length = request.headers.get('content-length');
  if (length !== null && Number(length) > MAX_ACTION_BYTES) {
    throw new RequestProblem('This action is too large. Use a smaller backup.', 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestProblem('This action is not valid JSON.', 400);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, raw = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_ACTION_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RequestProblem('This action is too large. Use a smaller backup.', 413);
      }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
  } catch (cause) {
    if (cause instanceof RequestProblem) throw cause;
    throw new RequestProblem('This action is not valid UTF-8 JSON.', 400);
  } finally { reader.releaseLock(); }
  let payload: unknown;
  try { payload = JSON.parse(raw); }
  catch { throw new RequestProblem('This action is not valid JSON.', 400); }
  if (!object(payload) || !Number.isSafeInteger(payload.revision) || (payload.revision as number) < 0 ||
      !object(payload.command) || typeof payload.command.type !== 'string' || !payload.command.type) {
    throw new RequestProblem('This action is incomplete.', 400);
  }
  return { revision: payload.revision as number, command: payload.command as Command };
}

/** Production handlers with injected platform bindings for isolated regression tests.
 * Owner filtering, prepared parameters and compare-and-swap remain at the SQL boundary.
 */
export function createWorkspaceHandlers(dependencies: WorkspaceDependencies) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  async function readWorkspace(user: string): Promise<WorkspaceRow> {
    const db = dependencies.database();
    const select = () => db.prepare('SELECT state_json, revision, updated_at FROM accounting_workspaces WHERE owner_id = ?')
      .bind(user).first<WorkspaceRow>();
    let row = await select();
    if (!row) {
      await db.prepare('INSERT INTO accounting_workspaces (owner_id, state_json, revision, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(owner_id) DO NOTHING')
        .bind(user, JSON.stringify(initialState()), now()).run();
      row = await select();
    }
    if (!row) throw new Error('Could not load your practice workspace.');
    return row;
  }
  return {
    async GET(): Promise<Response> {
      try {
        const user = await dependencies.owner();
        if (!user) return reply({ error: 'Sign in with ChatGPT to save and load your practice.' }, 401);
        const row = await readWorkspace(user);
        return reply({ state: JSON.parse(row.state_json), revision: row.revision, updatedAt: row.updated_at });
      } catch (cause) {
        dependencies.onError?.('Workspace read failed', cause);
        return reply({ error: 'Your workspace could not be loaded. Please try again.' }, 503);
      }
    },
    async POST(request: Request): Promise<Response> {
      try {
        const user = await dependencies.owner();
        if (!user) return reply({ error: 'Sign in with ChatGPT before saving your work.' }, 401);
        const origin = request.headers.get('origin');
        if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
          return reply({ error: 'This save request came from a different site.' }, 403);
        }
        const payload = await readAction(request);
        const row = await readWorkspace(user);
        if (row.revision !== payload.revision) return reply({
          error: 'Your workspace changed in another tab. Reload before saving to avoid overwriting newer work.', conflict: true,
        }, 409);
        const updatedAt = now();
        let next: PracticeState;
        try {
          next = applyCommand(JSON.parse(row.state_json) as PracticeState, payload.command, updatedAt);
          // TypeScript command types do not validate untrusted JSON. Check the complete
          // resulting state before SQL, including legacy/optional backup fields.
          const invalid = validateBackup(next);
          if (invalid) throw new Error(`The action produced invalid workspace data: ${invalid}`);
        }
        catch (cause) { return reply({ error: cause instanceof Error ? cause.message : 'The action was not valid.' }, 400); }
        const serialized = JSON.stringify(next);
        if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) {
          return reply({ error: 'This case is full. Export a backup and start a new case.' }, 413);
        }
        const result = await dependencies.database().prepare('UPDATE accounting_workspaces SET state_json = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?')
          .bind(serialized, updatedAt, user, row.revision).run();
        if (!result.meta.changes) return reply({ error: 'Your workspace changed in another tab. Reload before saving.', conflict: true }, 409);
        return reply({ state: next, revision: row.revision + 1, updatedAt });
      } catch (cause) {
        if (cause instanceof RequestProblem) return reply({ error: cause.message }, cause.status);
        dependencies.onError?.('Workspace save failed', cause);
        return reply({ error: 'The save could not be confirmed. Reload and inspect your saved work before retrying.' }, 503);
      }
    },
  };
}
