import type {WorkdayState, DailySubmission} from './workday-types';
import type {MonthReviewReceipt} from './month-review-types';
import type {DesktopState, DesktopUserFile} from '../desktop/types';
import type {CareerState, CareerCompanyContext, CareerSubmission, CareerForecast, CareerRole, CareerScenario} from './career-types';
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type Account = { code: string; name: string; type: AccountType; group: string; normal: 'debit' | 'credit'; control?: 'customer' | 'supplier'; note?: string };
export type Line = { account: string; debit: number; credit: number; contact?: string; memo?: string; itemId?:string };
export type Journal = { id: string; date: string; description: string; reference: string; module: string; lines: Line[]; sourceId?: string; exerciseId?: string; reverses?: string; createdAt?: string; origin?: 'seed' | 'learner' | 'solution'; cashClass?: 'operating' | 'investing' | 'financing'; };
export type DocLine = { description: string; quantity: number; unitPrice: number; net: number; tax: number; account?: string; itemId?: string };
export type SourceDocument = { id: string; kind: 'Sales invoice' | 'Supplier invoice' | 'Credit note' | 'Supplier credit note' | 'Bank statement' | 'Payslip' | 'Payroll register' | 'Customer statement' | 'Supplier statement' | 'Memo' | 'Contract' | 'Stock count'; date: string; dueDate?: string; party: string; title: string; lines: DocLine[]; net: number; tax: number; total: number; notes: string[]; journalIds: string[]; metadata?: Record<string, string | number>; };
export type BankRow = { id: string; date: string; description: string; reference: string; amount: number; balance: number; journalId?: string; };
export type Contact = { id: string; name: string; kind: 'customer' | 'supplier'; email: string; address: string; terms: number; };
export type Employee = { id: string; name: string; role: string; monthlySalary: number; ordinaryAllowance: number; overtime: number; withholdingBps: number; postTaxDeduction: number; annualLeaveHours: number; hourlyRate: number; };
export type PayRow = { employeeId: string; name: string; role: string; salary: number; allowance: number; overtime: number; gross: number; taxable: number; withholding: number; deductions: number; net: number; ote: number; superRateBps: number; super: number; leaveHours: number; };
export type Asset = { id: string; name: string; category: string; purchaseDate: string; availableDate: string; cost: number; residual: number; lifeMonths: number; openingAccumulated: number; supplier: string; documentId?: string; };
export type StockItem = { id: string; name: string; unit: string; cost: number; price: number; openingQty: number; bought: number[]; sold: number[]; countVariance: number; nrv: number; };
export type Exercise = { matching?: 'source-month'; id: string; title: string; module: string; difficulty: 'Foundation' | 'Intermediate' | 'Advanced'; minutes: number; points: number; brief: string; documents: string[]; hints: string[]; reasoning: string; pitfalls: string[]; expected: Journal[]; dependsOn: string[]; assertion: string; };
export type Lesson = { id: string; title: string; category: string; level: string; objective: string; explanation: string[]; example: { narration: string; lines: Line[] }; checklist: string[]; pitfalls: string[]; sourceUrl?: string; sourceLabel?: string; };
export type PracticeCompany = { career?: CareerCompanyContext; seed: number; name: string; currency: string; year: number; period: string; contacts: Contact[]; documents: SourceDocument[]; opening: Journal; baseJournals: Journal[]; solutionJournals: Journal[]; exercises: Exercise[]; bank: BankRow[]; employees: Employee[]; payroll: Record<string, PayRow[]>; assets: Asset[]; inventory: StockItem[]; budget: { month: string; revenue: number; cogs: number; opex: number }[]; };
export type AuditEvent = { id: string; at: string; action: string; detail: string; };
export type Workpaper = { id: string; conclusion: string; preparer: string; reviewer: string; prepared: boolean; reviewed: boolean; evidence: string[]; updatedAt: string; };
export type CreditAllocation = { id: string; kind: 'customer' | 'supplier'; contactId: string; sourceJournalId: string; invoiceId: string; date: string; amount: number; createdAt: string; };
export type JournalTemplate={id:string;name:string;description:string;lines:Line[];sourceId?:string;cashClass?:Journal['cashClass'];notes:string;updatedAt:string;};
export type BalanceReconciliation={account:string;asOf:string;items:{id:string;description:string;amount:number;documentId?:string}[];conclusion:string;preparer:string;reviewer:string;prepared:boolean;reviewed:boolean;updatedAt:string;};
export type EvidenceRequest = { id:string; title:string; description:string; workpaper:string; owner:string; dueDate:string; priority:'High'|'Normal'|'Low'; status:'To request'|'Requested'|'Received'|'Reviewed'|'Not applicable'; evidence:string[]; notes:string; updatedAt:string; };
export type Disclosure = { id: string; text: string; completed: boolean; updatedAt: string; };
export type PracticeState = { workday?: WorkdayState; monthReviews?: MonthReviewReceipt[]; desktop?: DesktopState; career?: CareerState; schemaVersion: 1; seed: number; journals: Journal[]; bankMatches: Record<string, string[]>; allocations?: CreditAllocation[]; disclosures?: Record<string,Disclosure>; evidenceRequests?: EvidenceRequest[]; journalTemplates?: JournalTemplate[]; balanceReconciliations?:Record<string,BalanceReconciliation>; revealed: string[]; attempts: Record<string, number>; workpapers: Record<string, Workpaper>; taskChecks: Record<string, boolean>; periodLocked: boolean; lockDate?: string; auditLog: AuditEvent[]; customDocuments: SourceDocument[]; notes: string; mode: 'guided' | 'exam'; };
export type WorkspaceEnvelope = { state: PracticeState; revision: number; updatedAt: string; };
export type Command =
 | { type: 'enableWorkday' }
 | { type: 'advanceWorkday'; date: string; note: string; acknowledgeOutstanding: boolean }
 | { type: 'saveDailySubmission'; submission: DailySubmission }
 | { type: 'submitMonthReview' }
 | { type: 'saveDesktopFile'; file: DesktopUserFile; expectedUpdatedAt: string | null }
 | { type: 'trashDesktopFile'; fileId: string; expectedUpdatedAt: string }
 | { type: 'restoreDesktopFile'; fileId: string; expectedUpdatedAt: string }
 | { type: 'markDesktopMailRead'; mailId: string; read: boolean }
 | { type: 'startCareer'; seed: number; startMonth: string; role: CareerRole; scenario: CareerScenario; confirmation: string; daily?: boolean }
 | { type: 'saveCareerSubmission'; submission: CareerSubmission }
 | { type: 'saveCareerForecast'; forecast: CareerForecast }
 | { type: 'closeCareerMonth'; reason: string }
 | { type: 'advanceCareerMonth' }
 | { type: 'reopenCareerMonth'; reason: string }

 | { type: 'postJournal'; journal: Journal }
 | { type: 'captureSourceInvoice'; documentId: string; journal: Journal }
 | { type: 'postDocument'; document: SourceDocument; journal: Journal }
 | { type: 'reverseJournal'; journalId: string; date: string; reason: string }
 | { type: 'reverseJournalBatch'; journalIds: string[]; date: string; reason: string }
 | { type: 'saveJournalTemplate'; template: JournalTemplate }
 | { type: 'saveBalanceReconciliation'; reconciliation: BalanceReconciliation }
 | { type: 'deleteJournalTemplate'; templateId: string }
 | { type: 'applySolution'; exerciseId: string }
 | { type: 'reveal'; exerciseId: string }
 | { type: 'attempt'; exerciseId: string }
 | { type: 'matchBank'; bankId: string; journalIds: string[] }
 | { type: 'matchBankBatch'; matches: {bankId:string;journalIds:string[]}[] }
 | { type: 'importJournals'; journals: Journal[] }
 | { type: 'unmatchBank'; bankId: string }
 | { type: 'allocateCredit'; allocation: CreditAllocation }
 | { type: 'removeAllocation'; allocationId: string }
 | { type: 'saveWorkpaper'; workpaper: Workpaper }
 | { type: 'saveDisclosure'; disclosure: Disclosure }
 | { type: 'saveEvidenceRequest'; request: EvidenceRequest }
 | { type: 'checkTask'; taskId: string; checked: boolean }
 | { type: 'lockPeriod'; locked: boolean; reason: string }
 | { type: 'saveNotes'; notes: string }
 | { type: 'setMode'; mode: 'guided' | 'exam' }
 | { type: 'newCase'; seed: number }
 | { type: 'importBackup'; state: PracticeState };
