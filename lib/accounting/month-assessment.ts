import {daySummary} from './workday';
import {closePackDate} from './workday-calendar';
/** Independent, read-only month assessment. No postings, answer application, ticking or closing. */
import {ACCOUNTS, ACCOUNT_MAP} from './accounts';
import {companyForState,careerKey, CAREER_MONTHS} from './career';
import {careerSignature, careerMetrics, careerTasks, careerEvidenceChecks, validateCareerForecast, careerBankMatchIssues} from './career-work';
import {monthEnd, sum} from './money';
import type {PracticeCompany, PracticeState, Journal} from './types';
import type {MonthAssessment, MonthCheck, ReviewDifference, MonthReviewReceipt} from './month-review-types';

const record = (v:unknown):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
/** Stable content stamp, not a cryptographic signature or security control. */
function canonical(v:unknown):string {
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().filter(k=>(v as Record<string,unknown>)[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(v)??'null';
}
export function assessmentFingerprint(state:PracticeState):string {
  const month=state.career?.activeMonth??'';
  const relevant={version:1,seed:state.seed,career:state.career?{startMonth:state.career.startMonth,activeMonth:month,role:state.career.role,scenario:state.career.scenario,startedAt:state.career.startedAt,submissions:state.career.submissions,forecasts:state.career.forecasts}:null,
    journals:state.journals,bankMatches:state.bankMatches,allocations:state.allocations,disclosures:state.disclosures,evidenceRequests:state.evidenceRequests,balanceReconciliations:state.balanceReconciliations,workpapers:state.workpapers,customDocuments:state.customDocuments,
    files:state.desktop?.files??[],notes:state.notes,...(state.workday?{dailyResponses:state.workday.submissions}: {})};
  const text=canonical(relevant);let a=2166136261,b=5381;
  for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}
  return `${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}-${text.length}`;
}
const mismatch=(actual:number|null,expected:number,label:string):ReviewDifference=>({label,actual,expected,difference:actual===null?null:actual-expected});
function groups(journals:Journal[]):Map<string,Journal[]> {
  const result=new Map<string,Journal[]>();
  for(const j of journals){const key=`${j.date.slice(0,7)}|${j.sourceId??'(no source)'}`;result.set(key,[...(result.get(key)??[]),j]);}
  return result;
}
export function assessMonth(company:PracticeCompany,state:PracticeState):MonthAssessment {
  if(!state.career)throw new Error('Start a finance takeover before checking a month.');
  if(state.workday){if(state.workday.today<closePackDate(state.career.activeMonth))throw Error('Full month review opens on '+closePackDate(state.career.activeMonth)+'. Check today’s work instead.');company=companyForState(state,false);}
  const month=state.career.activeMonth,start=state.career.startMonth+'-01',end=monthEnd(month),checks:MonthCheck[]=[];
  const add=(c:MonthCheck)=>checks.push(c);
  if(state.workday)for(const {task,status} of daySummary(state).tasks.filter(x=>x.task.kind==='response'))add({id:'daily:'+task.id,area:'Daily management requests',title:task.title,status:status.complete?'pass':status.state==='Needs correction'?'incorrect':'missing',blocking:true,explanation:status.detail,action:'Open Today → My tasks and submit or correct this response. A recorded blocker does not waive the request.',sourceIds:task.evidence,view:'daily',differences:status.differences.map(d=>mismatch(d.actual,d.expected,d.label))});
  const expected=groups(company.solutionJournals.filter(j=>j.date>=start&&j.date<=end)),actual=groups(state.journals.filter(j=>j.date>=start&&j.date<=end));
  for(const key of [...new Set([...expected.keys(),...actual.keys()])].sort()){
    const [period,source]=[key.slice(0,7),key.slice(8)],es=careerSignature(expected.get(key)??[]),as=careerSignature(actual.get(key)??[]);
    const differences:ReviewDifference[]=[];
    for(const k of [...new Set([...Object.keys(es),...Object.keys(as)])].sort())if((es[k]??0)!==(as[k]??0)){
      const [date,,account,contact,cashClass]=k.split('|');
      differences.push({...mismatch(as[k]??0,es[k]??0,`${account} ${ACCOUNT_MAP[account]?.name??'Unknown account'}`),date,account,contact,cashClass});
    }
    // Closed history is not counted again, but any historical exception remains visible.
    if(period!==month&&!differences.length)continue;
    const doc=[...company.documents,...state.customDocuments].find(d=>d.id===source);
    const missing=Object.keys(as).length===0&&Object.keys(es).length>0;
    add({id:'source:'+key,area:'Source processing',title:`${source} · ${doc?.title??'Unlinked or additional postings'}`,status:differences.length?(missing?'missing':'incorrect'):'pass',blocking:true,
      explanation:!differences.length?'Net postings agree by date, source, account, counterparty and cash-flow classification.':missing?'No net posting remains for this required source work. Opening a document or saving a workbook does not process it.':'The net source-linked postings differ from the case. A balancing entry in another account, period or source does not fix the underlying error.',
      action:differences.length?'Open the evidence and ledger detail. Check missing/duplicate invoices, settlements, dates, coding, contacts and source links. Correct the net differences; retain originals and use reversals where needed. A displayed adjustment is a net correction, not an instruction to post an unbalanced line.':'No source-posting correction identified.',sourceIds:source==='(no source)'?[]:[source],view:'ledger',differences});
  }
  const learner=careerMetrics(company,state,month),truth=careerMetrics(company,state,month,true);
  for(const a of ACCOUNTS){const av=learner.balances[a.code]??0,ev=truth.balances[a.code]??0;if(!av&&!ev)continue;
    add({id:'balance:'+a.code,area:'Balances and reporting',title:`${a.code} · ${a.name}`,status:av===ev?'pass':'incorrect',blocking:true,
      explanation:av===ev?'Closing balance agrees to the independent case.':'Closing balance does not agree to the independent case, even if the trial balance itself balances.',action:av===ev?'No closing-balance difference identified.':'Use the source-processing differences to investigate the cause. Do not post a plug solely to force this balance.',sourceIds:[],view:'reports',differences:av===ev?[]:[mismatch(av,ev,'Closing debit / (credit) balance')]});
  }
  const metrics:[keyof typeof learner,string][]=[['revenue','Monthly revenue'],['grossProfit','Monthly gross profit'],['profitBeforeTax','Monthly profit before tax'],['annualProfit','Year-to-date profit'],['assets','Total assets'],['liabilities','Total liabilities'],['equity','Total equity']];
  for(const [key,label] of metrics){const av=learner[key] as number,ev=truth[key] as number;add({id:'report:'+key,area:'Balances and reporting',title:label,status:av===ev?'pass':'incorrect',blocking:true,explanation:'Calculated from posted books, compared with the independent scenario, not your own submitted figure.',action:av===ev?'No report difference identified.':'Correct the underlying postings, regenerate the report and update any snapshot workbooks.',sourceIds:[],view:'reports',differences:av===ev?[]:[mismatch(av,ev,label)]});}
  const bankProblems=careerBankMatchIssues(company,state);
  for(const row of company.bank.filter(r=>r.date.startsWith(month))){const matched=state.bankMatches[row.id],bad=bankProblems.find(p=>p.bankId===row.id);
    add({id:'bank:'+row.id,area:'Bank reconciliation',title:`${row.date} · ${row.reference} · ${row.description}`,status:!matched?'missing':bad?'incorrect':'pass',blocking:true,
      explanation:!matched?'This bank-statement line has not been matched.':bad?bad.detail:'Matched cash-book posting agrees with this statement line and its expected source transaction.',action:!matched?'Post any missing cash-book entry, then match it to this statement line.':bad?'Unmatch this line and select the correct source transaction. Equal amounts alone do not prove a match.':'No matching difference identified.',sourceIds:[`BANK-${month}`],view:'bank',differences:!matched?[mismatch(null,row.amount,'Bank statement receipt / (payment)')]:[]});
  }
  for(const gate of careerEvidenceChecks(company,state).filter(g=>['tb','bank'].includes(g.id))){add({id:'control:'+gate.id,area:gate.id==='tb'?'Balances and reporting':'Bank reconciliation',title:gate.label,status:gate.remaining?'incorrect':'pass',blocking:true,explanation:gate.detail,action:gate.remaining?'Resolve the detailed exceptions in this report and rerun the check.':'Control passes.',sourceIds:[],view:gate.id==='bank'?'bank':'ledger',differences:[]});}
  for(const task of careerTasks(company,state,month)){
    const s=state.career.submissions[careerKey(month,task.id)],status=s?.status;
    add({id:`task:${task.id}:submission`,area:'Deliverables and reconciliations',title:task.title,status:status==='submitted'?'pass':'missing',blocking:true,explanation:status==='submitted'?'Formal deliverable submitted. Quantitative fields are checked separately; professional judgement is not automatically endorsed.':status==='draft'?'A draft exists, but has not been submitted or was reopened after changes.':'Required deliverable has not been started.',action:status==='submitted'?'Review any field exceptions below.':'Prepare, save and submit this deliverable on the finance desk.',sourceIds:task.evidence,view:'career',differences:[]});
    for(const f of task.figures){const av=s?.figures[f.id]??null;
      add({id:`task:${task.id}:figure:${f.id}`,area:'Deliverables and reconciliations',title:`${task.title} · ${f.label}`,status:av===null?'missing':av===f.expected?'pass':'incorrect',blocking:true,explanation:'Saved figure is checked against independent source evidence. Unsaved form or workbook edits are not submissions.',action:av===f.expected?'Numerical field agrees.':'Reconcile the supporting evidence and update this field. Copying a wrong ledger figure will not satisfy the check.',sourceIds:task.evidence,view:'career',differences:av===f.expected?[]:[mismatch(av,f.expected,f.label)]});
    }
    for(const r of task.responses){const present=(s?.responses[r.id]??'').trim().length>=60;
      add({id:`task:${task.id}:response:${r.id}`,area:'Deliverables and reconciliations',title:`${task.title} · ${r.label}`,status:present?'pass':'missing',blocking:true,explanation:present?'Explanation supplied. This is a completion check only, not a judgement-quality score.':'A substantive explanation is required (at least 60 characters).',action:present?'Retain for human review.':r.guidance,sourceIds:task.evidence,view:'career',differences:[]});
    }
    const evidence=s?.evidence??[],valid=evidence.length>=Math.min(2,task.evidence.length)&&evidence.some(id=>task.evidence.includes(id));
    add({id:`task:${task.id}:evidence`,area:'Deliverables and reconciliations',title:`${task.title} · Evidence links`,status:valid?'pass':'missing',blocking:true,explanation:valid?'Required evidence-link completion check passes. It does not prove that your explanation correctly interprets the evidence.':'Relevant supporting document references are missing or insufficient.',action:valid?'Retain support for review.':'Link the relevant case documents in the deliverable before submitting.',sourceIds:task.evidence,view:'career',differences:[]});
  }
  if(state.career.role==='financial-manager'){
    const forecast=state.career.forecasts[month],problem=forecast?validateCareerForecast(company,state,{...forecast,status:'submitted'}):'No saved forecast.';
    add({id:'forecast:submission',area:'Cash forecasting',title:'13-week cash forecast',status:!forecast||forecast.status!=='submitted'?'missing':problem?'incorrect':'pass',blocking:true,
      explanation:problem??'Submission and structure checks pass. Forecast realism and judgement are not automatically graded.',action:!forecast||forecast.status!=='submitted'||problem?'Complete all 13 weeks, relevant receipts and payments, evidence, assumptions and action plan; submit the forecast.':'Have the assumptions, funding and stress-response recommendations reviewed.',sourceIds:[`CEO-${month}`],view:'career',differences:[]});
  }
  for(const r of Object.values(state.balanceReconciliations??{}).filter(r=>r.asOf===end)){
    const normal=ACCOUNT_MAP[r.account]?.normal==='credit'?-1:1,av=sum(r.items.map(i=>i.amount)),ev=(truth.balances[r.account]??0)*normal;
    add({id:'support:'+r.account,area:'Supporting work',title:`${r.account} · Saved balance reconciliation`,status:av===ev?'pass':'warning',blocking:false,explanation:'Saved reconciliation components are compared to the independent closing balance. Item-level explanation and evidence quality require review.',action:av===ev?'Review component validity and sign-off.':'Investigate the supporting components and ledger. Do not force a reconciliation with an unexplained balancing item.',sourceIds:r.items.map(i=>i.documentId).filter((id):id is string=>!!id),view:'close',differences:av===ev?[]:[mismatch(av,ev,'Supporting balance in account normal sign')]});
  }
  const manual:[string,string,string][]=[
    ['judgement','Written recommendations and estimates','Explanations, provisions, assumptions and business recommendations need professional review. Completion checks are not a quality assessment.'],
    ['workbooks','Freeform Excel working papers','Saving or creating a workbook does not submit its cells for accounting grading. Submit the formal deliverable figures. Arbitrary workbook formulas, hardcoded answers, missing schedules and explanations are not independently verified by this month checker.'],
    ['afs','AFS completeness and approvals','This case does not contain all comparative, disclosure, subsequent-events and authorisation evidence needed for complete statutory AFS. Passing automated checks is not AFS approval.'],
  ];
  if(state.career.role==='financial-manager')manual.push(['forecast','Forecast realism and management decisions','The cash forecast is checked for required structure and inputs, not whether assumptions or recommendations are commercially sound.']);
  for(const [id,title,explanation] of manual)add({id:'manual:'+id,area:'Requires professional review',title,status:'manual',blocking:false,explanation,action:'Retain the supporting work and obtain a substantive review. This item is not awarded an automatic correctness score.',sourceIds:[],view:id==='workbooks'?'close':id==='afs'?'reports':'career',differences:[]});
  const graded=checks.filter(c=>c.blocking),blockers=graded.filter(c=>c.status!=='pass').length;
  return {version:1,month,fingerprint:assessmentFingerprint(state),checks,passed:graded.length-blockers,total:graded.length,blockers,warnings:checks.filter(c=>c.status==='warning').length,manual:checks.filter(c=>c.status==='manual').length,ready:blockers===0};
}
export function reviewReceiptsError(value:unknown,state:PracticeState):string|null {
  if(value===undefined)return null;
  if(!state.career||!Array.isArray(value)||value.length>24)return 'Month review history is invalid (24 retained attempts maximum).';
  const ids=new Set<string>();
  for(const raw of value){if(!record(raw))return 'Month review receipt is invalid.';const v=raw as unknown as MonthReviewReceipt;
    if(typeof v.id!=='string'||!/^MR-[a-zA-Z0-9-]{1,100}$/.test(v.id)||ids.has(v.id)||typeof v.month!=='string'||!CAREER_MONTHS.includes(v.month)||v.month<state.career.startMonth||v.month>state.career.activeMonth||typeof v.at!=='string'||v.at.length>50||!Number.isFinite(Date.parse(v.at))||typeof v.fingerprint!=='string'||!/^\w{16}-\d{1,9}$/.test(v.fingerprint)||typeof v.feedbackRevealed!=='boolean'||['passed','total','blockers','warnings','manual'].some(k=>!Number.isSafeInteger(raw[k])||(raw[k] as number)<0||(raw[k] as number)>10000)||v.total!==v.passed+v.blockers||!Array.isArray(v.issueIds)||v.issueIds.length>2000||v.issueIds.some(k=>typeof k!=='string'||k.length>350)||new Set(v.issueIds).size!==v.issueIds.length||v.issueIds.length!==v.blockers+v.warnings)return 'Month review receipt contains invalid totals or references.';
    ids.add(v.id);
  }
  return null;
}
