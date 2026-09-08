/** Deterministic office workflow. No real email, payment release or statutory filing is performed. */
import type {Command, Journal, PracticeCompany, PracticeState} from './types';
import type {DailySubmission, DayMail, DayTask, DayTaskStatus, WorkdayState} from './workday-types';
import {companyForState, careerKey, CAREER_MONTHS} from './career';
import {careerTasks, careerSignature, validateCareerSubmission, validateCareerForecast, careerBankMatchIssues} from './career-work';
import {ACCOUNTS} from './accounts';
import {monthEnd, addDays, sum} from './money';
import {addBusinessDays, businessDay, priorBusinessDay, closePackDate, workdayLimit, validScenarioDate,
  bankAvailableOn, documentAvailableOn, journalAvailableOn, sourceIsAvailable, taskSchedule, isWorkingDay} from './workday-calendar';

const CFO = 'Priya Shah';
const planCache=new WeakMap<PracticeCompany,Map<string,DayTask[]>>();
const bankCheckCache=new WeakMap<PracticeState,Map<string,ReturnType<typeof careerBankMatchIssues>>>();
function bankIssues(company:PracticeCompany,state:PracticeState,month:string){
 let cache=bankCheckCache.get(state);if(!cache){cache=new Map();bankCheckCache.set(state,cache);}
 const key=[month,state.journals.length,Object.keys(state.bankMatches).length].join('|');
 let result=cache.get(key);if(!result){result=careerBankMatchIssues(company,{...state,career:{...state.career!,activeMonth:month}});cache.set(key,result);}
 return result;
}
const taskId = (month: string, slug: string) => `${month}-${slug}`;
const fig = (id:string,label:string,expected:number) => ({id,label,expected});
const openBalance = (company:PracticeCompany,date:string,account:string) =>
  sum([company.opening,...company.solutionJournals.filter(j=>j.date<date)].flatMap(j=>j.lines.filter(l=>l.account===account).map(l=>l.debit-l.credit)));
const knownBank = (company:PracticeCompany,date:string) => company.bank.filter(r=>bankAvailableOn(r.date)<=date).at(-1)?.balance ?? 21000000;
const money = (v:number) => `AUD ${(v/100).toFixed(2)}`;

export function workdayEnableDate(state:PracticeState):string {
  if(!state.career) throw Error('Start a finance takeover first.');
  const company=companyForState(state,false),month=state.career.activeMonth;
  let date=month+'-01';
  for(const j of state.journals.filter(j=>j.date.startsWith(month))){date=[date,j.date].sort().at(-1)!;const doc=company.documents.find(d=>d.id===j.sourceId);if(doc)date=[date,documentAvailableOn(doc,{...state,workday:{today:date} as WorkdayState})].sort().at(-1)!;}
  for(const row of company.bank.filter(r=>r.date.startsWith(month)&&state.bankMatches[r.id]))date=[date,bankAvailableOn(row.date)].sort().at(-1)!;
  if(Object.values(state.career.submissions).some(v=>v.month===month)||state.career.forecasts[month]||state.career.closed[month]||state.monthReviews?.some(r=>r.month===month))date=[date,addBusinessDays(monthEnd(month),7)].sort().at(-1)!;
  // Existing referenced evidence must stay visible after migration, including available year-end documents.
  for(const id of state.revealed){const ex=company.exercises.find(e=>e.id===id);for(const j of ex?.expected??[])date=[date,journalAvailableOn(j,company,{...state,workday:{today:date} as WorkdayState})].sort().at(-1)!;}
  return date;
}
export function enableWorkday(state:PracticeState):void {
  if(state.workday)throw Error('Day-by-day mode is already enabled.');
  const today=workdayEnableDate(state);
  state.workday={version:1,today,enabledOn:today,submissions:{},completions:{},history:[]};
}

