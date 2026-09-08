import type {EvidenceRequest,PracticeState} from './types';
export const EVIDENCE_STATUSES=['To request','Requested','Received','Reviewed','Not applicable'] as const;
export function defaultEvidenceRequests():EvidenceRequest[]{
 const definitions:[string,string,string,string[]][]=[
  ['Opening trial balance and reporting policies','A-01','Obtain the agreed opening balances, account mapping and accounting policies.',['TB-OPEN']],
  ['Bank statements and reconciliation support','B-01','Agree year-end bank statements, cash-book balances and subsequent clearance of reconciling items.',['BANK-2025-12','REMIT-DEC31']],
  ['Independent bank confirmation','B-01','Request balances, facilities, security, guarantees and restrictions directly through an appropriate confirmation process.',[]],
  ['Customer statements and aging','C-01','Reconcile customer balances to independent statements and explain unapplied credits.',['STMT-C1-2025-12','STMT-C2-2025-12','ECL-MEMO']],
  ['Subsequent receipts and disputed debts','C-01','Obtain January collection evidence and correspondence supporting recoverability and specific disputes.',[]],
  ['Signed inventory count and NRV assessment','D-01','Retain count records, variance investigation, purchase cost support and selling-price evidence.',['COUNT-2025']],
  ['Fixed asset register and capital invoices','E-01','Agree asset additions, availability dates, depreciation policies, ownership and disposal support.',['FA-REGISTER','PI-CAPEX-12']],
  ['Executed lease contract and amortisation','E-02','Inspect the lease term, payment dates, options and discount-rate support.',['LEASE-2025']],
  ['Supplier statements and subsequent invoices','F-01','Reconcile supplier statements and inspect January invoices for pre-year-end obligations.',['STMT-S1-2025-12','STMT-S2-2025-12','ACCRUAL-MEMO']],
  ['Payroll, leave and employer contribution reports','G-01','Agree employee-level gross-to-net amounts, employer contributions, leave quantities and subsequent payments.',['PAY-2025-12','LEAVE-REPORT']],
  ['Claims, legal updates and warranty estimates','H-01','Review counsel’s assessment, expected timing, claims history, estimation uncertainty and contingencies.',['LEGAL-LETTER','WARRANTY-REPORT']],
  ['Income tax computation and tax-base support','J-01','Reconcile current tax, instalments, temporary differences and DTA recoverability.',['TAX-MEMO','GST-2025-12']],
  ['Loan confirmation and covenant assessment','K-01','Obtain lender confirmation and assess repayment terms, security, covenant calculations and waivers.',['LOAN-AGREEMENT']],
  ['Related parties and management declarations','L-01','Identify relationships, transactions, balances, guarantees, key management and completeness procedures.',[]],
  ['Subsequent events and governance minutes','L-01','Obtain minutes, legal updates and events through the actual financial-statement authorisation date.',[]],
  ['Going-concern forecast and prior-year comparatives','L-01','Request an evidence-based liquidity forecast, financing assumptions and missing comparative performance and cash-flow statements.',[]]
 ];
 return definitions.map(([title,workpaper,description,evidence],i)=>({id:`PBC-${String(i+1).padStart(2,'0')}`,title,description,workpaper,owner:'Finance preparer',dueDate:'2026-01-20',priority:!evidence.length?'High':'Normal',status:evidence.length?'Received':'To request',evidence,notes:'',updatedAt:''}));
}
export function evidenceRequests(state:PracticeState):EvidenceRequest[]{return state.evidenceRequests??defaultEvidenceRequests();}
