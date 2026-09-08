import assert from 'node:assert/strict';
import {initialState,applyCommand,validateBackup,journalsFor,accountBalances,gradeExercise,profitAndLoss,bankReconciliation,invoiceJournalLines} from '../../lib/accounting/engine';
import {generateCompany} from '../../lib/accounting/generator';
import {companyForState,CAREER_MONTHS,careerKey} from '../../lib/accounting/career';
import {careerMetrics,careerTasks,careerLedgerDifferences,careerEvidenceChecks,blankForecast,forecastSchedule,validateCareerForecast,validateCareerSubmission} from '../../lib/accounting/career-work';
import {careerPortfolioHTML,careerForecastCSV} from '../../lib/accounting/career-exports';
import {leaseSchedule,inventorySchedule} from '../../lib/accounting/schedules';
import {statementReconciliations} from '../../lib/accounting/reconciliations';
import {financialReportData,financialNotes} from '../../lib/accounting/financial-notes';
import {financialStatementsHTML,sourcePack} from '../../lib/accounting/exports';
import {monthEnd,sum} from '../../lib/accounting/money';
import type {PracticeState,Journal} from '../../lib/accounting/types';
let checks=0;
const ok=(condition:unknown,message:string)=>{assert.ok(condition,message);checks++;};
const eq=(actual:unknown,expected:unknown,message:string)=>{assert.deepEqual(actual,expected,message);checks++;};
const rejects=(run:()=>unknown,pattern:RegExp,message:string)=>{assert.throws(run,pattern,message);checks++;};
const now='2026-09-07T10:30:00.000Z';
function start(month:string,seed=271828,role:'financial-accountant'|'financial-manager'='financial-manager',scenario:'supported'|'messy'='messy'){
 return applyCommand(initialState(seed),{type:'startCareer',seed,startMonth:month,role,scenario,confirmation:'START TAKEOVER'},now);
}
function postMonth(s:PracticeState){
 const c=companyForState(s),month=s.career!.activeMonth;
 const journals=c.exercises.filter(e=>e.expected[0].date.startsWith(month)).flatMap(e=>e.expected.map(j=>({...j,id:`ME-${j.id}`,exerciseId:undefined,origin:'learner' as const})));
 for(let i=0;i<journals.length;i+=200)s=applyCommand(s,{type:'importJournals',journals:journals.slice(i,i+200)},now);
 const matches=c.bank.filter(r=>r.date.startsWith(month)).map(r=>({bankId:r.id,journalIds:[`ME-${r.journalId}`]}));
 for(let i=0;i<matches.length;i+=150)s=applyCommand(s,{type:'matchBankBatch',matches:matches.slice(i,i+150)},now);
 return s;
}
function submitMonth(s:PracticeState){
 const c=companyForState(s),month=s.career!.activeMonth;
 if(s.career!.role==='financial-manager'){
  const forecast=blankForecast(month);forecast.weeks=forecast.weeks.map(w=>({...w,receipts:2000000,supplierPayments:700000,payroll:800000,overheads:100000}));
  forecast.status='submitted';forecast.evidence=[`CEO-${month}`];forecast.assumptions='Collections are based on named customer receipts and agreed timings. Supplier and payroll commitments use the period records; funding is not assumed unless approved.';
  forecast.actions='Monitor weekly reserve headroom, contact overdue debtors and obtain approval before changing payment timing or seeking new funding.';
  s=applyCommand(s,{type:'saveCareerForecast',forecast},now);
 }
 for(const task of careerTasks(c,s))s=applyCommand(s,{type:'saveCareerSubmission',submission:{month,taskId:task.id,status:'submitted',
  figures:Object.fromEntries(task.figures.map(f=>[f.id,f.expected])),responses:Object.fromEntries(task.responses.map(r=>[r.id,'Test fixture narrative: supporting facts, appropriate owner and dated follow-up actions are documented here for structural validation, not a professional quality score.'])),
  evidence:task.evidence.slice(0,2),updatedAt:''}},now);
 return s;
}