/** Full deterministic task plan. Normal callers receive released tasks only. Expected figures never go into emails. */
export function dayTasks(state:PracticeState, all=false, month=state.career?.activeMonth??''):DayTask[] {
  if(!state.workday||!state.career)return [];
  const company=companyForState(state,false),start=state.career.startMonth,first=month+'-01',end=monthEnd(month),today=state.workday.today;
  let cache=planCache.get(company);if(!cache){cache=new Map();planCache.set(company,cache);}
  const cached=cache.get(month);if(cached)return cached.filter(t=>all||t.release<=today);
  const tasks:DayTask[]=[];
  const response=(slug:string,title:string,release:string,due:string,requestor:string,role:string,brief:string,steps:string[],evidence:string[],view:string,
    figures:DayTask['figures']=[],options:Partial<DayTask>={})=>tasks.push({id:taskId(month,slug),month,title,release,due,requestor,role,brief,steps,evidence:evidence.filter(id=>company.documents.some(d=>d.id===id)),view,figures,priority:'High',kind:'response',...options});
  if(month===start){
    response('welcome','Read the onboarding and confirm your first-day plan',first,businessDay(first),CFO,'CFO',
      'Welcome to the finance team. Start here before posting. Confirm the inherited cash position and tell me what you will tackle first.',
      ['Read the welcome email and HANDOVER. The previous accountant’s ledger is already carried forward.',
        'Open the inherited bank evidence and distinguish the ledger bank balance from the statement balance.',
        'Reply here with the opening operating-bank ledger balance, your priorities and the evidence you used. Do not approve the old reconciliations without checking them.'],
      ['HANDOVER','TB-OPEN'],'ledger',[fig('bank','Inherited operating-bank ledger balance at the start of your first day',openBalance(company,first,'1000'))],{template:'bank'});
    response('records','Request missing prior-year AFS and establish evidence ownership',addBusinessDays(first,1),addBusinessDays(first,4),'Helen Moore','Board secretary',
      'The handover is missing the signed prior-year AFS and complete comparative income information. Record what is absent, who must supply it and what remains unsigned.',
      ['Inspect the handover and opening trial balance; do not fabricate comparatives.',
        'List missing prior-year AFS, notes and approval evidence separately from the current-year reporting task.',
        'Send a request with a named owner and follow-up date in your response. The board secretary will acknowledge the gap; no fictional signed AFS will appear.'],
      ['HANDOVER','TB-OPEN'],'audit',[],{template:'afs'});
  }
  // Weekly cash reporting uses a fixed, independently observable as-of bank figure, not whatever is in the learner ledger.
  for(let date=first;date<=end;date=addDays(date,1)){
    if(new Date(date+'T12:00:00Z').getUTCDay()!==1)continue;
    response(`cash-${date.slice(-2)}`,`Weekly cash position · ${date}`,date,addBusinessDays(date,1),CFO,'CFO',
      `Send a cash update using the last bank extract available on ${date}. Distinguish confirmed cash from expected receipts and identify upcoming payment pressures.`,
      [`Use the bank extract as it stood on ${date}, not a later month-end balance. Prior-working-day bank movements are available the following working day.`,
        'Reconcile known bank movements, identify receipts still requiring allocation, and list payments expected over the next seven days.',
        'Explain reserve headroom, collection assumptions and any payment/funding decision that needs approval. The internal planning reserve is AUD 50,000.'],
      [`BANK-${month}`,`CEO-${month}`],'bank',[fig('statement',`Last available statement balance on ${date}`,knownBank(company,date))],{template:'cash',priority:'High'});
  }
  response('collections','Overdue debtor: agree the collection and escalation plan',businessDay(month+'-05'),businessDay(month+'-08'),'Daniel Brooks','Sales director',
    'Westbrook’s overdue opening debt needs a specific action plan, not another aging printout. Separate the collection action from any expected-credit-loss conclusion.',
    ['Read the opening invoice SI-2024-118 and the inherited customer statement where supplied.',
      'Check the learner ledger for receipts, credits and disputes before deciding what is still collectible.',
      'State the debtor, amount under review, contact/owner, proposed promise date and escalation. Identify missing customer evidence; do not invent a received promise.'],
    ['SI-2024-118','HANDOVER'],'receivables',[],{template:'receivables'});
  response('supplier-run','Prepare a supplier-payment recommendation',businessDay(month+'-10'),businessDay(month+'-12'),'Olivia Chen','Operations director',
    'Prioritise due suppliers and continuity of supply. Send a recommendation with holds and cash impact; you are the preparer, not the independent bank approver.',
    ['Check invoices, credits, due dates and cash already paid before proposing another payment.',
      'Identify disputes, duplicate risks and any changed bank details. Keep unverified items on hold.',
      'Send named suppliers, proposed amounts, due dates, approval owner and the remaining cash headroom. No payment is executed by this response.'],
    [`CEO-${month}`,'HANDOVER'],'payables',[],{template:'payables'});
  response('bank-change','Urgent supplier bank-detail change: make the control decision',businessDay(month+'-12'),businessDay(month+'-12'),'Supplier accounts email','Unverified external request',
    'An email asks you to replace the supplier’s bank details and pay urgently today. The sender says the CFO already agreed. No independent verification has been recorded.',
    ['Do not treat the email, its reply address or its supplied phone number as independent verification.',
      'Choose how to handle the instruction. Record a trusted-channel callback and separate approval requirement in the response.',
      'Submit your control decision here. The simulation sends a next-working-day follow-up; it does not change the scenario’s actual bank transactions.'],
    [`CEO-${month}`,'HANDOVER'],'payables',[],{priority:'Critical',choices:[{id:'hold-verify',label:'Hold change/payment; verify through trusted details and obtain separate approval'},{id:'reply-email',label:'Reply to the same email to confirm, then pay'},{id:'release',label:'Release urgently because the email says the CFO approved'}],correctDecision:'hold-verify'});
  const flashDate=month+'-14';
  const flashRevenue=-sum(company.solutionJournals.filter(j=>j.date>=first&&j.date<=flashDate).flatMap(j=>j.lines.filter(l=>ACCOUNTS.some(a=>a.code===l.account&&a.type==='income'&&a.group==='Revenue')).map(l=>l.debit-l.credit)));
  response('flash','Send the mid-month revenue flash and caveats',businessDay(month+'-15'),businessDay(month+'-17'),CFO,'CFO',
    `I need a short performance update for the board call, covering revenue through ${flashDate}. Keep it provisional and explain what is not yet closed.`,
    [`Complete the known sales/recognition work through ${flashDate}; use source dates, not email-arrival dates, for accounting cut-off.`,
      'Calculate month-to-date recognised revenue, excluding GST. Reconcile it to source-supported postings and state the as-of date.',
      'Explain collection/margin risks, unprocessed information and why a mid-month flash is not a full-month result. Do not present a full monthly budget as a like-for-like half-month target.'],
    company.documents.filter(d=>d.date>=first&&d.date<=flashDate&&['Sales invoice','Credit note'].includes(d.kind)).slice(0,3).map(d=>d.id),'reports',[fig('revenue',`Recognised revenue ${first} to ${flashDate}, excluding GST`,flashRevenue)],{template:'management'});
  const payroll=company.payroll[month]??[];
  response('payroll-release','Review payroll before the scheduled pay run',priorBusinessDay(month+'-23'),priorBusinessDay(month+'-24'),'Sofia Patel','HR lead',
    'The authorised register is ready for pre-payment review. A rejected draft included AUD 350 extra overtime for Alex Taylor; the supplied final register excludes it.',
    ['Compare the register with the employee master and permitted salary/allowance/overtime assumptions. The register is delivered before its pay date.',
      'Recalculate gross-to-net, employer contributions and the rejected draft difference. Do not add rejected overtime to the authorised final file.',
      'Recommend release only of the authorised register, subject to independent payment approval. Posting the payroll and reconciling liabilities after pay day are separate tasks.'],
    [`HR-${month}`,`PAY-${month}`],'payroll',[fig('net','Authorised net wages for the pay run',sum(payroll.map(p=>p.net))),fig('exception','Rejected extra gross overtime',35000)],
    {template:'payroll',priority:'Critical',choices:[{id:'final-only',label:'Use authorised final register; exclude rejected overtime; request independent approval'},{id:'add-overtime',label:'Add the rejected overtime back and release the larger amount'}],correctDecision:'final-only'});
  response('cutoff-plan','Obtain cut-off confirmations from department owners',businessDay(month+'-26'),priorBusinessDay(end),'Olivia Chen','Operations director',
    'Before month-end, organise evidence for goods, services, uninvoiced costs, unbilled revenue and stock. Missing invoices are not proof there is no obligation.',
    ['Identify the departments and evidence needed for received-not-invoiced costs and earned-not-billed revenue.',
      'Define the cut-off date, owner, submission deadline and follow-up for missing returns.',
      'Record your plan and unresolved items. Book adjustments only once supported; month-end evidence arrives separately.'],
    [`CEO-${month}`],'close',[],{template:'accrual'});
  response('tax-calendar','Prepare the obligations and approvals tracker',businessDay(month+'-18'),businessDay(month+'-21'),'James Wright','External tax adviser',
    'Keep a tracker of payroll reporting, withholding, employer contributions and GST. Internal simulation deadlines are not legal filing dates.',
    ['Identify the obligation, period, owner, amount/source, review status and filing/payment evidence required.',
      'Keep the case’s dated AUD 2025 teaching assumptions separate from current rules. Do not infer a statutory deadline from a generated payment date.',
      'Explain who verifies actual statutory due dates and who approves/submits. This application does not lodge returns or report payroll.'],
    [`CEO-${month}`],'tax',[],{template:'close'});
  if(month==='2025-12')response('annual-plan','Year-end: circulate the evidence and AFS responsibility plan',businessDay(month+'-10'),businessDay(month+'-17'),'Helen Moore','Board secretary',
    'Set out the annual reporting work and the evidence needed before the board can authorise the accounts.',
    ['Allocate estimates, related parties, contingencies, tax, comparatives, going concern and subsequent events to named owners.',
      'Keep the unsigned draft clearly labelled and distinguish preparation from review and board authorisation.',
      'Track information still outstanding after year-end; do not claim the future evidence or a board approval already exists.'],
    ['HANDOVER','TB-OPEN'],'reports',[],{template:'afs'});
  // Original role deliverables remain authoritative; their detailed reconciliation figures are not available to submit early.
  for(const task of careerTasks(company,state,month)){
    const schedule=taskSchedule(task.id,month,start);
    tasks.push({id:taskId(month,`formal-${task.id}`),month,title:task.title,...schedule,priority:['bank','payroll','reporting'].includes(task.id)?'High':'Normal',
      requestor:({ 'Managing director':'Amelia Hart','Board':'Helen Moore','HR lead':'Sofia Patel','Operations manager':'Olivia Chen','Sales director':'Daniel Brooks','Tax adviser':'James Wright'} as Record<string,string>)[task.requestor]??CFO,
      role:task.requestor,brief:task.brief,steps:['Open the attached evidence and prepare the supporting working paper.',
        'Complete the formal deliverable fields in Finance desk. Saving a spreadsheet or reading this email is not submission.',
        'Submit the checked figures, source references and your conclusion. Numerical correctness and professional judgement are treated separately.'],
      evidence:task.evidence,view:'career',kind:'formal',formalId:task.id,figures:[],template:({bank:'bank',payroll:'payroll',reporting:'management',receivables:'receivables',payables:'payables',assets:'assets',inventory:'inventory',cutoff:'accrual',afs:'afs'} as Record<string,string>)[task.id]});
  }
  if(state.career.role==='financial-manager')tasks.push({id:taskId(month,'forecast'),month,title:'Submit the rolling 13-week cash forecast',release:closePackDate(month),due:addBusinessDays(end,5),priority:'High',requestor:CFO,role:'CFO',brief:'Build the base forecast and stress response from the closed-month cash position. Keep assumed receipts separate from actual cash.',steps:['Prepare the 13-week workbook using the supplied minimum reserve and stress case.','Enter all 13 weeks, assumptions, evidence and actions in the formal forecast screen.','Submit the forecast, then update the linked liquidity recommendation. Assumption quality remains a human-review matter.'],evidence:[`BANK-${month}`,`CEO-${month}`],view:'career',kind:'forecast',figures:[],template:'cash'});
  // Individual source/date work avoids counting a future settlement as missing on the invoice's arrival day.
  const groups=new Map<string,Journal[]>();
  for(const j of company.solutionJournals.filter(j=>j.date.startsWith(month)&&j.date>=start+'-01')){
    const key=`${j.date}|${j.sourceId}`;groups.set(key,[...(groups.get(key)??[]),j]);
  }
  for(const [key,js] of groups){
    const j=js[0],doc=company.documents.find(d=>d.id===j.sourceId),release=js.map(x=>journalAvailableOn(x,company,state)).sort().at(-1)!;
    const invoice=doc&&['Sales invoice','Supplier invoice','Credit note','Supplier credit note'].includes(doc.kind)&&doc.date===j.date;
    tasks.push({id:taskId(month,`process-${key.replace(/[^A-Za-z0-9-]/g,'_')}`),month,title:`${invoice?'Capture':'Process'} ${j.sourceId} · ${j.date}`,release,
      due:addBusinessDays(release,invoice?2:1),priority:j.module==='Payroll'?'High':'Normal',requestor:'Finance operations',role:'Processing queue',
      brief:invoice?`${doc!.title}: capture the original document once. Any later settlement is separate work.`:`Process the ${j.date} activity supported by ${j.sourceId}. ${j.description}.`,
      steps:invoice?['Read the source invoice/credit and select the correct counterparty and coding.','Use Capture invoice. Record any separate required cost-of-sales/inventory effects.','Check the posted source link; do not create another copy of the source document.']:
        ['Read the source and any available bank evidence. Determine whether this is a receipt, payment, estimate, release or reclassification.',`Post the supported entry with accounting date ${j.date} and source reference ${j.sourceId}. Keep originals and use traceable corrections.`, 'Use Check today’s work to find missing or incorrect source effects. A journal balancing does not by itself make it correct.'],
      evidence:[j.sourceId!,...(js.some(x=>x.lines.some(l=>l.account==='1000'))?[`BANK-${month}`]:[])],view:invoice?(doc!.kind.startsWith('Supplier')?'payables':'receivables'):'ledger',
      kind:'processing',sourceId:j.sourceId,effectiveDate:j.date,figures:[]});
  }
  for(const row of company.bank.filter(r=>r.date.startsWith(month))){
    const release=bankAvailableOn(row.date);
    tasks.push({id:taskId(month,`bank-${row.id}`),month,title:`Match bank: ${row.description}`,release,due:addBusinessDays(release,1),priority:'Normal',requestor:'Practice Bank',role:'Cash reconciliation',
      brief:`Statement line ${row.id} dated ${row.date}; reference ${row.reference}.`,steps:['Find the underlying source and record the cash-book entry if it is missing.','Match to the correct transaction, not merely another entry for the same amount.','Investigate unmatched or wrongly matched items; do not post a second expense for a supplier settlement.'],
      evidence:[`BANK-${month}`,row.reference].filter(id=>company.documents.some(d=>d.id===id)),view:'bank',kind:'bank',bankId:row.id,figures:[]});
  }
  tasks.sort((a,b)=>a.due.localeCompare(b.due)||a.release.localeCompare(b.release)||a.id.localeCompare(b.id));cache.set(month,tasks);
  return tasks.filter(t=>all||t.release<=today);
}

