import {ACCOUNTS} from './accounts';
import {sum, monthEnd, addDays} from './money';
import {careerKey, CAREER_MONTHS, companyForState} from './career';
import {taskSchedule,unprojectWorkdayCompany} from './workday-calendar';
import type {Journal, PracticeCompany, PracticeState} from './types';
import type {CareerTask, CareerSubmission, CareerForecast, ForecastWeek} from './career-types';

const entries = (company:PracticeCompany,state:PracticeState) => [company.opening,...company.baseJournals,...state.journals];
const balances = (js:Journal[],to:string,from='0000-00-00') => {
  const b:Record<string,number>=Object.fromEntries(ACCOUNTS.map(a=>[a.code,0]));
  for(const j of js)if(j.date>=from&&j.date<=to)for(const l of j.lines)b[l.account]+=l.debit-l.credit;
  return b;
};
const cashClass=(j:Journal)=>j.cashClass??(j.lines.some(l=>['1500','1520','4200','6900','4100'].includes(l.account))?'investing':
  j.lines.some(l=>['2500','2510','2520','2530','3000','3200','6410'].includes(l.account))?'financing':'operating');
export function careerSignature(js:Journal[]):Record<string,number>{
  const map:Record<string,number>={};
  for(const j of js)for(const l of j.lines){
    const flow=j.lines.some(x=>x.account==='1000'||x.account==='1010')?cashClass(j):'';
    const key=[j.date,j.sourceId??'',l.account,l.contact??'',flow].join('|');
    map[key]=(map[key]??0)+l.debit-l.credit;
  }
  return Object.fromEntries(Object.entries(map).filter(([,v])=>v!==0));
}
export function careerLedgerDifferences(company:PracticeCompany,state:PracticeState,month=state.career?.activeMonth??company.period){
  const start=`${state.career?.startMonth??month}-01`,end=monthEnd(month);
  const expected=careerSignature(company.solutionJournals.filter(j=>j.date>=start&&j.date<=end));
  const actual=careerSignature(state.journals.filter(j=>j.date>=start&&j.date<=end));
  return [...new Set([...Object.keys(actual),...Object.keys(expected)])].filter(k=>(actual[k]??0)!==(expected[k]??0))
    .map(key=>({key,actual:actual[key]??0,expected:expected[key]??0}));
}
export function careerMetrics(company:PracticeCompany,state:PracticeState,month:string,worked=false){
  const js=worked?[company.opening,...company.solutionJournals]:entries(company,state),end=monthEnd(month);
  const b=balances(js,end),p=balances(js,end,month+'-01'),before=balances(js,addDays(month+'-01',-1));
  const rev=-sum(ACCOUNTS.filter(a=>a.type==='income'&&a.group==='Revenue').map(a=>p[a.code]));
  const cogs=sum(ACCOUNTS.filter(a=>a.group==='Cost of sales').map(a=>p[a.code]));
  const net=-sum(ACCOUNTS.filter(a=>a.type==='income'||a.type==='expense').map(a=>p[a.code]));
  const pbt=net+p['6800']+p['6810'];
  const annualProfit=-sum(ACCOUNTS.filter(a=>a.type==='income'||a.type==='expense').map(a=>b[a.code]));
  const assets=sum(ACCOUNTS.filter(a=>a.type==='asset').map(a=>b[a.code]));
  const liabilities=-sum(ACCOUNTS.filter(a=>a.type==='liability').map(a=>b[a.code]));
  const equity=-sum(ACCOUNTS.filter(a=>a.type==='equity').map(a=>b[a.code]))+annualProfit;
  const budget=company.budget.find(v=>v.month===month)?.revenue??0;
  const cashFlows={operating:0,investing:0,financing:0};
  for(const j of js.filter(j=>j.date>=month+'-01'&&j.date<=end))cashFlows[cashClass(j)]+=sum(j.lines.filter(l=>['1000','1010'].includes(l.account)).map(l=>l.debit-l.credit));
  return {balances:b,period:p,opening:before,revenue:rev,cogs,grossProfit:rev-cogs,netProfit:net,profitBeforeTax:pbt,
    annualProfit,assets,liabilities,equity,budget,revenueVariance:rev-budget,cashFlows,bank:b['1000'],cash:b['1000']+b['1010']};
}
const response=(id:string,label:string,guidance:string)=>({id,label,guidance});
const figure=(id:string,label:string,expected:number)=>({id,label,expected});

