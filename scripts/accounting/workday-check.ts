/** Day-by-day domain acceptance tests. Answer-based fixtures are test data, never auto-posted by the workstation. */
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {initialState,applyCommand,validateBackup,journalsFor} from '../../lib/accounting/engine';
import {companyForState,CAREER_MONTHS} from '../../lib/accounting/career';
import {dayTasks,daySummary,dayMail,dayTaskStatus,workdayEnableDate} from '../../lib/accounting/workday';
import {addBusinessDays,businessDay,closePackDate,bankAvailableOn,documentAvailableOn,journalAvailableOn,sourceIsAvailable,validScenarioDate,workdayLimit} from '../../lib/accounting/workday-calendar';
import {careerTasks,blankForecast} from '../../lib/accounting/career-work';
import {assessMonth,assessmentFingerprint} from '../../lib/accounting/month-assessment';
import {virtualFiles,filePayload,createWorkingFile} from '../../lib/desktop/files';
import {bankCSV,payrollCSV} from '../../lib/accounting/exports';
import {monthEnd,addDays} from '../../lib/accounting/money';
import type {PracticeState,Command} from '../../lib/accounting/types';
import type {DayTask,DailySubmission} from '../../lib/accounting/workday-types';
let checks=0;const NOW='2026-09-07T12:30:00.000Z';
function ok(v:unknown,label:string){assert.ok(v,label);checks++;}
function eq(a:unknown,b:unknown,label:string){assert.deepEqual(a,b,label);checks++;}
function rejects(s:PracticeState,command:Command,pattern:RegExp,label:string){const snapshot=JSON.stringify(s);assert.throws(()=>applyCommand(s,command,NOW),pattern,label);eq(JSON.stringify(s),snapshot,label+' is atomic');checks++;}
function start(month='2025-07',seed=271828,daily=true,role:'financial-accountant'|'financial-manager'='financial-manager'){return applyCommand(initialState(seed),{type:'startCareer',seed,startMonth:month,role,scenario:'messy',daily,confirmation:'START TAKEOVER'},NOW);}
function advance(s:PracticeState,date:string){return applyCommand(s,{type:'advanceWorkday',date,note:'Fixture: retain all unfinished work and inspect newly arrived records.',acknowledgeOutstanding:true},NOW);}
function response(t:DayTask,status:DailySubmission['status']='submitted'):DailySubmission{return {taskId:t.id,status,figures:Object.fromEntries(t.figures.map(f=>[f.id,f.expected])),decision:t.correctDecision??'',note:'Test fixture: reconcile the independent source evidence, record the findings and the responsible owner, and send the recommendation for separate review. This text is not a human judgement assessment.',evidence:t.evidence.slice(0,2),blocker:'',owner:'',followUp:'',updatedAt:''};}
function respond(s:PracticeState,t:DayTask,r=response(t)){return applyCommand(s,{type:'saveDailySubmission',submission:r},NOW);}
const fresh=start(),full=companyForState(fresh,false),before=JSON.stringify(fresh);
eq(fresh.workday?.today,'2025-07-01','New takeover begins on first of chosen month');eq(validateBackup(fresh),null,'New daily state is a valid backup');
eq(daySummary(fresh).next?.task.id,'2025-07-welcome','First recommended action is onboarding');eq(dayTasks(fresh).length,6,'First day is a small six-task queue, not the entire month');
ok(dayMail(fresh).some(m=>m.id==='MAIL-WELCOME'&&m.attachments.includes('HANDOVER')),'Onboarding email includes actionable evidence');
eq(JSON.stringify(fresh),before,'Read-only task/mail generation does not mutate saved state');
ok(!companyForState(fresh).payroll['2025-07'],'Current payroll is hidden before pre-payment review');ok(companyForState(fresh).payroll['2025-06'],'Inherited payroll archive stays visible');
eq(companyForState(fresh).bank.filter(r=>r.date.startsWith('2025-07')).length,0,'No bank feed before next-day delivery');
const bankDay1=companyForState(fresh).documents.find(d=>d.id==='BANK-2025-07')!;eq(bankDay1.metadata?.partial,1,'First-day bank document is explicitly partial');ok(bankDay1.total!==full.documents.find(d=>d.id===bankDay1.id)!.total,'Partial extract does not disclose final bank balance');
const m={state:fresh,company:companyForState(fresh),journals:journalsFor(companyForState(fresh),fresh),displayName:'Test',saving:false,saveStatus:'Saved',error:'',generation:0};
ok(!virtualFiles(m).some(f=>f.id==='LIVE:payroll:2025-07'),'Explorer does not offer a future payroll export');ok(!payrollCSV(m.company,'2025-07').includes('Alex'),'Payroll CSV cannot expose unreleased register');
const invoice=full.documents.find(d=>d.kind==='Supplier invoice'&&d.date.startsWith('2025-07'))!,invoiceEntry=full.solutionJournals.find(j=>j.sourceId===invoice.id&&j.date===invoice.date)!;
rejects(fresh,{type:'postJournal',journal:{...invoiceEntry,id:'EARLY'}},/Future-dated|has not arrived/,'Future source entry blocked');
rejects(fresh,{type:'submitMonthReview'},/opens/,'Month answer submission blocked before close pack');
rejects(fresh,{type:'closeCareerMonth',reason:'Ready to close'},/opens/,'Close blocked before close pack');
assert.throws(()=>assessMonth(m.company,fresh),/opens/);checks++;
rejects(fresh,{type:'advanceWorkday',date:'2025-07-02',note:'',acknowledgeOutstanding:false},/Acknowledge/,'Cannot silently cross the first-day deadline');
for(const date of ['2025-07-01','2025-06-30','2025-02-30','2025-08-30','abc'])rejects(fresh,{type:'advanceWorkday',date,note:'',acknowledgeOutstanding:true},/later PC date/,'Invalid/backward/out-of-window date '+date);
eq(bankAvailableOn('2025-07-04'),'2025-07-07','Friday bank feed arrives Monday');eq(closePackDate('2025-08'),'2025-09-01','Sunday month-end releases Monday');eq(closePackDate('2025-12'),'2026-01-01','December can close in following calendar year under no-holiday simulation');ok(!validScenarioDate('2025-02-29'),'Invalid leap day rejected');
const welcome=dayTasks(fresh).find(t=>t.id.endsWith('welcome'))!,correct=response(welcome),wrong={...correct,figures:{bank:1}};
let s=respond(fresh,welcome,wrong);eq(dayTaskStatus(welcome,s).state,'Needs correction','Incorrect submitted amount receives feedback, not false completion');eq(s.journals.length,0,'Submitting response does not post');
s=respond(s,welcome,correct);eq(dayTaskStatus(welcome,s).state,'Complete','Correct first-day response completes defined checks');eq(s.workday!.completions[welcome.id].first,'2025-07-01','Completion records scenario date, not wall clock');
rejects(fresh,{type:'saveDailySubmission',submission:{...correct,evidence:[]}},/evidence/,'Submission requires relevant evidence');
rejects(fresh,{type:'saveDailySubmission',submission:{...correct,note:'Done'}},/80 characters/,'One-word submission cannot complete professional response');
rejects(fresh,{type:'saveDailySubmission',submission:response(dayTasks(fresh,true).find(t=>t.id.endsWith('payroll-release'))!)},/not arrived/,'Unreleased management response blocked');
const firstHistory=JSON.stringify(s.journals);s=advance(s,'2025-07-04');eq(JSON.stringify(s.journals),firstHistory,'Date jump never auto-processes journals');ok(s.workday!.history[0].missed.length>0,'Crossed unfinished deadlines retained');
ok(dayMail(s).some(m=>m.category==='Reply'&&m.taskId===welcome.id),'Submitted response receives later acknowledgement');
ok(!dayMail(s).some(m=>m.category==='Escalation'&&m.taskId===welcome.id),'Timely completed onboarding does not get late escalation');
ok(companyForState(s).documents.some(d=>d.id===invoice.id),'Supplier invoice arrives one working day after issue');
s=applyCommand(s,{type:'postJournal',journal:{...invoiceEntry,id:'ME-'+invoiceEntry.id}},NOW);ok(s.journals.some(j=>j.date===invoice.date),'Arrived source posts using original accounting date');
const invTask=dayTasks(s).find(t=>t.kind==='processing'&&t.sourceId===invoice.id&&t.effectiveDate===invoice.date)!;eq(dayTaskStatus(invTask,s).state,'Complete','Future settlement is not counted missing on invoice task');
const futureCash=full.bank.find(b=>b.date>'2025-07-04')!;rejects(s,{type:'matchBank',bankId:futureCash.id,journalIds:['unavailable']},/not arrived/,'Unreceived bank movement cannot be matched');
s=advance(s,'2025-07-14');const bankChange=dayTasks(s).find(t=>t.id.endsWith('bank-change'))!;s=respond(s,bankChange,{...response(bankChange),decision:'release'});eq(dayTaskStatus(bankChange,s).state,'Needs correction','Urgency does not bypass bank-detail verification');s=respond(s,bankChange);s=advance(s,'2025-07-15');
ok(dayMail(s).find(m=>m.id==='MAIL-REPLY-'+bankChange.id)?.body.some(v=>v.includes('have not changed')),'Trusted-channel hold gets explicit simulated callback result');
const blockedTask=dayTasks(s).find(t=>t.id.endsWith('-records'))!,blocked={...response(blockedTask,'blocked'),blocker:'Signed comparative financial statements still absent.',owner:'Helen Moore',followUp:'2025-07-16'};s=respond(s,blockedTask,blocked);eq(dayTaskStatus(blockedTask,s).state,'Waiting','Blocker is distinct from completion');s=advance(s,'2025-07-23');eq(validateBackup(s),null,'Past follow-up dates remain valid saved history');
ok(companyForState(s).documents.some(d=>d.id==='PAY-2025-07'),'Payroll register available before pay date');ok(companyForState(s).payroll['2025-07'].length>0,'Pre-payment payroll screen receives authorised data');
const p=dayTasks(s).find(t=>t.id.endsWith('payroll-release'))!;s=respond(s,p);eq(dayTaskStatus(p,s).state,'Complete','Payroll pre-payment review can be completed before pay date');
const payrollEntry=full.solutionJournals.find(j=>j.sourceId==='PAY-2025-07')!;rejects(s,{type:'postJournal',journal:{...payrollEntry,id:'PAY-EARLY'}},/Future-dated/,'Early payroll evidence does not authorise future actual posting');
for(const day of ['2025-07-01','2025-07-04','2025-07-14','2025-07-23','2025-07-31','2025-08-01']){
 const at={...fresh,workday:{...fresh.workday!,today:day}},visible=companyForState(at);
 for(const d of visible.documents)ok(documentAvailableOn(d,at)<=day,'Visible document arrival does not exceed PC date: '+d.id);
 for(const row of visible.bank)ok(row.date<'2025-07-01'||bankAvailableOn(row.date)<=day,'Visible bank record obeys next-day boundary');
 for(const t of dayTasks(at))ok(t.release<=day,'Task release obeys PC date');
 for(const mail of dayMail(at)){ok(mail.date<=day,'Mail received by PC date');for(const id of mail.attachments)ok(sourceIsAvailable(full,at,id),'Mail attachment is available: '+id);}
}
// Saved working-paper links stay recoverable if recycled, but completion reopens.
let fs=respond(fresh,welcome);const fm={...m,state:fs},file=createWorkingFile(fm,'bank',NOW,'UF-DAY-TEST');fs=applyCommand(fs,{type:'saveDesktopFile',file,expectedUpdatedAt:null},NOW);fs=respond(fs,welcome,{...correct,evidence:[...correct.evidence,file.id]});fs=applyCommand(fs,{type:'trashDesktopFile',fileId:file.id,expectedUpdatedAt:fs.desktop!.files[0].updatedAt},NOW);eq(validateBackup(fs),null,'Recycling a linked workbook does not corrupt backup');eq(dayTaskStatus(welcome,fs).state,'Needs correction','Recycled supporting file reopens check');
fs=applyCommand(fs,{type:'restoreDesktopFile',fileId:file.id,expectedUpdatedAt:fs.desktop!.files[0].updatedAt},NOW);eq(dayTaskStatus(welcome,fs).state,'Complete','Restored evidence restores completion');
const monthly=start('2025-07',271828,false),migrated=applyCommand(monthly,{type:'enableWorkday'},NOW);eq(migrated.workday!.today,'2025-07-01','Untouched monthly backup migrates to first day');
let worked=applyCommand(monthly,{type:'importJournals',journals:[{...invoiceEntry,id:'MIGRATE'}]},NOW);const migrateDate=workdayEnableDate(worked);worked=applyCommand(worked,{type:'enableWorkday'},NOW);eq(worked.workday!.today,migrateDate,'Migration preserves availability of already-used source');eq(worked.journals.length,1,'Migration retains all existing postings');eq(validateBackup(worked),null,'Migrated backup passes validation');
// Full annual progression: operate only after release, then close while PC date is in following month.
let year=start('2025-01',101,true,'financial-manager'),totalTasks=0,totalResponses=0;
for(const month of CAREER_MONTHS){
 console.log('Daily full-year acceptance: '+month);
 year=advance(year,workdayLimit(month));let company=companyForState(year,false);
 const entries=company.solutionJournals.filter(j=>j.date.startsWith(month)).map(j=>({...j,id:'YEAR-'+j.id,exerciseId:undefined,origin:'learner' as const}));
 for(let n=0;n<entries.length;n+=200)year=applyCommand(year,{type:'importJournals',journals:entries.slice(n,n+200)},NOW);
 const matches=company.bank.filter(b=>b.date.startsWith(month)).map(b=>({bankId:b.id,journalIds:['YEAR-'+b.journalId]}));for(let n=0;n<matches.length;n+=150)year=applyCommand(year,{type:'matchBankBatch',matches:matches.slice(n,n+150)},NOW);
 for(const t of dayTasks(year).filter(t=>t.kind==='response')){year=respond(year,t);totalResponses++;}
 const forecast=blankForecast(month);forecast.status='submitted';forecast.evidence=[`CEO-${month}`];forecast.weeks=forecast.weeks.map(w=>({...w,receipts:2000000,supplierPayments:700000,payroll:800000,overheads:100000}));forecast.assumptions='Test fixture: receipts are grounded in customer schedules and payments reflect payroll, supplier and overhead commitments. Future funding is not represented as approved.';forecast.actions='Test fixture: monitor reserve headroom, follow up customers, and obtain independent authority for any funding or deferred payment proposal.';year=applyCommand(year,{type:'saveCareerForecast',forecast},NOW);
 for(const t of careerTasks(company,year))year=applyCommand(year,{type:'saveCareerSubmission',submission:{month,taskId:t.id,status:'submitted',figures:Object.fromEntries(t.figures.map(f=>[f.id,f.expected])),responses:Object.fromEntries(t.responses.map(r=>[r.id,'Test fixture: documented source reconciliation and responsibility assignment, retained for separate professional review rather than an automatic judgement score.'])),evidence:t.evidence.slice(0,2),updatedAt:''}},NOW);
 eq(daySummary(year).open.length,0,'All '+month+' daily source/bank/response/formal checks pass');totalTasks+=dayTasks(year).length;
 const report=assessMonth(companyForState(year),year);eq(report.blockers,0,month+' independent month review also passes');ok(report.checks.some(c=>c.area==='Daily management requests'),month+' month review includes daily requests');
 year=applyCommand(year,{type:'submitMonthReview'},NOW);const fingerprint=assessmentFingerprint(year);const again=dayTasks(year).find(t=>t.kind==='response')!;year=respond(year,again,{...response(again),note:response(again).note+' Additional documented follow-up.'});ok(assessmentFingerprint(year)!==fingerprint,month+' daily response edit makes month review stale');
 year=applyCommand(year,{type:'closeCareerMonth',reason:'All independent numerical and completion controls checked. Written professional judgement remains for review.'},NOW);
 eq(validateBackup(year),null,month+' closed daily case survives backup validation');ok(JSON.stringify(year).length<1500000,month+' state remains under production persistence size limit');
 if(month!=='2025-12'){const pc=year.workday!.today;year=applyCommand(year,{type:'advanceCareerMonth'},NOW);eq(year.workday!.today,pc,'Releasing next month never rewinds PC');ok(dayTasks(year).length>0,'Already-arrived next-month work is a visible backlog');}
}
eq(Object.keys(year.career!.closed).length,12,'All twelve months close in one daily case');eq(year.workday!.today,'2026-01-14','December close window ends in January without claiming new-year trading');
rejects(year,{type:'advanceCareerMonth'},/complete|year|last|December|final/i,'No unsupported 2026 operating case');
console.log(`Full daily year: ${year.journals.length} learner journals; ${totalTasks} task instances; ${totalResponses} responses; ${JSON.stringify(year).length} bytes.`);
if(process.env.LEDGERLAB_DAY_FIXTURE)writeFileSync(process.env.LEDGERLAB_DAY_FIXTURE,JSON.stringify({welcome:correct,julyTasks:dayTasks(fresh,true),julyEnd:advance(fresh,workdayLimit('2025-07')),yearClosed:year}));
console.log(`PASS: ${checks} daily availability, control, deadline, backup, export and full-year progression assertions.`);