const result=(state:DayTaskStatus['state'],detail:string,differences:DayTaskStatus['differences']=[]):DayTaskStatus=>({state,complete:state==='Complete',detail,differences});
export function dayTaskStatus(task:DayTask,state:PracticeState,fullCompany=companyForState(state,false)):DayTaskStatus {
  if(task.kind==='processing'){
    const expected=careerSignature(fullCompany.solutionJournals.filter(j=>j.date===task.effectiveDate&&j.sourceId===task.sourceId));
    const actual=careerSignature(state.journals.filter(j=>j.date===task.effectiveDate&&j.sourceId===task.sourceId));
    const differences=[...new Set([...Object.keys(expected),...Object.keys(actual)])].filter(k=>(actual[k]??0)!==(expected[k]??0)).map(k=>({label:k,actual:actual[k]??0,expected:expected[k]??0}));
    return differences.length?result(Object.keys(actual).length?'Needs correction':'Not started','Source effects must agree by date, account, contact and cash-flow class. Future settlements are not included in this task.',differences):result('Complete','Saved source effects agree.');
  }
  if(task.kind==='bank'){
    if(!state.bankMatches[task.bankId!])return result('Not started','This available statement line is not matched.');
    const issue=bankIssues(fullCompany,state,task.month).find(i=>i.bankId===task.bankId);
    return issue?result('Needs correction',issue.detail):result('Complete','The saved match identifies the correct source transaction.');
  }
  if(task.kind==='formal'){
    const s=state.career?.submissions[careerKey(task.month,task.formalId!)];
    if(!s)return result('Not started','Submit this formal deliverable in Finance desk.');
    const invalid=validateCareerSubmission(fullCompany,state,{...s,status:'submitted'});
    return s.status==='submitted'&&!invalid?result('Complete','Formal numerical/completion checks pass. Written judgement is not graded.'):result(s.status==='draft'?'In progress':'Needs correction',invalid??'The deliverable is a draft or was reopened after ledger changes.');
  }
  if(task.kind==='forecast'){
    const forecast=state.career?.forecasts[task.month];
    if(!forecast)return result('Not started','Enter and submit the formal 13-week forecast.');
    const invalid=validateCareerForecast(fullCompany,state,{...forecast,status:'submitted'});
    return forecast.status==='submitted'&&!invalid?result('Complete','Forecast structure submitted. Commercial realism requires human review.'):result('In progress',invalid??'Forecast draft not yet submitted.');
  }
  const s=state.workday?.submissions[task.id];
  if(!s)return result('Not started','Prepare the requested response and link the evidence you used.');
  if(s.status==='blocked')return result('Waiting',`Waiting on ${s.owner}; follow up ${s.followUp}. ${s.blocker}`);
  const differences=task.figures.filter(f=>s.figures[f.id]!==f.expected).map(f=>({label:f.label,actual:s.figures[f.id]??0,expected:f.expected}));
  if(s.status!=='submitted')return result('In progress','Response draft saved; submit after checking it.',differences);
  if(differences.length||task.correctDecision&&s.decision!==task.correctDecision)return result('Needs correction','The numerical or defined control decision is incorrect. Revise and resubmit.',differences);
  if(s.note.trim().length<80||!s.evidence.some(id=>task.evidence.includes(id)))return result('Needs correction','A specific response and at least one relevant source reference are required.');
  if(s.evidence.some(id=>id.startsWith('UF-')&&!state.desktop?.files.some(f=>f.id===id&&!f.deleted)))return result('Needs correction','A supporting workbook has been recycled or removed. Restore it or update the submission.');
  return result('Complete','Response received; defined numerical/control checks pass. Narrative quality and approvals are not independently endorsed.');
}
export function daySummary(state:PracticeState){
  const company=companyForState(state,false),tasks=dayTasks(state),today=state.workday?.today??'',statuses=tasks.map(task=>({task,status:dayTaskStatus(task,state,company)}));
  const open=statuses.filter(x=>!x.status.complete);
  return {tasks:statuses,open,overdue:open.filter(x=>x.task.due<today),due:open.filter(x=>x.task.due===today),arrived:statuses.filter(x=>x.task.release===today),completed:statuses.filter(x=>x.status.complete),
    next:open.sort((a,b)=>Number(b.task.id.endsWith('-welcome'))-Number(a.task.id.endsWith('-welcome'))||a.task.due.localeCompare(b.task.due)||(['Critical','High','Normal'].indexOf(a.task.priority)-['Critical','High','Normal'].indexOf(b.task.priority)))[0]};
}