const taskCache=new WeakMap<PracticeCompany,Map<string,CareerTask[]>>();
export function careerTasks(company:PracticeCompany,state:PracticeState,month=state.career?.activeMonth??company.period):CareerTask[]{
  if(!state.career)return [];
  if(state.workday){const full=unprojectWorkdayCompany(company);return careerTasks(full,{...state,workday:undefined},month).map(t=>({...t,due:taskSchedule(t.id,month,state.career!.startMonth).due}));}
  let months=taskCache.get(company);if(!months){months=new Map();taskCache.set(company,months);}
  const cached=months.get(month);if(cached)return cached;
  const result=buildCareerTasks(company,state,month);months.set(month,result);return result;
}

/** Numeric rubrics are source-backed; prose is checked for completion, not professional correctness. */
function buildCareerTasks(company:PracticeCompany,state:PracticeState,month=state.career?.activeMonth??company.period):CareerTask[]{
  if(!state.career)return [];
  const m=careerMetrics(company,state,month,true), b=m.balances, pay=company.payroll[month]??[];
  const end=monthEnd(month), bank=company.bank.filter(r=>r.date<=end).at(-1)?.balance??21000000;
  const after=(days:number)=>addDays(end,days); // Internal illustrative calendar-day targets, labelled in the UI.
  const tasks:CareerTask[]=[];
  const add=(id:string,title:string,area:string,requestor:string,brief:string,view:string,evidence:string[],
    figures:CareerTask['figures'],responses:CareerTask['responses'],day=5)=>tasks.push({id,title,area,requestor,brief,view,
      evidence:[...new Set(evidence)].filter(id=>company.documents.some(d=>d.id===id&&d.date<=end)),figures,responses,due:after(day)});
  if(month===state.career.startMonth)add('handover','Take over the finance function','Takeover','Managing director',
    'Identify inherited exposures, confirm the starting cash position and set a practical first-week plan. Do not simply sign the previous accountant’s reconciliations.',
    'ledger',['HANDOVER','TB-OPEN',...(state.career.scenario==='messy'?['HANDOVER-INS','HANDOVER-ACCRUAL','HANDOVER-SUSPENSE']:[])],
    [figure('bank','Operating bank immediately before takeover',m.opening['1000'])],
    [response('risks','Inherited issues and exposure','Explain the underlying errors, affected balances and how you validated them.'),response('plan','First-week priorities and ownership','Prioritise cash, payroll, supplier continuity, cut-off and reporting; name evidence and next actions.')]);
  add('bank','Reconcile the operating bank','Treasury','Managing director',
    'Process every bank line, distinguish missing cash-book transactions from timing differences, and explain any reconciling items.',
    'bank',[`BANK-${month}`],
    [figure('statement','Statement closing balance',bank),figure('book','Cash-book closing balance',b['1000']),figure('timing','Net deposits less payments outstanding',b['1000']-bank)],
    [response('resolution','Reconciling items and clearance','Document item references, reasons, expected clearance and any action owner.')],2);
  add('receivables','Own receivables and credit control','Working capital','Sales director',
    'Capture customer invoices and receipts, reconcile statements and prepare an action-based collection plan. Westbrook’s overdue opening balance needs a specific decision.',
    'receivables',[`STMT-C7-${month}`,`STMT-C1-${month}`,'SI-2024-118'],
    [figure('control','Gross receivables control balance',b['1100'])],
    [response('collections','Collections, disputes and escalation','State which debtor, how much, the next contact, risk, promised date and escalation. Distinguish recoverability from mere aging.')],3);
  add('payables','Reconcile suppliers and prepare the payment run','Working capital','Operations manager',
    'Capture supplier invoices, match credits and settlements, and identify which payments protect supply without breaching cash limits. Never approve unverified bank-detail changes.',
    'payables',[`STMT-S1-${month}`,`STMT-S3-${month}`,`HR-${month}`],
    [figure('control','Payables control balance, positive if payable',-b['2000'])],
    [response('payment','Proposed payment priorities and holds','Document suppliers, amounts, due dates, approval owner, cash constraint and reasons for disputed or unverified items on hold.')],3);
  add('payroll','Check payroll and reconcile every liability','Payroll','HR lead',
    'Recalculate the final payroll and compare it with the rejected draft exception. Reconcile wages, withholding, deductions and employer contributions to bank payments and closing liabilities.',
    'payroll',[`HR-${month}`,`PAY-${month}`,`BANK-${month}`],
    [figure('gross','Authorised gross payroll',sum(pay.map(p=>p.gross))),figure('net','Net wages',sum(pay.map(p=>p.net))),
      figure('withholding','Withholding',sum(pay.map(p=>p.withholding))),figure('super','Employer contributions',sum(pay.map(p=>p.super))),
      figure('payable','Closing employer-contribution liability',-b['2130']),figure('exception','Rejected additional gross overtime',35000)],
    [response('review','Exceptions, authorisation and control reconciliation','Explain the rejected overtime, employee master checks, gross-to-net tie, separate employer cost and unpaid balance; do not claim independent approval.')],2);
  add('assets','Roll forward fixed assets and financing','Assets and debt','Operations manager',
    'Reconcile cost, depreciation, capital additions, loan principal and lease movements. Separate an unapproved investment proposal from a recognised asset.',
    'assets',['FA-REGISTER','LOAN-AGREEMENT','LEASE-2025',`CEO-${month}`],
    [figure('ppe','Equipment net carrying amount',b['1500']+b['1510']),figure('loan','Total loan principal outstanding',-b['2500']-b['2510'])],
    [response('changes','Additions, depreciation and debt movements','Explain availability dates, life/residual estimates, principal versus interest, non-cash movements and classification evidence.')]);
  add('inventory','Reconcile stock and investigate margin','Inventory','Warehouse supervisor',
    'Reconcile perpetual stock with the independent count and investigate value, quantity, cost-of-sales and margin exceptions. Year-end NRV evidence is a separate assessment.',
    'inventory',[`COUNT-${month}`,...(month==='2025-12'?['COUNT-2025']:[])],
    [figure('stock','Inventory before separate NRV allowance',b['1200']),figure('allowance','NRV allowance, positive',-b['1210']),figure('cogs','Monthly cost of sales including inventory adjustments',m.cogs)],
    [response('recon','Count, costing and margin explanation','Explain differences, root causes, supporting documents, the posting or investigation, and the effect on margin.')]);
  add('cutoff','Prepare the month-end adjustment file','Close','Financial controller',
    'Reconcile insurance, subscriptions, accrued expenses, deferred and unbilled income. Distinguish required closing balances from movements and plan reversals without duplication.',
    'close',['INS-2025','SUB-2025','ACCRUAL-MEMO','UNBILLED-MEMO','CONTRACT-DEC'].filter(id=>company.documents.some(d=>d.id===id)),
    [figure('prepayments','Insurance plus software prepayments',b['1300']+b['1310']),figure('accruals','Accrued expenses payable',-b['2100']),figure('deferred','Customer advances still deferred',-b['2300'])],
    [response('basis','Recognition, cut-off and next-month clearing','Show coverage periods, closing-to-movement reconciliation, source dates and the exact reversal/clearing approach.')]);
  add('tax','Reconcile tax controls and the compliance calendar','Tax','Tax adviser',
    'Reconcile case GST controls and payments. Separate preparation from approval and filing. Current/deferred income tax is an annual exercise under supplied assumptions, not statutory advice.',
    'tax',[`GST-${month}`,`BANK-${month}`,'TAX-MEMO',...company.exercises.filter(e=>e.module==='Tax'&&e.expected.some(j=>j.date.startsWith(month))).flatMap(e=>e.documents)].filter(id=>company.documents.some(d=>d.id===id)),
    [figure('gst','GST settlement liability, signed credit balance',-b['2210']),figure('currentTax','Income tax payable, signed credit balance',-b['2600'])],
    [response('calendar','Reconciliation and obligations tracker','List the period, basis, amount, owner, evidence, approval status and how actual filing dates would be verified. Do not invent statutory deadlines.')]);
  add('reporting','Prepare and explain the management accounts','Reporting','Managing director',
    'Tie the monthly profit and financial position to the reconciled ledger. Explain performance versus budget, unusual movements and the decisions management should make.',
    'reports',[`CEO-${month}`,'TB-OPEN'],
    [figure('revenue','Monthly revenue',m.revenue),figure('grossProfit','Monthly gross profit',m.grossProfit),figure('pbt','Monthly profit before tax',m.profitBeforeTax),
      figure('variance','Revenue less monthly budget (signed)',m.revenueVariance)],
    [response('performance','Performance and variance commentary','Separate price/volume, margin, payroll, timing and non-recurring corrections. Support explanations, rather than just restating a variance.'),
      response('decisions','Recommendations and accountable next actions','Name the decision, financial consequence, owner and follow-up date.')]);
  add('controls','Maintain controls and resolve exceptions','Controls','Managing director',
    'Respond to the bank-change request, maintain segregation of duties and explain the evidence needed to release a payment or approve a journal.',
    'audit',[`HR-${month}`,'HANDOVER'],[],
    [response('fraud','Bank-detail change and urgent-payment response','Specify independent verification using trusted details, dual approval, segregation, documented evidence and escalation.'),
      response('improvement','One practical process improvement','Identify the weakness, preventive/detective control, owner and how you would measure whether it works.')]);
  if(state.career.role==='financial-manager'){
    add('liquidity','Own liquidity and the 13-week forecast','Planning','Managing director',
      'Build and submit the 13-week cash forecast, assess the stress case, and recommend actions. A forecast must have explicit assumptions; historic sales are not guaranteed collections.',
      'career',[`CEO-${month}`,`BANK-${month}`],
      [figure('opening','Forecast opening operating bank',b['1000'])],
      [response('liquidity','Funding, working capital and escalation plan','Quantify the minimum cash point, headroom, collection assumptions, payment options and who authorises funding.')]);
    const npv=sum(Array.from({length:5},(_,i)=>Math.round(2500000/1.1**(i+1))))-8000000;
    add('investment','Evaluate the capital investment proposal','Decision support','Operations manager',
      'Evaluate the supplied five-year investment, including affordability, risk and alternatives. Approval is not a ledger transaction.',
      'career',[`CEO-${month}`],
      [figure('npv','NPV at 10%; round each discounted annual benefit to cents',npv)],
      [response('decision','Recommendation, sensitivity and approval conditions','Explain NPV, downside assumptions, capacity, funding, non-financial considerations and approval gates. Link affordability to the cash forecast.')]);
  }
  if(month==='2025-12'){
    add('afs','Draft the AFS and keep approval gaps visible','Annual reporting','Board',
      'Prepare the financial statements and supporting notes from the final ledger. Do not label the draft complete while comparatives, subsequent events or approvals are missing.',
      'reports',['AFS-GAPS-2025','TB-OPEN','TAX-MEMO','LEGAL-LETTER'],
      [figure('assets','Total assets',m.assets),figure('liabilities','Total liabilities',m.liabilities),figure('equity','Total equity including annual profit',m.equity),figure('profit','Full-year net profit',m.annualProfit)],
      [response('gaps','Comparatives and evidence still required','Identify the specific missing information, owner, why it matters and what would prevent authorisation.'),
        response('judgements','Significant estimates and disclosure judgements','Address ECL, NRV, provisions/contingencies, tax recoverability, leases, going concern and subsequent events with evidence.')]);
    add('auditPack','Assemble the year-end support and board handover','Annual reporting','Financial controller',
      'Prepare a traceable final trial balance, account reconciliations, disclosure support and open-request register. Distinguish prepared schedules from independently reviewed or approved work.',
      'audit',['AFS-GAPS-2025','FA-REGISTER','COUNT-2025','LEGAL-LETTER'],[],
      [response('index','PBC and board-pack index','Map material balances to supporting schedules, evidence and journal references. Assign outstanding items and preserve versions.'),
        response('handoff','Unresolved items, approval and next-period plan','State what is ready, what remains open, who must decide and how reversing entries and January clearing will be handled.')]);
  }
  return tasks;
}

