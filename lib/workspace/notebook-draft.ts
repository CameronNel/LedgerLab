/** Keep a local notebook draft separate from the last saved notebook. */
export type NotebookDraft = { seed: number; text: string; base: string; remote: string };
export const createNotebookDraft = (seed: number, text: string): NotebookDraft =>
  ({ seed, text, base: text, remote: text });

export function reconcileNotebookDraft(draft: NotebookDraft, seed: number, remote: string): NotebookDraft {
  if (seed !== draft.seed) return createNotebookDraft(seed, remote);
  if (remote === draft.remote) return draft;
  if (draft.text === draft.base || draft.text === remote) return createNotebookDraft(seed, remote);
  return { ...draft, remote }; // Never silently discard typing when another tab saved.
}

export function notebookConflict(draft: NotebookDraft): boolean {
  return draft.remote !== draft.base && draft.text !== draft.remote && draft.text !== draft.base;
}

export function resolveNotebookDraft(draft: NotebookDraft, keepDraft: boolean): NotebookDraft {
  return { ...draft, base: draft.remote, text: keepDraft ? draft.text : draft.remote };
}