/** Known task messages and source deliveries; later emails are not returned to the client. */
export function dayMail(state:PracticeState):DayMail[]{
  if(!state.workday||!state.career)return [];
  const full=companyForState(state,false),today=state.workday.today,start=state.career.startMonth,active=state.career.activeMonth;
  const allTasks=CAREER_MONTHS.filter(m=>m>=start&&m<=active).flatMap(month=>dayTasks(state,true,month));
  const messages:DayMail[]=[{id:'MAIL-WELCOME',date:start+'-01',from:`${CFO} · CFO`,subject:'Welcome to Harbour & Co. | Start with this email',priority:'High',category:'Onboarding',taskId:taskId(start,'welcome'),due:businessDay(start+'-01'),view:'career',attachments:['HANDOVER','TB-OPEN'],body:[
    'Welcome to the finance team. You have inherited the former accountant’s books, not a blank company. Your job is to process, reconcile, explain and recommend action, while preserving a clear trail.',
    `Your first day is ${start}-01. The PC date is the date inside this fictional job; it does not change your actual computer clock. Start with Today → Read onboarding, then complete the first-day response.`,
    'Your daily routine: read new mail, review cash and urgent deadlines, process source records, reconcile and investigate, send requested outputs, then use Check today’s work. Move to the next working day when ready.',
    'The clock only moves forward. A date jump delivers everything that arrived in the interval but does not complete the work. Open items remain on your desk and late deadlines are recorded.',
    'Invoices have an issue date and an arrival date. Supplier invoices arrive one working day later. Bank feeds arrive on the next working day. The payroll review pack arrives before payday. Month-end statements arrive on the first working day after month-end.',
    'The PC date and the open accounting month are different. You finish July’s close in early August, still posting adjustments into July. This version allows one open accounting month; after closing it, release the next period. Its already-arrived records become available as a backlog.',
    'Open the task from each request. The task tells you what to deliver, where to work, which evidence to use, and the internal deadline. A saved workbook is supporting evidence, not a journal or a submitted formal reconciliation.',
    'Priya Shah (CFO) owns cash/reporting priorities; Amelia Hart (managing director) requests decisions; Olivia Chen (operations) owns supplier/stock evidence; Daniel Brooks (sales) owns collections; Sofia Patel (HR) owns payroll; James Wright (tax adviser) reviews compliance assumptions; Helen Moore (board secretary) owns annual-reporting evidence.',
    'These are fictional company deadlines at the end of the stated day, using Monday–Friday without public holidays. They are not tax or payroll filing deadlines. All money and accounting assumptions remain in the supplied single-entity AUD 2025 case.',
    'Keep payment preparation, independent approval and execution separate. No real email is sent, no bank payment is released, and no statutory return is lodged. Numerical checks do not certify your written judgement or a complete AFS set.'
  ]},{id:'MAIL-HANDOVER',date:start+'-01',from:'Alex Morgan · Departing accountant',subject:'Handover folder, inherited records and unresolved points',view:'ledger',attachments:full.documents.filter(d=>d.id==='HANDOVER'||d.id.startsWith('HANDOVER-')).map(d=>d.id),body:[
    'I have left the opening policies, source files and historical ledger in Handover and Finance. Activity before your joining month is posted; your live month is yours to process.',
    state.career.scenario==='messy'&&start!=='2025-01'?'The handover follow-ups describe three inherited duplication/coding errors. Leave my original journals intact and correct with evidence.':'This supported opening has no planted predecessor-error journals. You still need to establish ownership and complete the controls.',
    'Start with the CFO’s onboarding email and first-day response. I cannot provide signed prior-year accounts that are absent from this teaching case.'
  ]}];
  for(const task of allTasks.filter(t=>!['processing','bank'].includes(t.kind))){
    messages.push({id:`MAIL-REQUEST-${task.id}`,date:task.release,from:`${task.requestor} · ${task.role}`,subject:task.title,body:[task.brief,
      `Please deliver by end of day ${task.due}. Priority: ${task.priority}.`,...task.steps,
      'Use Open assignment to prepare the requested output. Marking this email read does not complete the task. If blocked, record the issue, evidence owner and follow-up date instead of claiming completion.'],
      attachments:task.evidence.filter(id=>sourceIsAvailable(full,{...state,workday:{...state.workday!,today:task.release}},id)),view:task.view,taskId:task.id,due:task.due,priority:task.priority,category:'Request'});
    const current=dayTaskStatus(task,state,full),completion=state.workday.completions[task.id];
    for(const [tag,date,subject] of [['REMINDER',task.due,'Due today'],['ESCALATION',addBusinessDays(task.due,1),'Overdue: status and recovery plan needed']] as const){
      // A historical missed-deadline message persists after later completion; timely work does not receive an escalation.
      if(date<=today && task.release<date && (!completion||completion.first>=(tag==='REMINDER'?date:addDays(date,0))))messages.push({id:`MAIL-${tag}-${task.id}`,date,from:`${task.requestor} · ${task.role}`,subject:`${subject}: ${task.title}`,body:[tag==='REMINDER'?`Please submit the requested output by end of day ${task.due}.`:`The deadline was ${task.due}. Please provide the outstanding output or an explicit blocker, owner and recovery date.`,
        current.complete?'This is retained correspondence. The task is now completed; see Today for its current status.':'The live task still needs attention. This reminder neither posts a correction nor waives the control.'],attachments:[],taskId:task.id,view:task.view,due:task.due,priority:tag==='ESCALATION'?'Critical':task.priority,category:tag==='ESCALATION'?'Escalation':'Reminder'});
    }
    const sub=state.workday.submissions[task.id];
    if(sub){
      messages.push({id:`MAIL-SENT-${task.id}`,date:sub.submittedOn??state.workday.enabledOn,from:'You · Finance team',subject:`${sub.status==='blocked'?'Blocker':sub.status==='draft'?'Saved draft':'Response'}: ${task.title}`,body:[sub.note||'(Draft response)',...(sub.status==='blocked'?[`Blocked: ${sub.blocker}`,`Owner: ${sub.owner}; follow-up: ${sub.followUp}`]:[]),...task.figures.filter(f=>sub.figures[f.id]!==undefined).map(f=>`${f.label}: ${money(sub.figures[f.id])}`),
        'This is your latest saved in-simulation response, not an externally sent message. Earlier drafts are not retained as email versions.'],attachments:sub.evidence.filter(id=>!id.startsWith('UF-')),taskId:task.id,view:task.view,category:sub.status==='draft'?'Draft':'Sent'});
      if(sub.status!=='draft'&&sub.submittedOn){const date=addBusinessDays(sub.submittedOn,1);if(date<=today)messages.push({id:`MAIL-REPLY-${task.id}`,date,from:task.id.endsWith('bank-change')?'Supplier callback log · independently verified in scenario':`${task.requestor} · ${task.role}`,subject:`Re: ${task.title}`,body:task.id.endsWith('bank-change')?
        (sub.decision==='hold-verify'?['Simulated callback result: the supplier confirms that its existing bank details have not changed. The urgent change email was not authorised.','Retain the hold, record the verification trail, notify the CFO and keep the payment approver independent. This does not create or reverse a bank transaction.']:
        ['The instruction has not been independently verified. Return the proposed change/payment to hold and complete trusted-channel verification before requesting approval.','No actual payment was released by your selected response. Revise the control decision and retain the incident as a learning point.']):
        sub.status==='blocked'?[`Blocker received. ${sub.owner} is recorded as the evidence owner; your follow-up is ${sub.followUp}.`,'This acknowledgement is not the missing evidence and does not extend the original deadline. Follow up and keep the task open.']:
        task.id.endsWith('-records')?['Your evidence request has been logged. The signed prior-year AFS and complete comparative income statement are still unavailable in this case.','Keep the gap explicit in reporting and do not invent a receipt or approval. Your task can be complete as a documented request, not as proof the evidence arrived.']:
        ['Your response has been logged for review. This is an acknowledgement of receipt, not independent professional approval.','Check Today for numerical/completion feedback and keep supporting work available. Any recommendations and assumptions still need substantive review.'],attachments:[],taskId:task.id,view:task.view,category:'Reply'});}
    }
  }
  const delivered=new Map<string,string[]>();
  for(const d of full.documents.filter(d=>d.date>=start+'-01'&&!d.id.startsWith('HANDOVER')&&!d.id.startsWith('CEO-'))){const date=documentAvailableOn(d,state);delivered.set(date,[...(delivered.get(date)??[]),d.id]);}
  for(const [date,ids] of delivered)messages.push({id:`MAIL-DELIVERY-${date}`,date,from:'Finance administration',subject:`Source documents received · ${date}`,body:[`${ids.length} source documents have arrived in Finance. Open the attachments or Today’s processing queue.`,
    'The file’s accounting/effective date may differ from its arrival date. Use the correct date in the open accounting month; receipt does not mean the entry is already posted.','Payroll packs can be supplied before their scheduled pay date. Do not post a future-dated actual just because you can review the supporting pack.'],attachments:ids,category:'Documents'});
  const bankDays=new Map<string,number>();
  for(const row of full.bank.filter(r=>r.date>=start+'-01')){const date=bankAvailableOn(row.date);bankDays.set(date,(bankDays.get(date)??0)+1);}
  for(const [date,count] of bankDays)messages.push({id:`MAIL-BANKFEED-${date}`,date,from:'Practice Bank · Daily feed',subject:`${count} bank movements available · ${date}`,body:[`${count} statement movements are available for matching. The bank extract contains only information released by the PC date.`,
    'Process missing cash-book entries before matching. Distinguish a cash settlement from the original invoice and preserve the correct source reference.'],attachments:[`BANK-${date.slice(0,7)>active?active:date.slice(0,7)}`],view:'bank',category:'Bank feed'});
  return messages.filter(m=>m.date<=today).map(m=>({...m,attachments:m.attachments.filter(id=>sourceIsAvailable(full,state,id))})).sort((a,b)=>b.date.localeCompare(a.date)||Number(b.id==='MAIL-WELCOME')-Number(a.id==='MAIL-WELCOME')||a.id.localeCompare(b.id));
}