export function submissionIssues(company:PracticeCompany,state:PracticeState,value:CareerSubmission):string[]{
  const task=careerTasks(company,state,value.month).find(t=>t.id===value.taskId);
  if(!task)return ['Unknown role deliverable.'];
  const issues:string[]=[];
  for(const f of task.figures)if(value.figures[f.id]!==f.expected)issues.push(`${f.label}: does not agree to the independent case evidence.`);
  for(const r of task.responses)if((value.responses[r.id]??'').trim().length<60)issues.push(`${r.label}: provide a substantive explanation (at least 60 characters).`);
  if(value.evidence.length<Math.min(2,task.evidence.length)||!value.evidence.some(id=>task.evidence.includes(id)))issues.push('Link relevant source evidence for this deliverable.');
  return issues;
}
export function validateCareerSubmission(company:PracticeCompany,state:PracticeState,v:CareerSubmission,checkSubmitted=true):string|null{
  const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
  if(!v||!state.career||typeof v.month!=='string'||!CAREER_MONTHS.includes(v.month)||v.month<state.career.startMonth||v.month>state.career.activeMonth||
    typeof v.taskId!=='string'||!['draft','submitted'].includes(v.status)||typeof v.updatedAt!=='string'||v.updatedAt.length>50||
    !record(v.figures)||!record(v.responses)||Object.keys(v.figures).length>20||Object.keys(v.responses).length>10||
    Object.values(v.figures).some(n=>!Number.isSafeInteger(n)||Math.abs(n as number)>100_000_000_000)||
    Object.values(v.responses).some(s=>typeof s!=='string'||s.length>5000)||!Array.isArray(v.evidence)||v.evidence.length>20||
    new Set(v.evidence).size!==v.evidence.length||v.evidence.some(id=>typeof id!=='string'||![...company.documents,...state.customDocuments].some(d=>d.id===id)))return 'Role deliverable fields are invalid.';
  const task=careerTasks(company,state,v.month).find(t=>t.id===v.taskId);
  if(!task||Object.keys(v.figures).some(id=>!task.figures.some(f=>f.id===id))||Object.keys(v.responses).some(id=>!task.responses.some(r=>r.id===id)))return 'Unknown role deliverable or answer field.';
  return checkSubmitted&&v.status==='submitted'?submissionIssues(company,state,v).join(' ')||null:null;
}
export const FORECAST_FIELDS: {id:keyof ForecastWeek;label:string}[] = [
  {id:'receipts',label:'Customer receipts'},{id:'supplierPayments',label:'Supplier payments'},{id:'payroll',label:'Payroll / contributions'},
  {id:'tax',label:'Tax payments'},{id:'overheads',label:'Other overheads'},{id:'capex',label:'Capital payments'},
  {id:'financingIn',label:'New funding'},{id:'financingOut',label:'Debt / interest payments'},
];
export function blankForecast(month:string):CareerForecast{return {month,weeks:Array.from({length:13},()=>Object.fromEntries(FORECAST_FIELDS.map(f=>[f.id,0])) as ForecastWeek),minimumCash:5000000,assumptions:'',actions:'',evidence:[],status:'draft',updatedAt:''};}
export function forecastSchedule(opening:number,forecast:CareerForecast,stress=false){
  let running=opening;
  return forecast.weeks.map((w,i)=>{
    const receipts=stress?(i<2?0:Math.round(forecast.weeks[i-2].receipts*0.85)):w.receipts;
    const out=sum(FORECAST_FIELDS.filter(f=>!['receipts','financingIn'].includes(f.id)).map(f=>w[f.id]));
    const before=running;running+=receipts+w.financingIn-out;
    return {week:i+1,date:addDays(monthEnd(forecast.month),1+i*7),opening:before,receipts,inflow:receipts+w.financingIn,outflow:out,
      net:receipts+w.financingIn-out,closing:running,headroom:running-forecast.minimumCash};
  });
}
export function validateCareerForecast(company:PracticeCompany,state:PracticeState,v:CareerForecast):string|null{
  if(!state.career||!v||!CAREER_MONTHS.includes(v.month)||v.month<state.career.startMonth||v.month>state.career.activeMonth||
    !['draft','submitted'].includes(v.status)||!Number.isSafeInteger(v.minimumCash)||v.minimumCash<0||v.minimumCash>100_000_000_000||
    !Array.isArray(v.weeks)||v.weeks.length!==13||typeof v.assumptions!=='string'||v.assumptions.length>5000||typeof v.actions!=='string'||v.actions.length>5000||
    typeof v.updatedAt!=='string'||v.updatedAt.length>50||!Array.isArray(v.evidence)||v.evidence.length>20||new Set(v.evidence).size!==v.evidence.length||
    v.evidence.some(id=>![...company.documents,...state.customDocuments].some(d=>d.id===id)))return 'Cash forecast fields are invalid.';
  for(const w of v.weeks)if(!w||typeof w!=='object'||Array.isArray(w)||Object.keys(w).length!==FORECAST_FIELDS.length||
    FORECAST_FIELDS.some(f=>!Number.isSafeInteger(w[f.id])||w[f.id]<0||w[f.id]>100_000_000_000))return 'Each of 13 forecast weeks needs non-negative integer-cent amounts in all categories.';
  const baseline=forecastSchedule(careerMetrics(company,state,v.month).bank,v);
  if(baseline.some(w=>!Number.isSafeInteger(w.closing)))return 'Forecast amounts exceed safe integer precision.';
  if(v.status==='submitted'&&(v.assumptions.trim().length<100||v.actions.trim().length<60||!v.evidence.length||
    !v.weeks.some(w=>w.receipts>0)||!v.weeks.some(w=>w.supplierPayments+w.payroll+w.overheads+w.tax>0)))
    return 'Submission requires receipts, operating payments, linked evidence, assumptions (100 characters) and actions (60 characters).';
  return null;
}
/** Reject equal-amount matches to the wrong source transaction. Split journals are allowed when their net signature agrees. */
export function careerBankMatchIssues(company:PracticeCompany,state:PracticeState):{bankId:string;detail:string}[]{
  if(!state.career)return [];
  const js=entries(company,state),issues:{bankId:string;detail:string}[]=[];
  for(const row of company.bank.filter(r=>r.date.startsWith(state.career!.activeMonth))){
    const ids=state.bankMatches[row.id];if(!ids)continue;
    const target=company.solutionJournals.find(j=>j.id===row.journalId);
    if(!target){issues.push({bankId:row.id,detail:'The statement line has no available canonical transaction for source verification.'});continue;}
    const matched=ids.map(id=>js.find(j=>j.id===id));
    if(matched.some(j=>!j)){issues.push({bankId:row.id,detail:'A matched journal is missing.'});continue;}
    const expected=careerSignature([target]),actual=careerSignature(matched as Journal[]);
    if([...new Set([...Object.keys(expected),...Object.keys(actual)])].some(k=>(expected[k]??0)!==(actual[k]??0)))issues.push({bankId:row.id,detail:'The matched amount may balance, but its source, date, accounts, contact or cash-flow classification differs from this bank transaction.'});
  }
  return issues;
}

