/** Review receipts are learning history, not signed assurance or tamper-proof exam results. */
export type ReviewStatus = 'pass' | 'missing' | 'incorrect' | 'warning' | 'manual';
export type ReviewDifference = {
  label: string; actual: number | null; expected: number; difference: number | null;
  date?: string; account?: string; contact?: string; cashClass?: string;
};
export type MonthCheck = {
  id: string; area: string; title: string; status: ReviewStatus; blocking: boolean;
  explanation: string; action: string; sourceIds: string[]; view: string;
  differences: ReviewDifference[]; fileId?: string;
};
export type MonthAssessment = {
  version: 1; month: string; fingerprint: string; checks: MonthCheck[];
  passed: number; total: number; blockers: number; warnings: number; manual: number;
  ready: boolean;
};
/** Compact saved attempt; full contemporaneous feedback can be exported as HTML. */
export type MonthReviewReceipt = {
  id: string; month: string; at: string; fingerprint: string; passed: number; total: number;
  blockers: number; warnings: number; manual: number; issueIds: string[];
  feedbackRevealed: boolean;
};