export function validateDailySubmission(s:DailySubmission,task:DayTask,state:PracticeState,historical=false):string|null {
  const record=(x:unknown)=>!!x&&typeof x==='object'&&!Array.isArray(x);
  if(!s||task.kind!=='response'||s.taskId!==task.id||!['draft','submitted','blocked'].includes(s.status)||!record(s.figures)||Object.keys(s.figures).some(k=>!task.figures.some(f=>f.id===k))||Object.values(s.figures).some(v=>!Number.isSafeInteger(v)||Math.abs(v)>1e13)||typeof s.decision!=='string'||s.decision.length>100||typeof s.note!=='string'||s.note.length>6000||!Array.isArray(s.evidence)||s.evidence.length>30||new Set(s.evidence).size!==s.evidence.length||s.evidence.some(v=>typeof v!=='string'||v.length>150)||typeof s.blocker!=='string'||s.blocker.length>2000||typeof s.owner!=='string'||s.owner.length>150||typeof s.followUp!=='string'||s.followUp.length>10||(!!s.followUp&&!validScenarioDate(s.followUp))||typeof s.updatedAt!=='string'||s.updatedAt.length>50)return 'Invalid daily response.';
  if(s.decision&&!task.choices?.some(c=>c.id===s.decision))return 'Choose a listed control decision.';
  if(s.status==='blocked'&&(!s.blocker.trim()||s.owner.trim().length<2||!validScenarioDate(s.followUp)||s.followUp<state.workday!.today))return 'A blocker needs a description, named owner and follow-up date no earlier than the PC date.';
  if(s.status==='submitted'&&(s.note.trim().length<80||!s.evidence.some(id=>task.evidence.includes(id))||task.figures.some(f=>s.figures[f.id]===undefined)||task.choices&&!s.decision))return 'Complete the requested figures/control choice, a specific response (at least 80 characters) and at least one relevant evidence reference before submitting.';
  const full=companyForState(state,false);
  if(s.evidence.some(id=>!sourceIsAvailable(full,state,id)&&!state.desktop?.files.some(f=>f.id===id&&(historical||!f.deleted))))return 'A linked source/workbook is unavailable. Use evidence you can access on this PC date.';
  // Incorrect answers can be submitted to receive learning feedback; they do not complete the task or pass the close gate.
  return null;
}