export function careerEvidenceChecks(company:PracticeCompany,state:PracticeState){
  if(!state.career)return [];
  const month=state.career.activeMonth,end=monthEnd(month),js=entries(company,state).filter(j=>j.date<=end),b=balances(js,end);
  const rows=company.bank.filter(r=>r.date.startsWith(month));
  const used=new Set(Object.entries(state.bankMatches).filter(([id])=>company.bank.some(r=>r.id===id&&r.date<=end)).flatMap(([,ids])=>ids));
  const unpresented=js.filter(j=>j.date>='2025-01-01'&&!used.has(j.id)).reduce((n,j)=>n+sum(j.lines.filter(l=>l.account==='1000').map(l=>l.debit-l.credit)),0);
  const statement=company.bank.filter(r=>r.date<=end).at(-1)?.balance??21000000;
  const tasks=careerTasks(company,state),missing=tasks.filter(t=>{
    const s=state.career!.submissions[careerKey(month,t.id)];return !s||s.status!=='submitted'||submissionIssues(company,state,s).length>0;
  });
  return [
    {id:'source',label:'Source-linked postings',remaining:careerLedgerDifferences(company,state).length,detail:'Dates, accounts, contacts, source references and cash-flow classifications must agree. Off-scenario sandbox entries must be reversed before this case-specific close.'},
    {id:'tb',label:'Double-entry integrity',remaining:sum(Object.values(b))===0&&js.every(j=>sum(j.lines.map(l=>l.debit-l.credit))===0)?0:1,detail:'Every journal and the trial balance must balance.'},
    {id:'bank',label:'Statement matching and bank reconciliation',remaining:rows.filter(r=>!state.bankMatches[r.id]).length+(b['1000']-statement-unpresented===0?0:1),detail:'Match every active-month statement line and explain genuine timing differences.'},
    {id:'bank-source',label:'Bank match source integrity',remaining:careerBankMatchIssues(company,state).length,detail:'Equal amounts alone do not identify the correct source transaction.'},
    {id:'deliverables',label:'Role deliverables submitted',remaining:missing.length,detail:missing.map(t=>t.title).join('; ')||'Quantitative fields and evidence are checked; narrative judgement is not independently assessed.'},
    {id:'forecast',label:'13-week cash forecast',remaining:state.career.role==='financial-manager'&&(!state.career.forecasts[month]||state.career.forecasts[month].status!=='submitted'||validateCareerForecast(company,state,state.career.forecasts[month]))?1:0,
      detail:state.career.role==='financial-manager'?'Requires explicit assumptions, amounts, evidence and actions. Forecast quality still requires professional judgement.':'Optional for the financial-accountant track.'},
  ];
}

export function validateCareerRecords(company:PracticeCompany,state:PracticeState):string|null{
  if(!state.career)return null;
  for(const [key,v] of Object.entries(state.career.submissions)){
    if(!v||key!==careerKey(v.month,v.taskId))return 'Role deliverable key does not agree.';
    const error=validateCareerSubmission(company,state,v);if(error)return error;
  }
  for(const [key,v] of Object.entries(state.career.forecasts)){
    if(!v||key!==v.month)return 'Forecast month does not agree.';
    const error=validateCareerForecast(company,state,v);if(error)return error;
  }
  // Revalidate closed periods when importing a backup. A forged closure cannot bypass financial or submission checks.
  for(const month of Object.keys(state.career.closed)){
    const scoped={...state,career:{...state.career,activeMonth:month}};
    const failures=careerEvidenceChecks(company,scoped).filter(c=>c.remaining!==0);
    if(failures.length)return `Closed month ${month} has unresolved controls: ${failures.map(c=>c.label).join(', ')}.`;
  }
  return null;
}