rejects(()=>applyCommand(initialState(),{type:'startCareer',seed:1,startMonth:'2025-07',role:'financial-manager',scenario:'messy',confirmation:''}),/confirm/,'Replacement requires confirmation');
for(const bad of ['2024-12','2026-01','2025-13','July'])rejects(()=>start(bad),/valid/,'Start month is bounded');
// Every start month preserves the ledger boundary and independently generated source bank.
for(const seed of [42,271828,123456])for(const month of CAREER_MONTHS){
 const s=start(month,seed),c=companyForState(s),legacy=generateCompany(seed);
 eq(validateBackup(s),null,`New ${month}/${seed} backup valid`);
 ok(c.baseJournals.every(j=>j.date<month+'-01'),'No live-month preposted journals');
 ok(c.bank.every(r=>r.date<=monthEnd(month)),'Future bank movements withheld');
 ok(c.documents.every(d=>d.date<=monthEnd(month)),'Future source documents withheld');
 ok(Object.keys(c.payroll).every(m=>m<=month),'Future payroll withheld');
 ok(c.assets.every(a=>a.purchaseDate<=monthEnd(month)),'Future assets withheld');
 eq(c.bank.map(r=>[r.id,r.date,r.amount,r.balance]),legacy.bank.filter(r=>r.date<=monthEnd(month)).map(r=>[r.id,r.date,r.amount,r.balance]),'Bank truth is unchanged');
 const bs=accountBalances(journalsFor(c,s));eq(sum(Object.values(bs)),0,'Inherited errors remain double entry');
 eq(c.baseJournals.filter(j=>j.id.startsWith('LEGACY-')).length,month==='2025-01'?0:3,'Messy handover has bounded planted errors');
 ok(c.exercises.length>25,'Month has substantive processing work');
 for(const e of c.exercises)for(const j of e.expected){
  ok(c.documents.some(d=>d.id===j.sourceId),'Each processing journal has available source evidence');
  eq(sum(j.lines.map(l=>l.debit-l.credit)),0,'Target journal balances');
 }
 if(month<'2025-07')eq(leaseSchedule(c).pv,0,'Unreleased lease cannot crash schedule');
 const future:Journal={id:'FUTURE',date:'2026-01-01',description:'Rejected future transaction',reference:'',module:'Test',lines:[{account:'1000',debit:100,credit:0},{account:'6990',debit:0,credit:100}]};
 rejects(()=>applyCommand(s,{type:'postJournal',journal:future}),/active month/,'Unreleased future posting blocked');
 const before=structuredClone(s);rejects(()=>applyCommand(s,{type:'closeCareerMonth',reason:'Close despite unfinished processing and missing supporting reports.'}),/Resolve before closing/,'Incomplete month cannot close');eq(s,before,'Failed close leaves input state untouched');
}
// Capture source invoice without creating another source document; coding errors can be practised, duplication cannot.
{
 let s=start('2025-07'),c=companyForState(s),d=c.documents.find(d=>d.kind==='Supplier invoice'&&d.date.startsWith('2025-07'))!;
 const j:Journal={id:'CAPTURE-ONE',date:d.date,description:'Capture supplier source',reference:d.id,sourceId:d.id,module:'Purchases',lines:invoiceJournalLines({...d,journalIds:['CAPTURE-ONE']},c)};
 s=applyCommand(s,{type:'captureSourceInvoice',documentId:d.id,journal:j});eq(s.customDocuments.length,0,'Source capture preserves immutable evidence');eq(s.journals.length,1,'Capture posts the accounting entry');
 rejects(()=>applyCommand(s,{type:'captureSourceInvoice',documentId:d.id,journal:{...j,id:'CAPTURE-TWO'}}),/already recorded/,'Duplicate source capture blocked');
 s=applyCommand(s,{type:'reverseJournal',journalId:j.id,date:j.date,reason:'Correct capture classification'});
 s=applyCommand(s,{type:'captureSourceInvoice',documentId:d.id,journal:{...j,id:'REPLACEMENT'}});eq(validateBackup(s),null,'Reversal and replacement capture validates');
}
// Creating additional invoices remains atomic and portable in takeover mode.
{
 const original=start('2025-07'),c=companyForState(original),source=c.documents.find(d=>d.kind==='Supplier invoice'&&d.date.startsWith('2025-07'))!;
 const d={...structuredClone(source),id:'EXTRA-PI-001',journalIds:['EXTRA-J-001']};
 const j:Journal={id:'EXTRA-J-001',date:d.date,description:'Additional supplier invoice practice',reference:d.id,sourceId:d.id,module:'Purchases',lines:invoiceJournalLines(d,c)};
 const s=applyCommand(original,{type:'postDocument',document:d,journal:j});
 eq(s.customDocuments.length,1,'Additional source created in takeover');eq(validateBackup(s),null,'Additional invoice can be backed up');
 eq(original.customDocuments.length,0,'Invoice command does not mutate prior state');
 ok(careerLedgerDifferences(companyForState(s),s).length>0,'Extra practice is not silently accepted as canonical processing');
 rejects(()=>applyCommand(original,{type:'postDocument',document:d,journal:{...j,date:'2025-08-01'}}),/dates and references/,'Source mismatch rejected atomically');
 eq(original.customDocuments.length,0,'Rejected creation retains original document list');
}
// Carry a complete professional-manager case through all 12 months, checking source stability and all reports.
for(const seed of [42,271828]){
 let s=start('2025-01',seed),journalCount=0;const sourceIds=new Map<string,string|undefined>(),sourceSnapshots=new Map<string,string>();
 for(const month of CAREER_MONTHS){
  let c=companyForState(s);
  for(const d of c.documents){const snapshot=JSON.stringify(d);if(sourceSnapshots.has(d.id))eq(snapshot,sourceSnapshots.get(d.id),'Releasing future months does not rewrite earlier source documents');sourceSnapshots.set(d.id,snapshot);}
  for(const j of c.solutionJournals){if(sourceIds.has(j.id))eq(j.sourceId,sourceIds.get(j.id),'Releasing next month never changes historical source IDs');sourceIds.set(j.id,j.sourceId);}
  s=postMonth(s);c=companyForState(s);
  eq(careerLedgerDifferences(c,s),[],`All ${month} source effects agree without exercise tags`);
  for(const e of c.exercises)ok(gradeExercise(e,s).correct,'Natural source-linked posting satisfies the work unit');
  const metrics=careerMetrics(c,s,month),pl=profitAndLoss(journalsFor(c,s),month+'-01',monthEnd(month));
  eq(metrics.profitBeforeTax,pl.profitBeforeTax,'Management PBT agrees to ledger report');eq(metrics.revenue,pl.revenue,'Management revenue agrees to ledger report');
  eq(metrics.assets-metrics.liabilities-metrics.equity,0,'Management statement balances');
  const b=accountBalances(journalsFor(c,s),undefined,monthEnd(month)),truth=accountBalances([generateCompany(seed).opening,...generateCompany(seed).solutionJournals],undefined,monthEnd(month));eq(b,truth,'Solved monthly balances agree to original independent complete scenario');
  eq(bankReconciliation(c,s,month).complete,true,'Monthly bank reconciliation completed');
  for(const kind of ['customer','supplier'] as const)for(const rec of statementReconciliations(c,s,kind,monthEnd(month))){eq(rec.difference,0,`Independent ${kind} statement total agrees in ${month}`);eq(rec.componentDifference,0,`Independent ${kind} open items agree in ${month}`);}
  const stock=inventorySchedule(c,s,monthEnd(month));eq(sum(stock.map(r=>r.netValue)),b['1200']+b['1210'],'Stock valuation agrees at the selected month end');
  eq(financialReportData(c,s).to,monthEnd(month),'Direct report export defaults to the active month');
  if(month!=='2025-12')eq(financialNotes(c,s),[],'Interim report does not invent year-end notes');
  ok(financialStatementsHTML(c,s).includes(monthEnd(month)),'Report HTML includes the active cut-off');
  s=submitMonth(s);c=companyForState(s);eq(careerEvidenceChecks(c,s).filter(g=>g.remaining!==0),[],'All close gates pass after processing and substantive submissions');
  eq(validateBackup(s),null,'Pre-close full backup remains valid');
  s=applyCommand(s,{type:'closeCareerMonth',reason:'Monthly figures and source processing reconciled. Written judgements and AFS evidence gaps retain explicit owners.'},now);
  eq(validateBackup(s),null,'Closed backup is revalidated');ok(s.journals.length>journalCount,'Next month adds, never replaces learner history');journalCount=s.journals.length;
  const original=s.journals.find(j=>j.date.startsWith(month))!;
  rejects(()=>applyCommand(s,{type:'postJournal',journal:{...original,id:'LOCKED'}}),/active month/,'Closed month rejects new postings');
  rejects(()=>applyCommand(s,{type:'lockPeriod',locked:false,reason:'Legacy lock bypass attempt'}),/takeover month-end gates/,'Legacy lock cannot bypass takeover locks');
  if(month!=='2025-12')s=applyCommand(s,{type:'advanceCareerMonth'},now);
 }
 const c=companyForState(s),html=careerPortfolioHTML(c,s);ok(html.includes('2025-01')&&html.includes('2025-12'),'Portfolio spans the full completed career');ok(!html.includes('NaN'),'Portfolio has no invalid output');
 ok(careerForecastCSV(c,s,'2025-12').includes('Stress closing AUD'),'Forecast export includes stress scenario');
 ok(JSON.stringify(s).length<1_500_000,'Full year of realistic-length written work fits persistent-state limit');
 const tampered=structuredClone(s);tampered.journals.pop();ok(validateBackup(tampered)!==null,'Forged completed backup missing a journal is rejected');
 rejects(()=>applyCommand(s,{type:'advanceCareerMonth'}),/complete/,'No fictional 2026 continuation promised');
 console.log(`Full-year seed ${seed}: ${s.journals.length} learner journals; ${Object.keys(s.career!.submissions).length} deliverables; ${JSON.stringify(s).length} serialized characters.`);
}
// Midyear inherited cleanup and anti-stale controls.
{
 let s=start('2025-07');s=postMonth(s);s=submitMonth(s);let c=companyForState(s);
 const actual=accountBalances(journalsFor(c,s)),truth=accountBalances([generateCompany().opening,...generateCompany().solutionJournals],undefined,'2025-07-31');
 eq(actual,truth,'Three inherited errors are exactly corrected without rewriting history');
 const original=s.journals.find(j=>j.date.startsWith('2025-07')&&!j.lines.some(l=>l.account==='1000'))!;
 s=applyCommand(s,{type:'reverseJournal',journalId:original.id,date:original.date,reason:'Need to reclassify current-month invoice'});
 ok(Object.values(s.career!.submissions).every(v=>v.status==='draft'),'New posting reopens all current submissions');eq(s.career!.forecasts['2025-07'].status,'draft','New posting invalidates forecast submission');
 ok(careerLedgerDifferences(c,s).length>0,'Reversing a required entry reopens source completeness');
 const invalid=structuredClone(s);invalid.career!.activeMonth='2025-09';ok(validateBackup(invalid)!==null,'Backup cannot skip unclosed months');
}
// Stress timing, signed cash, malformed money and narrative limitations.
{
 const s=start('2025-07'),c=companyForState(s),f=blankForecast('2025-07');f.weeks[0].receipts=10000;f.weeks[0].supplierPayments=15000;
 const b=forecastSchedule(100000,f),stress=forecastSchedule(100000,f,true);
 eq(b[0].closing,95000,'Base flow arithmetic');eq(stress[0].closing,85000,'Delayed receipt absent in first stress week');eq(stress[2].receipts,8500,'85 percent receipt appears two weeks later');
 eq(stress[0].date,'2025-08-01','Forecast begins after close');eq(stress[12].date,'2025-10-24','Thirteen dated weekly starts');
 f.weeks[0].receipts=0.5;ok(validateCareerForecast(c,s,f)!==null,'Fractional-cent forecast blocked');
 const t=careerTasks(c,s)[0],v={month:'2025-07',taskId:t.id,status:'submitted' as const,figures:{},responses:{},evidence:[],updatedAt:''};
 ok(validateCareerSubmission(c,s,v)!==null,'Empty tick-box submission cannot pass');
 const bad=structuredClone(s);(bad.career!.submissions as unknown as Record<string,unknown>)['2025-07|evil']={taskId:'evil',month:'2025-07'};ok(validateBackup(bad)!==null,'Malformed role submissions cannot be imported');
 const injected=structuredClone(s);injected.career!.submissions[careerKey('2025-07',t.id)]={...v,status:'draft',responses:{[t.responses[0].id]:'<script>alert(1)</script>'}};
 const html=careerPortfolioHTML(c,injected);ok(!html.includes('<script>alert(1)</script>')&&html.includes('&lt;script&gt;'),'Portfolio escapes user narratives');
}
console.log(`PASS: ${checks.toLocaleString()} takeover, source-boundary, full-year progression, forecast, capture, backup and close-control assertions.`);
console.log('Qualitative management judgement is not scored. These are domain tests, not React/browser or hosted deployment verification.');