export function saveDailySubmission(state:PracticeState,submission:DailySubmission,now:string):void {
  if(!state.workday||!state.career)throw Error('Enable day-by-day mode first.');
  if(state.career.closed[state.career.activeMonth])throw Error('Reopen the active accounting month before changing its responses.');
  const task=dayTasks(state).find(t=>t.id===submission?.taskId);if(!task)throw Error('This assignment has not arrived or belongs to another accounting month.');
  const invalid=validateDailySubmission(submission,task,state);if(invalid)throw Error(invalid);
  state.workday.submissions[task.id]={...submission,submittedOn:state.workday.today,updatedAt:now};
}
export function advanceWorkday(state:PracticeState,command:Extract<Command,{type:'advanceWorkday'}>,now:string):void {
  if(!state.workday||!state.career)throw Error('Enable day-by-day mode first.');
  const w=state.workday;
  if(!validScenarioDate(command.date)||command.date<=w.today||command.date>workdayLimit(state.career.activeMonth))throw Error(`Choose a later PC date, up to ${workdayLimit(state.career.activeMonth)}. Close/release the accounting month before moving beyond its close window.`);
  if(typeof command.note!=='string'||command.note.length>2000||typeof command.acknowledgeOutstanding!=='boolean')throw Error('Invalid end-of-day note or acknowledgement.');
  const full=companyForState(state,false),tasks=dayTasks(state,true),open=tasks.filter(t=>t.release<=command.date&&!dayTaskStatus(t,state,full).complete);
  const outstanding=open.filter(t=>t.release<=w.today&&t.due<=w.today).map(t=>t.id);
  const missed=open.filter(t=>t.due>=w.today&&t.due<command.date).map(t=>t.id);
  if((outstanding.length||missed.length)&&!command.acknowledgeOutstanding)throw Error('Acknowledge the outstanding or skipped deadlines before advancing. The work remains open; nothing is completed for you.');
  w.history.push({from:w.today,to:command.date,at:now,note:command.note,outstanding,missed});
  if(w.history.length>450)throw Error('Daily history is full. Export this case before starting another.');
  w.today=command.date;
}
/** Apply to production commands as well as the UI; hiding a file is not a date boundary. */
export function assertWorkdayCommand(state:PracticeState,command:Command,full:PracticeCompany):void {
  if(!state.workday||!state.career)return;
  const today=state.workday.today,active=state.career.activeMonth;
  const checkDate=(date:string)=>{if(!validScenarioDate(date)||date>today)throw Error(`Future-dated actuals are not available on ${today}. Advance the PC date first; leave planned payments in your forecast.`);};
  const checkSource=(id:string|undefined)=>{if(id&&!sourceIsAvailable(full,state,id))throw Error(`Source ${id} has not arrived by ${today}.`);};
  const checkJournal=(j:Journal)=>{checkDate(j?.date);checkSource(j?.sourceId);};
  switch(command.type){
    case 'postJournal':checkJournal(command.journal);break;
    case 'captureSourceInvoice':checkJournal(command.journal);checkSource(command.documentId);break;
    case 'postDocument':checkDate(command.journal?.date);checkDate(command.document?.date);break;
    case 'importJournals':if(Array.isArray(command.journals))command.journals.forEach(checkJournal);break;
    case 'reverseJournal':case 'reverseJournalBatch':checkDate(command.date);break;
    case 'saveBalanceReconciliation':checkDate(command.reconciliation?.asOf);break;
    case 'allocateCredit':checkDate(command.allocation?.date);break;
    case 'matchBank':case 'unmatchBank':case 'matchBankBatch':{
      const ids=command.type==='matchBankBatch'?command.matches?.map(m=>m.bankId)??[]:[command.bankId];
      for(const id of ids){const row=full.bank.find(r=>r.id===id);if(!row||bankAvailableOn(row.date)>today)throw Error('This bank transaction has not arrived in the daily feed.');}break;
    }
    case 'applySolution':case 'reveal':{
      const ex=full.exercises.find(e=>e.id===command.exerciseId);
      if(ex?.expected.some(j=>journalAvailableOn(j,full,state)>today))throw Error('This worked source includes future activity. Work from today’s evidence; its full solution is unavailable until all supporting activity has arrived.');break;
    }
    case 'saveCareerSubmission':{
      const release=taskSchedule(command.submission?.taskId,command.submission?.month,state.career.startMonth).release;
      if(release>today)throw Error(`This formal reconciliation opens on ${release}. Use today’s assignment instead of a premature month-end answer.`);
      command.submission?.evidence?.forEach(checkSource);break;
    }
    case 'saveCareerForecast':if(closePackDate(command.forecast?.month)>today)throw Error('The formal month-end forecast opens with the close pack. Use a weekly cash working paper during the month.');command.forecast?.evidence?.forEach(checkSource);break;
    case 'submitMonthReview':case 'closeCareerMonth':
      if(today<closePackDate(active))throw Error(`The full month review opens on ${closePackDate(active)}, after the closing evidence arrives. Use Check today’s work before then.`);
      if(command.type==='closeCareerMonth'){const unfinished=daySummary(state).open.filter(x=>x.task.kind==='response');if(unfinished.length)throw Error(`Complete the ${unfinished.length} outstanding daily requests before closing. A blocker does not waive an assignment.`);}break;
    case 'markDesktopMailRead':if(!dayMail(state).some(m=>m.id===command.mailId))throw Error('This email has not arrived.');break;
  }
}
export function syncDayCompletions(state:PracticeState):void {
  if(!state.workday)return;
  const full=companyForState(state,false);
  for(const task of dayTasks(state)){if(dayTaskStatus(task,state,full).complete){const old=state.workday.completions[task.id];if(!old)state.workday.completions[task.id]={first:state.workday.today,latest:state.workday.today};}}
}
export function workdayShapeError(state:PracticeState):string|null {
  const w=state.workday;if(w===undefined)return null;
  const record=(v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v);
  if(!state.career||!w||w.version!==1||!validScenarioDate(w.today)||!validScenarioDate(w.enabledOn)||w.enabledOn<state.career.startMonth+'-01'||w.today<w.enabledOn||w.today<state.career.activeMonth+'-01'||w.today>workdayLimit(state.career.activeMonth)||!record(w.submissions)||!record(w.completions)||Object.keys(w.submissions).length>250||Object.keys(w.completions).length>2500||!Array.isArray(w.history)||w.history.length>450)return 'Invalid day-by-day state.';
  let previous=w.enabledOn;
  for(const h of w.history){if(!h||!validScenarioDate(h.from)||!validScenarioDate(h.to)||h.from<previous||h.to<=h.from||h.to>w.today||typeof h.at!=='string'||h.at.length>50||typeof h.note!=='string'||h.note.length>2000||!Array.isArray(h.outstanding)||!Array.isArray(h.missed)||[...h.outstanding,...h.missed].some(v=>typeof v!=='string'||v.length>180)||h.outstanding.length>200||h.missed.length>200)return 'Invalid simulated-date history.';previous=h.to;}
  const all=CAREER_MONTHS.filter(m=>m>=state.career!.startMonth&&m<=state.career!.activeMonth).flatMap(m=>dayTasks(state,true,m));
  const byId=new Map(all.map(t=>[t.id,t]));
  for(const [id,c] of Object.entries(w.completions)){const task=byId.get(id);if(!task||!c||!validScenarioDate(c.first)||!validScenarioDate(c.latest)||c.first<task.release||c.first>w.today||c.latest<c.first||c.latest>w.today)return 'Invalid daily completion history.';}
  for(const [id,s] of Object.entries(w.submissions)){
    const task=byId.get(id);if(!task||task.release>w.today||!s||s.taskId!==id||!validScenarioDate(s.submittedOn)||s.submittedOn<task.release||s.submittedOn>w.today)return 'Invalid saved daily assignment.';
    // Historical follow-up dates are allowed to become overdue; validate at the original submission date.
    const scoped={...state,workday:{...w,today:s.submittedOn}};
    const invalid=validateDailySubmission(s,task,scoped,true);if(invalid)return invalid;
  }
  if(state.journals.some(j=>j.date>w.today))return 'A saved journal is later than the PC date.';
  return null;
}
