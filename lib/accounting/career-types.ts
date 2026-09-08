/** Serializable takeover state. All money is integer AUD cents. */
export type CareerRole = 'financial-accountant' | 'financial-manager';
export type CareerScenario = 'supported' | 'messy';
export type CareerSubmission = {
  taskId: string; month: string; status: 'draft' | 'submitted';
  figures: Record<string, number>; responses: Record<string, string>;
  evidence: string[]; updatedAt: string;
};
export type ForecastWeek = {
  receipts: number; supplierPayments: number; payroll: number; tax: number;
  overheads: number; capex: number; financingIn: number; financingOut: number;
};
export type CareerForecast = {
  month: string; weeks: ForecastWeek[]; minimumCash: number; assumptions: string;
  actions: string; evidence: string[]; status: 'draft' | 'submitted'; updatedAt: string;
};
export type CareerClose = { month: string; at: string; reason: string; assisted: boolean; journalCount: number };
export type CareerState = {
  version: 1; startMonth: string; activeMonth: string; role: CareerRole; scenario: CareerScenario;
  closed: Record<string, CareerClose>; submissions: Record<string, CareerSubmission>;
  forecasts: Record<string, CareerForecast>; startedAt: string;
};
export type CareerTask = {
  id: string; title: string; area: string; due: string; requestor: string;
  brief: string; view: string; evidence: string[];
  figures: { id: string; label: string; expected: number }[];
  responses: { id: string; label: string; guidance: string }[];
};
export type CareerCompanyContext = Pick<CareerState, 'startMonth' | 'activeMonth' | 'scenario' | 'role'>;
