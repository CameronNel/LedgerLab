import {projectWorkdayCompany} from './workday-calendar';
import {generateCompany} from './generator';
import {dr, cr} from './accounts';
import {sum, monthEnd, addDays} from './money';
import type {Journal, PracticeCompany, PracticeState, SourceDocument, Exercise} from './types';
import type {CareerState, CareerCompanyContext} from './career-types';

export const CAREER_MONTHS = Array.from({length: 12}, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`);
export const careerKey = (month: string, task: string) => `${month}|${task}`;
const moneyLabel = (n: number) => `AUD ${(n / 100).toFixed(2)}`;
const bankAmount = (j: Journal) => sum(j.lines.filter(l => l.account === '1000').map(l => l.debit - l.credit));
const memo = (id: string, date: string, party: string, title: string, notes: string[], metadata?: SourceDocument['metadata']): SourceDocument =>
  ({id, date, party, title, kind: 'Memo', notes, metadata, net: 0, tax: 0, total: 0, lines: [], journalIds: []});

export function careerShapeError(c: CareerState): string | null {
  const record = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!c || c.version !== 1 || !CAREER_MONTHS.includes(c.startMonth) || !CAREER_MONTHS.includes(c.activeMonth) ||
      c.activeMonth < c.startMonth || !['financial-accountant','financial-manager'].includes(c.role) ||
      !['supported','messy'].includes(c.scenario) || typeof c.startedAt !== 'string' || c.startedAt.length > 50 ||
      !record(c.closed) || !record(c.submissions) || !record(c.forecasts) || Object.keys(c.closed).length > 12 ||
      Object.keys(c.submissions).length > 200 || Object.keys(c.forecasts).length > 12) return 'Invalid takeover career state.';
  for (const [month, close] of Object.entries(c.closed)) {
    if (!CAREER_MONTHS.includes(month) || month < c.startMonth || month > c.activeMonth || !close || close.month !== month ||
        typeof close.at !== 'string' || close.at.length > 50 || typeof close.reason !== 'string' || !close.reason.trim() ||
        close.reason.length > 1000 || typeof close.assisted !== 'boolean' || !Number.isSafeInteger(close.journalCount) || close.journalCount < 0)
      return 'Invalid monthly close record.';
  }
  if (CAREER_MONTHS.some(month => month >= c.startMonth && month < c.activeMonth && !c.closed[month]))
    return 'A takeover cannot skip an unclosed month.';
  return null;
}

const scenarioCache = new Map<string,PracticeCompany>();
function freezeScenario<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value))freezeScenario(child);
    Object.freeze(value);
  }
  return value;
}
/** Source scenario stays independent of learner postings. Future actuals are not exposed in the company. */
export function companyForState(state: PracticeState, availableOnly = true): PracticeCompany {
  const company = monthlyCompanyForState(state);
  return availableOnly ? projectWorkdayCompany(company,state) : company;
}
function monthlyCompanyForState(state: PracticeState): PracticeCompany {
  if (!state.career) return generateCompany(state.seed);
  const error = careerShapeError(state.career); if (error) throw new Error(error);
  const key=[state.seed,state.career.startMonth,state.career.activeMonth,state.career.role,state.career.scenario].join('|');
  const cached=scenarioCache.get(key);if(cached)return cached;
  const original=generateCompany(state.seed);
  const context: CareerCompanyContext = {startMonth: state.career.startMonth, activeMonth: state.career.activeMonth,
    role: state.career.role, scenario: state.career.scenario};
  const start = `${context.startMonth}-01`, end = monthEnd(context.activeMonth);
  const docs = original.documents.filter(d => d.date <= end && !d.id.startsWith('STMT-')).map(d => structuredClone(d));
  const all = original.solutionJournals.filter(j => j.date <= end).map(j => structuredClone(j));
  const byDoc = new Map(docs.map(d => [d.id, d]));
  function addDoc(d: SourceDocument) { if (!byDoc.has(d.id)) {docs.push(d); byDoc.set(d.id, d);} }

  // The old drill's December wording is not authority that a takeover-period entry is posted.
  for (const d of docs) {
    d.notes = d.notes.map(n => n.replace(/already (?:posted|recorded|accounted for)/gi, 'included in the source scenario (verify whether it is in your ledger)')
      .replace(/All twelve instalments are (?:already recorded|included in the source scenario \(verify whether it is in your ledger\))\./g, 'Only instalments before your start date are in the inherited ledger. Process subsequent monthly instalments.')
      .replace(/(?:Eleven monthly releases have been posted|The first five monthly instalments and depreciation charges are already recorded)\./g,
        'Only activity before your start month is inherited. Process all subsequent activity yourself.'));
  }
  const openingPolicy = byDoc.get('TB-OPEN');
  if (openingPolicy) openingPolicy.notes.push(`Takeover mode: you joined on ${start}. Only pre-start transactions are inherited. Source evidence is not proof of posting. Start-month cleanup is required in the messy handover.`);

  // Fixed-asset information exists at the start of the year; future additions do not.
  const existingFA = byDoc.get('FA-REGISTER');
  if (existingFA) {docs.splice(docs.indexOf(existingFA), 1); byDoc.delete(existingFA.id);}
  const availableAssets = original.assets.filter(a => a.purchaseDate <= end);
  const assetFacts=(assets:PracticeCompany['assets'])=>assets.map(a => `${a.id}: ${a.name}; cost ${moneyLabel(a.cost)}; residual ${moneyLabel(a.residual)}; useful life ${a.lifeMonths} months; available ${a.availableDate}; opening accumulated depreciation ${moneyLabel(a.openingAccumulated)}.`);
  addDoc(memo('FA-REGISTER','2025-01-01','Operations manager','Opening fixed asset master file',[
    'Opening cost and accumulated depreciation agree to the signed opening trial balance. Apply the supplied full-month availability convention.',
    'This opening document is retained unchanged. Use the separate dated monthly asset register for subsequent additions.',
    ...assetFacts(original.assets.filter(a=>a.purchaseDate<'2025-01-01')),
  ]));
  for(const month of CAREER_MONTHS.filter(m=>m<=context.activeMonth))addDoc(memo(`FA-REGISTER-${month}`,monthEnd(month),'Operations manager',`Fixed asset register as at ${monthEnd(month)}`,[
    'Monthly snapshot of assets and availability evidence. Later purchases never change this historical snapshot.',
    'Apply the supplied straight-line depreciation and full-month availability convention; reconcile additions to their original supplier invoices.',
    ...assetFacts(original.assets.filter(a=>a.purchaseDate<=monthEnd(month))),
  ]));
  // Journal sources in the legacy generator sometimes point to year-end memos. Give earlier activity dated evidence instead.
  for (const j of all) {
    const month = j.date.slice(0, 7);
    if(j.sourceId==='FA-REGISTER')j.sourceId=`FA-REGISTER-${month}`;
    if (j.id.startsWith('J-BANK-FEE-')) j.sourceId = `BANK-${month}`;
    if (j.id.startsWith('J-WARRANTY-PAY-')) {
      j.sourceId = `CLAIMS-${month}`;
      addDoc(memo(j.sourceId, j.date, 'Quality manager', 'Approved assurance-warranty claim settlement', [
        `A customer claim of ${moneyLabel(-bankAmount(j))} was approved and settled on ${j.date}. Use the existing warranty provision; this is not a second warranty expense. No GST applies to this settlement in the case.`,
        'Opening warranty provision at 1 January: AUD 6,000. Reassess remaining obligations at year-end when the quality report arrives.'
      ]));
    }
    if (!j.sourceId || !byDoc.has(j.sourceId) || byDoc.get(j.sourceId)!.date > j.date) {
      j.sourceId = `ACT-${j.id}`;
      const cash = bankAmount(j);
      const amountFacts = j.lines.filter(l => l.account !== '1000').map(l => {
        const contact = original.contacts.find(c => c.id === l.contact);
        // Supporting amounts are business facts, not a worked debit/credit table.
        return `${contact?.name ?? ({'2510':'Loan principal','6410':'Financing interest','2600':'Income tax payment','2210':'GST settlement','2200':'Output GST','1400':'Recoverable GST'} as Record<string,string>)[l.account] ?? 'Supporting component'}: ${moneyLabel(l.debit || l.credit)}.`;
      });
      addDoc(memo(j.sourceId, j.date, j.module === 'Tax' ? 'Tax adviser' : 'Finance administration', `${j.description}: supporting advice`, [
        `Effective date: ${j.date}. ${j.description}.`, ...amountFacts,
        ...(cash ? [`Cash movement: ${moneyLabel(cash)}. Verify the independent bank statement. Positive amounts are receipts; negative amounts are payments.`] : []),
        'Case evidence only. Determine the accounting treatment; no statutory eligibility or filing conclusion is supplied.'
      ]));
    }
    j.reference = j.sourceId;
    delete j.exerciseId;
  }
  const transformed = new Map(all.map(j => [j.id, j]));
  const bank = original.bank.filter(r => r.date <= end).map(r => ({...r, reference: transformed.get(r.journalId ?? '')?.sourceId ?? r.reference}));
  // Additional monthly statements use the independent complete scenario, never learner balances.
  for (const month of CAREER_MONTHS.filter(m => m <= context.activeMonth)) {
    const asOf = monthEnd(month), movements = [original.opening, ...all.filter(j => j.date <= asOf)];
    for (const contact of original.contacts) {
      const code = contact.kind === 'customer' ? '1100' : '2000', sign = contact.kind === 'customer' ? 1 : -1;
      const accountMovements=movements.flatMap(j=>j.lines.filter(l=>l.account===code&&l.contact===contact.id).map(l=>({journal:j,amount:(l.debit-l.credit)*sign})));
      const invoices=docs.filter(d=>d.party===contact.name&&d.date<=asOf&&d.kind===(contact.kind==='customer'?'Sales invoice':'Supplier invoice'));
      const lines=invoices.map(d=>{
        const amount=sum(accountMovements.filter(m=>m.journal.sourceId===d.id||(d.id==='SI-2024-118'&&m.journal.id===original.opening.id)).map(m=>m.amount));
        return {description:`${d.id} | Invoice ${d.date} | Due ${d.dueDate??d.date}`,quantity:1,unitPrice:amount,net:amount,tax:0};
      }).filter(l=>l.net!==0);
      const total=sum(accountMovements.map(m=>m.amount)),onAccount=total-sum(lines.map(l=>l.net));
      if(onAccount)lines.push({description:'Unapplied / on-account movements',quantity:1,unitPrice:onAccount,net:onAccount,tax:0});
      addDoc({id: `STMT-${contact.id}-${month}`, kind: contact.kind === 'customer' ? 'Customer statement' : 'Supplier statement',
        date: asOf, party: contact.name, title: `Independent statement as at ${asOf}`, lines, net: total, tax: 0, total,
        notes: ['Independent counterparty open items and closing balance. Includes settlement references. A missing invoice in your books does not disappear from this statement.','Reconcile differences; do not create fresh GST from a statement.'],
        journalIds: [], metadata: {contactId: contact.id,onAccount}});
    }
    if(month<context.startMonth)continue;
    const count = original.inventory.map(item => {
      const n = Number(month.slice(-2)), q = item.openingQty + sum(item.bought.slice(0,n)) - sum(item.sold.slice(0,n)) + (n === 12 ? item.countVariance : 0);
      return {description: `${item.id} ${item.name}`, quantity: q, unitPrice: item.cost, net: q*item.cost, tax: 0};
    });
    addDoc({id:`COUNT-${month}`, kind:'Stock count', date:asOf, party:'Warehouse supervisor', title:'Signed monthly stock control return',
      lines:count, net:sum(count.map(l=>l.net)),tax:0,total:sum(count.map(l=>l.net)),journalIds:[],
      notes:[month.endsWith('-12')?'Read COUNT-2025 for the year-end shortage and NRV evidence.':'All counts agree to the complete source movements. No additional shortage or NRV adjustment is identified this month.','This is independent warehouse evidence, not a report rebuilt from your ledger.']});
    addDoc(memo(`CEO-${month}`, `${month}-01`, 'Managing director', 'Month-end expectations and commercial decisions', [
      `You own the ${month} close. The ledger will not post the month for you. Report by calendar day five after month-end; these are fictional internal deadlines, not statutory filing dates.`,
      'First prioritise cash, payroll, supplier continuity and overdue debt. Then complete controls, estimates, reporting and the management explanation.',
      'Minimum planning cash reserve: AUD 50,000. Prepare a 13-week forecast from month-end, including a receipts-down-15% and two-week-collection-delay stress case. This is a management assumption, not a bank covenant.',
      'Capital proposal: pay AUD 80,000 at approval, then receive five annual incremental after-tax net cash benefits of AUD 25,000 at each year-end. Residual value zero; illustrative hurdle rate 10%. Ignore inflation and additional tax effects. No purchase has been approved or incurred, so do not post the proposal.',
      'Your reporting must distinguish corrections to inherited current-year books, recurring performance, non-cash adjustments and estimate changes. Qualitative recommendations require human review.'
    ]));
    addDoc(memo(`HR-${month}`, `${month}-24`, 'HR lead', 'Payroll release, exception review and payment authority', [
      'The employee master, authorised salary, ordinary allowance, overtime, teaching withholding percentages and deductions are supplied in Payroll. Recalculate the payroll register, payslips and related control accounts.',
      `Draft review exception: a clerk included an extra AUD 350 of unapproved overtime for Alex Taylor. HR has rejected that extra amount. The supplied final PAY-${month} register excludes it; do not add it back. Document the difference between the rejected draft and authorised final register.`,
      'A message claiming to be a supplier asks for new bank details and an urgent same-day payment. No independent callback has been completed. Record the verification and approval steps before including it in a payment run. No actual banking is connected.',
      'Keep preparation and payment approval separate. A learner submission is not evidence of an independent manager approval.'
    ]));
  }
  const inherited: Journal[] = [], corrections: Journal[] = [];
  if (context.scenario === 'messy' && context.startMonth !== '2025-01') {
    const previousEnd = addDays(start, -1);
    const issues = [
      {id:'HANDOVER-INS', title:'Insurance release entered twice', amount:240000,
        lines:[dr('6200',240000),cr('1300',240000)],
        notes:['The former accountant posted an additional AUD 2,400 release at the previous month-end outside the recurring AUD 1,000 monthly run. The premium is AUD 12,000 for January to December. The extra release has no coverage basis. Correct the inherited current-year error on your first day, leaving the historical journal intact.']},
      {id:'HANDOVER-ACCRUAL', title:'Duplicated professional-fee accrual', amount:125000,
        lines:[dr('6240',125000),cr('2100',125000)],
        notes:['An extra AUD 1,250 professional-fee accrual was carried forward despite the service already being invoiced and expensed. The supplier confirms there is no additional obligation. Remove this duplicate on your first day. This is an inherited current-year error, not a prior-year restatement.']},
      {id:'HANDOVER-SUSPENSE', title:'Receipt allocation moved into suspense', amount:87500,
        lines:[dr('1100',87500,'C1'),cr('6990',87500)],
        notes:['Northline Works confirms AUD 875 of a previously recorded receipt was subsequently moved out of its customer account and into suspense. The bank receipt itself is correct. Reinstate the customer credit and clear suspense on your first day. Do not post another bank receipt.']},
    ];
    for (const issue of issues) {
      addDoc(memo(issue.id,start,'Former accountant / independent follow-up',issue.title,issue.notes));
      inherited.push({id:`LEGACY-${issue.id}`,date:previousEnd,description:`Inherited: ${issue.title}`,reference:issue.id,
        sourceId:issue.id,module:'Inherited exception',origin:'seed',lines:issue.lines});
      corrections.push({id:`FIX-${issue.id}`,date:start,description:`Resolve ${issue.title}`,reference:issue.id,
        sourceId:issue.id,module:'Takeover corrections',origin:'seed',lines:issue.lines.map(l=>({...l,debit:l.credit,credit:l.debit}))});
    }
  }
  addDoc(memo('HANDOVER',start,'Departing accountant','Your first day: finance handover',[
    `Start date ${start}. Role: ${context.role === 'financial-manager' ? 'Financial manager' : 'Financial accountant'}. Company: ${original.name}. All people and transactions are fictional.`,
    `Transactions before ${start} are inherited. Current and future months are not preposted. Historical bank matches are carried forward; your first live month needs a new reconciliation.`,
    inherited.length ? 'Three inherited coding/duplication issues require investigation. Read the handover follow-ups and correct them without deleting the former accountant’s entries.' : 'The inherited ledger has no planted takeover errors. It is not a guarantee that the month you prepare will be correct.',
    'Work from documents, not a list of debit/credit answers. Capture invoices, receipts and payments; reconcile every control; prepare month-end journals and produce a management pack.',
    'The month selector changes the report being viewed. Only closing the active month and advancing the simulation releases the next month. Future actual documents are withheld.',
    'On-the-job mode hides worked answers. Guided mode is available separately and any revealed/worked posting remains recorded as assisted.',
    'The existing AUD 2025 teaching assumptions remain in force. This is not a South African tax/payroll engine or a replacement for supervised industry experience.'
  ]));
  if (context.activeMonth === '2025-12') addDoc(memo('AFS-GAPS-2025','2025-12-31','Board secretary','Annual reporting: unresolved information requests',[
    'No complete 2024 income statement or prior-year notes have been supplied. A complete comparative statutory set cannot be signed off on this evidence.',
    'Request related-party declarations, post-balance-sheet board minutes and subsequent-event evidence through the authorisation date, and support for going-concern forecasts. No authorisation date or board approval is supplied.',
    'Draft the statements and disclosure assessments, identify the evidence gaps and owners, and keep approval pending. Submission in LedgerLab is a training milestone, not an IFRS compliance conclusion.'
  ]));
  const target = [...all, ...inherited, ...corrections].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const baseJournals = [...all.filter(j=>j.date<start),...inherited].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const groups = new Map<string, Journal[]>();
  for (const j of [...all.filter(j=>j.date>=start),...corrections]) {
    const key = `${j.date.slice(0,7)}|${j.sourceId}`;
    groups.set(key,[...(groups.get(key)??[]),j]);
  }
  const exercises: Exercise[] = [...groups].map(([key, expected])=>{
    const id = `JOB-${key.replace('|','-')}`, source = byDoc.get(expected[0].sourceId!)!, month = key.slice(0,7);
    for(const j of expected) j.exerciseId=id;
    return {id, matching:'source-month',title:`${source.title} · ${month}`,module:expected[0].module,
      difficulty: ['Tax','Leases','Provisions','Takeover corrections'].includes(expected[0].module)?'Advanced':'Intermediate',
      minutes:15,points:15,brief:`Process all ${month} activity supported by ${source.id}. Use dated source evidence, relevant contacts and appropriate cash-flow classifications. The source may support more than one posting.`,
      documents:[source.id,...(expected.some(j=>bankAmount(j))?[`BANK-${month}`]:[])],hints:['Reconcile the full source history for this month, including any settlements.','Do not assume a source transaction is already in the ledger.'],
      reasoning:'The worked entries follow the independent source facts and the supplied accounting policies. Compare dates, source references, contacts and each account, not merely the trial-balance total.',
      pitfalls:['Posting a settlement as a second expense.','Duplicating an inherited invoice.','Omitting cost of sales, tax or a payroll liability.'],expected,dependsOn:[],assertion:'Completeness, accuracy, cut-off and classification'};
  });
  const result:PracticeCompany = {...original, career:context, period:context.activeMonth, documents:docs.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)),
    baseJournals,solutionJournals:target,exercises,bank,assets:availableAssets,
    payroll:Object.fromEntries(Object.entries(original.payroll).filter(([month])=>month<=context.activeMonth)),
    inventory:original.inventory.map(item=>({...item,bought:item.bought.map((v,i)=>i<Number(context.activeMonth.slice(-2))?v:0),
      sold:item.sold.map((v,i)=>i<Number(context.activeMonth.slice(-2))?v:0),countVariance:context.activeMonth==='2025-12'?item.countVariance:0,
      nrv:context.activeMonth==='2025-12'?item.nrv:item.price}))};
  freezeScenario(result);scenarioCache.set(key,result);
  if(scenarioCache.size>8)scenarioCache.delete(scenarioCache.keys().next().value!);
  return result;
}

export function assertCareerOpenDate(state: PracticeState, date: string): void {
  if (state.career && (date.slice(0,7)!==state.career.activeMonth || state.career.closed[state.career.activeMonth]))
    throw new Error(`Only the open active month ${state.career.activeMonth} accepts changes. Closed months and unreleased future periods are protected.`);
}
export function invalidateCareerMonth(state: PracticeState): void {
  if (!state.career) return;
  const month=state.career.activeMonth;
  for(const s of Object.values(state.career.submissions)) if(s.month===month)s.status='draft';
  if(state.career.forecasts[month])state.career.forecasts[month].status='draft';
}
