/** Day-by-day training state. Dates are scenario dates, never the user's PC clock. */
export type DailySubmission = {
  taskId: string;
  status: 'draft' | 'submitted' | 'blocked';
  figures: Record<string, number>;
  decision: string;
  note: string;
  evidence: string[];
  blocker: string;
  owner: string;
  followUp: string;
  submittedOn?: string;
  updatedAt: string;
};
export type WorkdayState = {
  version: 1;
  today: string;
  enabledOn: string;
  submissions: Record<string, DailySubmission>;
  completions: Record<string, {first: string; latest: string}>;
  history: {from: string; to: string; at: string; note: string; outstanding: string[]; missed: string[]}[];
};
export type DayTask = {
  id: string; month: string; title: string; release: string; due: string;
  priority: 'Critical' | 'High' | 'Normal'; requestor: string; role: string;
  brief: string; steps: string[]; evidence: string[]; view: string; template?: string;
  kind: 'response' | 'processing' | 'bank' | 'formal' | 'forecast';
  formalId?: string; sourceId?: string; effectiveDate?: string; bankId?: string;
  figures: {id: string; label: string; expected: number}[];
  choices?: {id: string; label: string}[]; correctDecision?: string;
};
export type DayTaskStatus = {
  state: 'Not started' | 'In progress' | 'Needs correction' | 'Waiting' | 'Complete';
  complete: boolean; detail: string; differences: {label: string; actual: number; expected: number}[];
};
export type DayMail = {
  id: string; date: string; from: string; subject: string; body: string[]; attachments: string[];
  view?: string; taskId?: string; priority?: string; due?: string; category?: string;
};
