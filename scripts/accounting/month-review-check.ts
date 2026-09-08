import assert from 'node:assert/strict';
import {initialState,applyCommand,validateBackup} from '../../lib/accounting/engine';
import {companyForState,careerKey,CAREER_MONTHS} from '../../lib/accounting/career';
import {careerTasks,blankForecast,careerBankMatchIssues,careerEvidenceChecks} from '../../lib/accounting/career-work';
import {assessMonth,assessmentFingerprint,reviewReceiptsError} from '../../lib/accounting/month-assessment';
import {monthReviewHTML,monthReviewDocument,feedbackVisible} from '../../lib/accounting/month-review-view';
import {writeFileSync} from 'node:fs';
import type {PracticeState,Journal} from '../../lib/accounting/types';
let checks=0;
const ok=(v:unknown,m:string)=>{assert.ok(v,m);checks++;};
const eq=(a:unknown,b:unknown,m:string)=>{assert.deepEqual(a,b,m);checks++;};
const throws=(f:()=>unknown,m:RegExp,label:string)=>{assert.throws(f,m,label);checks++;};
const NOW='2026-09-07T12:00:00.000Z';
const start=(month='2025-07',role:'financial-manager'|'financial-accountant'='financial-manager',seed=271828)=>applyCommand(initialState(seed),{type:'startCareer',seed,startMonth:month,role,scenario:'messy',confirmation:'START TAKEOVER'},NOW);
function post(s:PracticeState){
 const c=companyForState(s),month=s.career!.activeMonth;
 const journals=c.exercises.filter(e=>e.expected[0].date.startsWith(month)).flatMap(e=>e.expected.map(j=>({...j,id:`ME-${j.id}`,exerciseId:undefined,origin:'learner' as const})));
 for(let i=0;i<journals.length;i+=200)s=applyCommand(s,{type:'importJournals',journals:journals.slice(i,i+200)},NOW);
 const matches=c.bank.filter(r=>r.date.startsWith(month)).map(r=>({bankId:r.id,journalIds:[`ME-${r.journalId}`]}));
 for(let i=0;i<matches.length;i+=150)s=applyCommand(s,{type:'matchBankBatch',matches:matches.slice(i,i+150)},NOW);
 return s;
}
function deliver(s:PracticeState){
 const c=companyForState(s),month=s.career!.activeMonth;
 if(s.career!.role==='financial-manager'){
  const f=blankForecast(month);f.weeks=f.weeks.map(w=>({...w,receipts:2000000,supplierPayments:700000,payroll:800000,overheads:100000}));f.status='submitted';f.evidence=[`CEO-${month}`];
  f.assumptions='Fixture only: collections use approved customer schedules and payments reflect supplier, payroll and tax commitments. No assumption of unapproved funding is made here.';f.actions='Fixture only: monitor cash headroom, investigate overdue customers and seek approved payment or financing decisions.';
  s=applyCommand(s,{type:'saveCareerForecast',forecast:f},NOW);
 }
 for(const t of careerTasks(c,s))s=applyCommand(s,{type:'saveCareerSubmission',submission:{month,taskId:t.id,status:'submitted',figures:Object.fromEntries(t.figures.map(f=>[f.id,f.expected])),responses:Object.fromEntries(t.responses.map(r=>[r.id,'Test fixture explanation supplied for completion checks only; this is not an assessment of professional judgement or evidence interpretation.'])),evidence:t.evidence.slice(0,2),updatedAt:''}},NOW);
 return s;
}
function report(s:PracticeState){return assessMonth(companyForState(s),s);}
throws(()=>report(initialState()),/takeover/,'No assessment claimed for legacy non-takeover mode');
const blank=start(),before=JSON.stringify(blank),r=report(blank);
eq(JSON.stringify(blank),before,'Assessment is pure and leaves journals, state and notes untouched');
ok(r.blockers>0&&!r.ready,'Unworked month cannot be ready');
ok(r.checks.some(c=>c.status==='missing'&&c.area==='Source processing'),'Missing source work identified');
ok(r.checks.some(c=>c.status==='incorrect'&&c.area==='Balances and reporting'),'Balanced inherited ledger is not called correct');
eq(r.manual,4,'Four ungraded categories explicit in manager track');
ok(r.checks.every(c=>!c.sourceIds.some(id=>id.includes('2025-08'))),'Feedback does not reveal unreleased August sources');
eq(r.checks.filter(c=>c.blocking&&c.status!=='pass').length,r.blockers,'Summary blocker count matches detail');
eq(r.total,r.passed+r.blockers,'Summary partition agrees');
eq(feedbackVisible(blank,r),false,'Exam/on-the-job check does not reveal expected numbers');
const hidden=monthReviewHTML(companyForState(blank),blank,r);ok(hidden.includes('Hidden until submission'),'Expected values withheld in pre-submission UI');
let reviewed=applyCommand(blank,{type:'submitMonthReview'},NOW);
eq(reviewed.journals,blank.journals,'Review does not apply answers or change ledger');
eq(reviewed.bankMatches,blank.bankMatches,'Review does not auto-match bank');
eq(reviewed.career,blank.career,'Review does not submit tasks, close or release months');
eq(reviewed.monthReviews!.length,1,'Submitted failed attempt persists');
eq(feedbackVisible(reviewed,report(reviewed)),true,'Submission reveals feedback for this saved attempt');
eq(validateBackup(reviewed),null,'Review receipt is backup portable');
eq(applyCommand(reviewed,{type:'submitMonthReview'},NOW),reviewed,'Duplicate unchanged submit does not create another attempt or log');
ok(monthReviewDocument(companyForState(reviewed),reviewed,report(reviewed)).includes('Net correction'),'Printable feedback includes correction-column header');
const stale=applyCommand(reviewed,{type:'saveNotes',notes:'New documented review evidence'},NOW);
ok(assessmentFingerprint(stale)!==assessmentFingerprint(reviewed),'Relevant saved work changes stale the receipt');
ok(monthReviewHTML(companyForState(stale),stale,report(stale)).includes('STALE REVIEW'),'Staleness is clearly labelled');
eq(feedbackVisible(stale,report(stale)),false,'Changed on-the-job attempt must be resubmitted for its new answer report');
const mail=applyCommand(reviewed,{type:'markDesktopMailRead',mailId:'MAIL-test',read:true},NOW);
eq(assessmentFingerprint(mail),assessmentFingerprint(reviewed),'Reading mail does not invalidate saved assessment');
const reordered=structuredClone(reviewed);reordered.bankMatches=Object.fromEntries(Object.entries(reviewed.bankMatches).reverse());
eq(assessmentFingerprint(reordered),assessmentFingerprint(reviewed),'Fingerprint is stable under object key order');
// A wrong but balanced source posting is diagnosed by exact field and cents.
const c=companyForState(blank),target=c.exercises.flatMap(e=>e.expected).find(j=>j.date.startsWith('2025-07')&&!j.lines.some(l=>l.account==='1000')&&j.lines.length===2)!;
ok(!!target,'Two-line fixture available');
for(const variant of ['amount','account','date','source','contact','duplicate','reverse'] as const){
 let s=blank;const j=structuredClone(target);j.id='WRONG-'+variant;j.exerciseId=undefined;
 if(variant==='amount')j.lines=j.lines.map(l=>({...l,debit:l.debit?l.debit+100:0,credit:l.credit?l.credit+100:0}));
 if(variant==='account')j.lines[0].account=j.lines[0].account==='6990'?'6220':'6990';
 if(variant==='date')j.date=j.date.endsWith('-31')?'2025-07-30':'2025-07-31';
 if(variant==='source')j.sourceId=undefined;
 if(variant==='contact')j.lines[0].contact=c.contacts[0].id;
 if(variant==='reverse')j.lines=j.lines.map(l=>({...l,debit:l.credit,credit:l.debit}));
 s=applyCommand(s,{type:'postJournal',journal:j},NOW);
 if(variant==='duplicate')s=applyCommand(s,{type:'postJournal',journal:{...j,id:'DUPLICATE'}},NOW);
 const errors=report(s).checks.filter(x=>x.area==='Source processing'&&x.status==='incorrect');
 ok(errors.length>0,`Balanced ${variant} error identified`);
 ok(errors.some(x=>x.differences.length>0),`${variant} supplies field-level differences`);
}
// Split postings and reversal/replacement are accepted by net signature, not journal IDs or exact row counts.
{
 let s=blank;const j=structuredClone(target);j.id='SPLIT1';j.exerciseId=undefined;
 const amount=Math.max(...j.lines.map(l=>l.debit||l.credit)),part=Math.floor(amount/2);
 j.lines=j.lines.map(l=>({...l,debit:l.debit?part:0,credit:l.credit?part:0}));
 s=applyCommand(s,{type:'postJournal',journal:j},NOW);
 s=applyCommand(s,{type:'postJournal',journal:{...j,id:'SPLIT2',lines:j.lines.map(l=>({...l,debit:l.debit?amount-part:0,credit:l.credit?amount-part:0}))}},NOW);
 const source=report(s).checks.find(x=>x.id===`source:2025-07|${target.sourceId}`)!;
 // One source may contain additional expected transactions; compare the corrected date/account tuple instead.
 ok(!source.differences.some(d=>d.date===target.date&&d.account===target.lines[0].account),'Split balanced journal removes the corresponding net mismatch');
 s=applyCommand(s,{type:'reverseJournal',journalId:'SPLIT1',date:j.date,reason:'Testing transparent reversal and replacement'},NOW);
 s=applyCommand(s,{type:'postJournal',journal:{...j,id:'REPLACEMENT'}},NOW);
 const after=report(s).checks.find(x=>x.id===source.id)!;
 eq(after.differences,source.differences,'Reversal and replacement retain the same correct net result');
}
// Deliberately wrong saved quantitative task returns your figure, target and signed difference.
{
 const t=careerTasks(c,blank).find(t=>t.figures.length)!,f=t.figures[0];
 const s=applyCommand(blank,{type:'saveCareerSubmission',submission:{taskId:t.id,month:'2025-07',status:'draft',figures:{[f.id]:f.expected+321},responses:{},evidence:[],updatedAt:''}},NOW);
 const check=report(s).checks.find(x=>x.id===`task:${t.id}:figure:${f.id}`)!;
 eq(check.status,'incorrect','Wrong draft field is marked incorrect before formal submission');eq(check.differences[0].actual,f.expected+321,'Wrong figure shown');eq(check.differences[0].expected,f.expected,'Independent expected figure supplied');eq(check.differences[0].difference,321,'Signed difference exact in cents');
 ok(report(s).checks.some(x=>x.id===`task:${t.id}:submission`&&x.status==='missing'),'Draft completion remains outstanding');
}
// Complete an active month and corrupt only a bank match using equal-amount transactions.
let solved=deliver(post(start()));
eq(report(solved).blockers,0,'Independently solved July has zero assessment blockers');eq(report(solved).ready,true,'Solved month ready');
const bankC=companyForState(solved),rows=bankC.bank.filter(b=>b.date.startsWith('2025-07'));
const pair=rows.flatMap((a,i)=>rows.slice(i+1).filter(b=>a.amount===b.amount&&a.journalId!==b.journalId).map(b=>[a,b])).at(0);
if(pair){const bad=structuredClone(solved),[a,b]=pair;[bad.bankMatches[a.id],bad.bankMatches[b.id]]=[bad.bankMatches[b.id],bad.bankMatches[a.id]];
 eq(validateBackup(bad),null,'Equal-amount swapped matches remain structurally valid open-case work');eq(careerBankMatchIssues(bankC,bad).length,2,'Two wrong source matches identified despite equal amounts');ok(!report(bad).ready,'Wrong-source matching prevents readiness');throws(()=>applyCommand(bad,{type:'closeCareerMonth',reason:'Attempt to close with wrong-source equal-value bank matches.'}),/Bank match source integrity/,'Actual close gate blocks equal-value wrong-source matches');
}else throw Error('No equal-value bank fixture available; add one rather than silently skip the test.');
solved=applyCommand(solved,{type:'submitMonthReview'},NOW);eq(solved.monthReviews!.at(-1)!.blockers,0,'Successful attempt saved');
if(process.env.LEDGERLAB_REVIEW_FIXTURE){writeFileSync(process.env.LEDGERLAB_REVIEW_FIXTURE,JSON.stringify(solved));writeFileSync(process.env.LEDGERLAB_REVIEW_FIXTURE.replace('.json','-blank.json'),JSON.stringify(reviewed));}
const closed=applyCommand(solved,{type:'closeCareerMonth',reason:'Automated checks pass. Professional judgements and statutory evidence gaps still require review.'},NOW);
ok(closed.career!.closed['2025-07'].assisted,'Close records use of revealed month feedback');
throws(()=>applyCommand(closed,{type:'submitMonthReview'}),/closed/,'Closed months cannot accumulate review attempts');
eq(assessmentFingerprint(closed),assessmentFingerprint(solved),'Closing alone does not stale unchanged assessed work');
const next=applyCommand(closed,{type:'advanceCareerMonth'},NOW);ok(report(next).blockers>0,'Released August needs its own work');ok(report(next).checks.every(x=>!x.sourceIds.some(id=>id.includes('2025-09'))),'September evidence withheld');
eq(feedbackVisible(next,report(next)),false,'July receipt does not reveal August answers');
// Both roles at every start month exercise all month-end and year-end rubrics.
for(const role of ['financial-manager','financial-accountant'] as const)for(const month of CAREER_MONTHS){
 let s=deliver(post(start(month,role,42))),rr=report(s);
 eq(rr.blockers,0,`Solved ${role} start ${month} passes all implemented checks`);eq(rr.ready,true,`${role} ${month} ready`);eq(careerEvidenceChecks(companyForState(s),s).filter(g=>g.remaining).length,0,'Close gates agree with assessment');
 s=applyCommand(s,{type:'submitMonthReview'},NOW);eq(validateBackup(s),null,'Attempt receipt validates at every start month');
 eq(rr.manual,role==='financial-manager'?4:3,'Ungraded scope visible for each role');
}
// A complete year with receipts proves period release and history storage remain compatible.
{
 let s=start('2025-01','financial-manager',42);
 for(const month of CAREER_MONTHS){s=deliver(post(s));eq(report(s).blockers,0,'Each full-year month clears');s=applyCommand(s,{type:'submitMonthReview'},NOW);s=applyCommand(s,{type:'closeCareerMonth',reason:'Monthly figures agree; judgement and missing statutory evidence remain subject to professional review.'},NOW);eq(validateBackup(s),null,'Full-year reviewed close validates');if(month!=='2025-12')s=applyCommand(s,{type:'advanceCareerMonth'},NOW);}
 eq(s.monthReviews!.length,12,'Twelve month reviews retained');ok(Buffer.byteLength(JSON.stringify(s))<1_500_000,'Full-year review history remains within API state limit');console.log(`Reviewed full year: ${Buffer.byteLength(JSON.stringify(s))} bytes.`);
}
// History limits, malformed restores, and relevant-content changes.
let many=reviewed;for(let i=0;i<26;i++){many=applyCommand(many,{type:'saveNotes',notes:'Review iteration '+i},NOW);many=applyCommand(many,{type:'submitMonthReview'},NOW);}
eq(many.monthReviews!.length,24,'Attempt history bounded to latest 24');eq(validateBackup(many),null,'Bounded attempts remain valid');
for(const value of [null,{},[{}],Array(25).fill(reviewed.monthReviews![0]),[{...reviewed.monthReviews![0],passed:99999}],[{...reviewed.monthReviews![0],month:'2025-08'}],[{...reviewed.monthReviews![0],issueIds:[]}],[{...reviewed.monthReviews![0],at:'not a date'}]])ok(reviewReceiptsError(value,blank)!==null,'Malformed review history rejected');
const forged=structuredClone(reviewed);forged.monthReviews![0].total++;ok(validateBackup(forged)!==null,'Backup validates receipt totals');
const malicious=structuredClone(c);malicious.documents.find(d=>d.id===target.sourceId)!.title='<img src=x onerror=alert(1)>';
const safe=monthReviewHTML(malicious,blank,assessMonth(malicious,blank));ok(!safe.includes('<img src=x'),'User-derived source labels are escaped in review UI');ok(safe.includes('&lt;img'),'Escaped text remains inspectable');
console.log(`PASS: ${checks} month-review assessment, error-diagnosis, privacy-of-unreleased-months, receipt, progression and export assertions.`);
