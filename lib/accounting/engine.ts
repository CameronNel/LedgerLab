import {enableWorkday, advanceWorkday, saveDailySubmission, assertWorkdayCommand, syncDayCompletions, workdayShapeError} from './workday';
import {assessMonth,reviewReceiptsError} from './month-assessment';
import {desktopStateError, desktopFileError, emptyDesktop} from '../desktop/types';
import { ACCOUNTS, ACCOUNT_MAP, dr, cr } from './accounts';
import {companyForState, careerShapeError, assertCareerOpenDate, invalidateCareerMonth, careerKey, CAREER_MONTHS} from './career';
import {validateCareerSubmission, validateCareerForecast, validateCareerRecords, careerEvidenceChecks} from './career-work';
import {defaultJournalTemplates,journalTemplates} from './journal-templates';
import {defaultEvidenceRequests,evidenceRequests,EVIDENCE_STATUSES} from './evidence-requests';
import { sum, validDate, daysBetween, monthEnd, pct } from './money';
import type { Journal, Line, PracticeCompany, PracticeState, Exercise, Command, SourceDocument, Workpaper, CreditAllocation, Disclosure, EvidenceRequest, JournalTemplate, BalanceReconciliation } from './types';

export function initialState(seed=271828):PracticeState {return {schemaVersion:1,seed,journals:[],bankMatches:{},allocations:[],disclosures:{},evidenceRequests:defaultEvidenceRequests(),journalTemplates:defaultJournalTemplates(),balanceReconciliations:{},revealed:[],attempts:{},workpapers:{},taskChecks:{},periodLocked:false,auditLog:[],customDocuments:[],notes:'',mode:'guided'};}
export function journalError(j:Journal,company:PracticeCompany,locked=false):string|null {
 if(!j||typeof j!=='object')return 'Journal is missing.';
 if(typeof j.id!=='string'||!j.id||j.id.length>100)return 'Journal ID is required and must be short.';
 if(!validDate(j.date))return 'Choose a valid posting date.';
 if(company.career ? (j.date<`${company.career.startMonth}-01`||j.date>monthEnd(company.career.activeMonth)) : (j.date<'2025-12-01'||j.date>'2026-01-31'))return company.career?'Post within the released takeover periods.':'Post practice entries in December 2025 or January 2026. Earlier periods are the agreed opening case.';
 if(locked&&j.date<='2025-12-31')return 'December is locked. Reopen it with a reason before posting.';
 if(typeof j.description!=='string'||!j.description.trim()||j.description.length>500)return 'Add a narration of 1–500 characters.';
 if(typeof j.module!=='string'||!j.module.trim()||j.module.length>100)return 'Choose a valid journal module.';
 if(j.sourceId!==undefined&&(typeof j.sourceId!=='string'||j.sourceId.length>100))return 'Source document reference must be short text.';
 if(typeof j.reference!=='string'||j.reference.length>150)return 'Reference must be at most 150 characters.';
 if(!Array.isArray(j.lines)||j.lines.length<2||j.lines.length>100)return 'A journal needs 2–100 lines.';
 for(const l of j.lines){if(!l||typeof l.account!=='string')return 'Each journal line needs an account.';const account=ACCOUNT_MAP[l.account];if(!account)return `Unknown account ${l.account}.`;
  if(!Number.isSafeInteger(l.debit)||!Number.isSafeInteger(l.credit)||l.debit<0||l.credit<0||l.debit>100_000_000_000||l.credit>100_000_000_000)return 'Amounts must be non-negative integer cents within the supported limit.';
  if((l.debit>0)===(l.credit>0))return 'Each line needs an amount on exactly one side.';
  if(account.control&&!company.contacts.some(c=>c.id===l.contact&&c.kind===account.control))return `${account.name} requires a valid ${account.control} contact.`;
  if(l.itemId!==undefined&&!company.inventory.some(i=>i.id===l.itemId))return 'Unknown inventory item on journal line.';
  if(l.memo!==undefined&&(typeof l.memo!=='string'||l.memo.length>500))return 'Line descriptions must be under 500 characters.';
 }
 if(sum(j.lines.map(l=>l.debit))!==sum(j.lines.map(l=>l.credit)))return 'Debits and credits must balance exactly.';
 if(j.exerciseId&&!company.exercises.some(e=>e.id===j.exerciseId))return 'Unknown exercise.';
 if(j.cashClass&&!['operating','investing','financing'].includes(j.cashClass))return 'Choose a valid cash flow classification.';
 return null;
}
export function journalsFor(company:PracticeCompany,state:PracticeState,view:'learner'|'solution'='learner'):Journal[]{return [company.opening,...(view==='solution'?company.solutionJournals:[...company.baseJournals,...state.journals])].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));}
export function accountBalances(journals:Journal[],from?:string,to?:string):Record<string,number>{const b:Record<string,number>=Object.fromEntries(ACCOUNTS.map(a=>[a.code,0]));for(const j of journals){if(from&&j.date<from||to&&j.date>to)continue;for(const l of j.lines)b[l.account]=(b[l.account]??0)+l.debit-l.credit;}return b;}
export function trialBalance(journals:Journal[],to='2025-12-31'){const b=accountBalances(journals,undefined,to);return ACCOUNTS.map(a=>({...a,balance:b[a.code],debit:Math.max(0,b[a.code]),credit:Math.max(0,-b[a.code])}));}
export function profitAndLoss(journals:Journal[],from='2025-01-01',to='2025-12-31'){
 const b=accountBalances(journals,from,to),income=ACCOUNTS.filter(a=>a.type==='income'),expenses=ACCOUNTS.filter(a=>a.type==='expense');
 const revenue=-sum(income.filter(a=>a.group==='Revenue').map(a=>b[a.code])),otherIncome=-sum(income.filter(a=>a.group!=='Revenue').map(a=>b[a.code])),cogs=sum(expenses.filter(a=>a.group==='Cost of sales').map(a=>b[a.code])),tax=(b['6800']??0)+(b['6810']??0),opex=sum(expenses.filter(a=>!['Cost of sales','Income tax'].includes(a.group)).map(a=>b[a.code]));
 return {balances:b,revenue,otherIncome,cogs,grossProfit:revenue-cogs,opex,profitBeforeTax:revenue+otherIncome-cogs-opex,tax,netProfit:revenue+otherIncome-cogs-opex-tax,groups:[...new Set(expenses.map(a=>a.group))].map(name=>({name,amount:sum(expenses.filter(a=>a.group===name).map(a=>b[a.code])),accounts:expenses.filter(a=>a.group===name)}))};
}
export function financialPosition(journals:Journal[],to='2025-12-31'){
 const b=accountBalances(journals,undefined,to),profit=profitAndLoss(journals,'2025-01-01',to).netProfit;
 const assets=sum(ACCOUNTS.filter(a=>a.type==='asset').map(a=>b[a.code])),liabilities=-sum(ACCOUNTS.filter(a=>a.type==='liability').map(a=>b[a.code])),equity=-sum(ACCOUNTS.filter(a=>a.type==='equity').map(a=>b[a.code]))+profit;
 return {balances:b,assets,liabilities,equity,profit,difference:assets-liabilities-equity,groups:['asset','liability','equity'].map(type=>({type,groups:[...new Set(ACCOUNTS.filter(a=>a.type===type).map(a=>a.group))].map(name=>({name,amount:sum(ACCOUNTS.filter(a=>a.type===type&&a.group===name).map(a=>b[a.code]))*(type==='asset'?1:-1),accounts:ACCOUNTS.filter(a=>a.type===type&&a.group===name)}))}))};
}
export function bankAmount(j:Journal):number{return sum(j.lines.filter(l=>l.account==='1000').map(l=>l.debit-l.credit));}
export function cashAmount(j:Journal):number{return sum(j.lines.filter(l=>l.account==='1000'||l.account==='1010').map(l=>l.debit-l.credit));}
export function inferCashClass(j:Journal):'operating'|'investing'|'financing'{if(j.cashClass)return j.cashClass;const codes=j.lines.map(l=>l.account);if(codes.some(c=>['1500','1520','4200','6900','4100'].includes(c)))return 'investing';if(codes.some(c=>['2500','2510','2520','2530','3000','3200','6410'].includes(c)))return 'financing';return 'operating';}
export function cashFlow(journals:Journal[],from='2025-01-01',to='2025-12-31'){
 const period=journals.filter(j=>j.date>=from&&j.date<=to),b=accountBalances(period),opening=sum(journals.filter(j=>j.date<from).map(cashAmount)),closing=opening+sum(period.map(cashAmount));
 const direct={operating:0,investing:0,financing:0};for(const j of period)direct[inferCashClass(j)]+=cashAmount(j);
 const profit=profitAndLoss(period,from,to).netProfit;
 const wcCodes=['1100','1200','1300','1310','1320','1400','2000','2100','2110','2120','2130','2140','2200','2210','2300','2600','6990'];
 const noncashCodes=['1110','1210','1510','1530','1600','2610','2150','2400','2410'];
 const noncash=noncashCodes.filter(a=>b[a]).map(a=>({account:a,name:ACCOUNT_MAP[a].name,amount:-b[a]}));
 const workingCapital=wcCodes.filter(a=>b[a]).map(a=>({account:a,name:ACCOUNT_MAP[a].name,amount:-b[a]}));
 const financingInterest=b['6410']??0,investingInterest=b['4100']??0,gainDisposal=b['4200']??0,lossDisposal=b['6900']??0;
 // Remove operating control-account changes belonging to investing/financing journals.
 // This is supported by actual counterpart lines, never a balancing plug.
 const classificationAdjustments=sum(period.filter(j=>inferCashClass(j)!=='operating').flatMap(j=>j.lines.filter(l=>wcCodes.includes(l.account)).map(l=>l.debit-l.credit)));
 const indirectOperating=profit+sum(noncash.map(r=>r.amount))+sum(workingCapital.map(r=>r.amount))+financingInterest+investingInterest+gainDisposal+lossDisposal+classificationAdjustments;
 return {opening,closing,direct,profit,noncash,workingCapital,financingInterest,investingInterest,gainDisposal,lossDisposal,classificationAdjustments,indirectOperating,operatingDifference:indirectOperating-direct.operating,difference:opening+direct.operating+direct.investing+direct.financing-closing,transactions:period.filter(j=>cashAmount(j)!==0).map(j=>({journal:j,amount:cashAmount(j),classification:inferCashClass(j)}))};
}
export function aggregateLines(journals:Journal[],includeDates=true):Record<string,number>{const result:Record<string,number>={};for(const j of journals)for(const l of j.lines){const linked=['1100','2000','1200'].includes(l.account)?j.sourceId??'':'';const key=`${includeDates?j.date+'|':''}${l.account}|${l.contact??''}|${linked}`;result[key]=(result[key]??0)+l.debit-l.credit;}return Object.fromEntries(Object.entries(result).filter(([,v])=>v!==0));}
export function gradeExercise(exercise:Exercise,state:PracticeState){
 const posted=state.journals.filter(j=>exercise.matching==='source-month' ? (j.exerciseId===exercise.id || (j.date.slice(0,7)===exercise.expected[0]?.date.slice(0,7)&&exercise.expected.some(e=>e.sourceId===j.sourceId))) : j.exerciseId===exercise.id&&j.date<='2025-12-31'),actual=aggregateLines(posted),expected=aggregateLines(exercise.expected),keys=[...new Set([...Object.keys(actual),...Object.keys(expected)])];
 const differences=keys.filter(k=>(actual[k]??0)!==(expected[k]??0)).map(key=>({key,expected:expected[key]??0,actual:actual[key]??0,difference:(actual[key]??0)-(expected[key]??0)}));
 const correct=differences.length===0&&posted.length>0,matched=keys.filter(k=>(actual[k]??0)===(expected[k]??0)).length;
 return {correct,started:posted.length>0,assisted:state.revealed.includes(exercise.id)||posted.some(j=>j.origin==='solution'),percentage:correct?100:Math.round(matched/Math.max(1,keys.length)*100),differences,posted,points:correct?exercise.points:0};
}
export function progress(company:PracticeCompany,state:PracticeState){const grades=company.exercises.map(e=>({exercise:e,...gradeExercise(e,state)}));return {grades,completed:grades.filter(g=>g.correct).length,total:grades.length,points:sum(grades.map(g=>g.points)),totalPoints:sum(company.exercises.map(e=>e.points)),independent:grades.filter(g=>g.correct&&!g.assisted).length,assisted:grades.filter(g=>g.correct&&g.assisted).length};}

export function subledger(company:PracticeCompany,state:PracticeState,kind:'customer'|'supplier',asOf='2025-12-31',view:'learner'|'solution'='learner'){
 const code=kind==='customer'?'1100':'2000',sign=kind==='customer'?1:-1,js=journalsFor(company,state,view).filter(j=>j.date<=asOf),documents=[...company.documents,...state.customDocuments];
 const allocations=view==='solution'?[]:(state.allocations??[]).filter(a=>a.date<=asOf&&a.kind===kind);
 const contacts=company.contacts.filter(c=>c.kind===kind).map(contact=>{
  const movements=js.map(journal=>({journal,amount:sum(journal.lines.filter(l=>l.account===code&&l.contact===contact.id).map(l=>(l.debit-l.credit)*sign))})).filter(m=>m.amount!==0);
  const balance=sum(movements.map(m=>m.amount));
  const invoices=documents.filter(d=>(kind==='customer'?d.kind==='Sales invoice':d.kind==='Supplier invoice')&&d.party===contact.name&&d.date<=asOf).map(d=>{
   const sourceMovements=movements.filter(m=>m.journal.sourceId===d.id||d.id==='SI-2024-118'&&m.journal.id==='OPEN-2025');
   const recorded=sum(sourceMovements.filter(m=>m.amount>0).map(m=>m.amount)),allocated=sum(allocations.filter(a=>a.invoiceId===d.id).map(a=>a.amount)),settled=-sum(sourceMovements.filter(m=>m.amount<0).map(m=>m.amount))+allocated,open=recorded-settled,days=daysBetween(d.dueDate??d.date,asOf),bucket=days<=0?0:days<=30?1:days<=60?2:days<=90?3:4;
   return {document:d,recorded,settled,allocated,open,days,bucket,unposted:recorded===0};
  });
  const credits=movements.filter(m=>m.amount<0&&!invoices.some(i=>i.document.id===m.journal.sourceId)&&!js.some(j=>j.reverses===m.journal.id)).map(m=>{const allocated=sum(allocations.filter(a=>a.sourceJournalId===m.journal.id).map(a=>a.amount));return {journal:m.journal,original:-m.amount,allocated,available:-m.amount-allocated};});
  const invoiceBalance=sum(invoices.map(i=>i.open)),onAccount=balance-invoiceBalance;
  const aging=[0,0,0,0,0];for(const i of invoices)if(i.open>0)aging[i.bucket]+=i.open;
  return {contact,balance,invoices,onAccount,aging,movements,credits};
 });
 const control=(accountBalances(js)[code]??0)*sign,total=sum(contacts.map(c=>c.balance)),aging=[0,0,0,0,0].map((_,i)=>sum(contacts.map(c=>c.aging[i])));
 return {contacts,control,total,difference:control-total,aging,onAccount:sum(contacts.map(c=>c.onAccount)),invoices:contacts.flatMap(c=>c.invoices.map(i=>({...i,contact:c.contact})))};
}
export function allocationError(a:CreditAllocation,company:PracticeCompany,state:PracticeState):string|null {
 if(!a||typeof a.id!=='string'||!a.id||a.id.length>100||!['customer','supplier'].includes(a.kind)||!validDate(a.date)||(company.career?(a.date<`${company.career.startMonth}-01`||a.date>monthEnd(company.career.activeMonth)):(a.date<'2025-12-01'||a.date>'2026-01-31'))||!Number.isSafeInteger(a.amount)||a.amount<=0)return 'Choose a valid allocation date and a positive amount in cents.';
 if((state.allocations??[]).some(x=>x.id===a.id))return 'This allocation already exists.';
 const c=subledger(company,state,a.kind,'2026-01-31').contacts.find(c=>c.contact.id===a.contactId),credit=c?.credits.find(c=>c.journal.id===a.sourceJournalId),invoice=c?.invoices.find(i=>i.document.id===a.invoiceId);
 if(!credit||!invoice||invoice.unposted)return 'Choose an unapplied credit and a posted invoice for the same contact.';
 if(credit.journal.date>a.date||invoice.document.date>a.date)return 'The allocation cannot precede its credit or invoice.';
 if(a.amount>credit.available)return 'The allocation exceeds the unused credit.';
 if(a.amount>invoice.open)return 'The allocation exceeds the invoice open balance.';
 return null;
}
export function bankReconciliation(company:PracticeCompany,state:PracticeState,month='2025-12'){
 const end=monthEnd(month),js=journalsFor(company,state).filter(j=>j.date<=end),rows=company.bank.filter(r=>r.date.startsWith(month)),allRows=company.bank.filter(r=>r.date<=end),openingStatement=company.bank.filter(r=>r.date<`${month}-01`).at(-1)?.balance??21000000,closingStatement=allRows.at(-1)?.balance??21000000,book=sum(js.map(bankAmount));
 const usedIds=new Set(Object.entries(state.bankMatches).filter(([bid])=>allRows.some(r=>r.id===bid)).flatMap(([,ids])=>ids));
 const previousIds=new Set(company.bank.filter(r=>r.date<`${month}-01`).map(r=>r.journalId));
 const bookTransactions=js.filter(j=>j.date.startsWith(month)&&bankAmount(j)!==0).map(j=>({journal:j,amount:bankAmount(j),matched:usedIds.has(j.id)}));
 const unmatchedBank=rows.filter(r=>!state.bankMatches[r.id]);
 const unpresented=js.filter(j=>j.date>='2025-01-01'&&bankAmount(j)!==0&&!usedIds.has(j.id)&&!previousIds.has(j.id));
 const outstandingDeposits=sum(unpresented.map(bankAmount).filter(a=>a>0)),outstandingPayments=-sum(unpresented.map(bankAmount).filter(a=>a<0));
 const adjustedStatement=closingStatement+outstandingDeposits-outstandingPayments;
 return {rows,openingStatement,closingStatement,book,difference:book-closingStatement,unmatchedBank,bookTransactions,outstandingDeposits,outstandingPayments,adjustedStatement,reconciliationDifference:book-adjustedStatement,unpresented,matched:rows.length-unmatchedBank.length,complete:unmatchedBank.length===0&&book-adjustedStatement===0};
}
export function suggestedBankMatches(company:PracticeCompany,state:PracticeState,bankId:string){const row=company.bank.find(r=>r.id===bankId);if(!row)return [];const used=new Set(Object.values(state.bankMatches).flat());return journalsFor(company,state).filter(j=>!used.has(j.id)&&bankAmount(j)===row.amount&&Math.abs(daysBetween(j.date,row.date))<=7).sort((a,b)=>Number(b.sourceId===row.reference)-Number(a.sourceId===row.reference)||Math.abs(daysBetween(a.date,row.date))-Math.abs(daysBetween(b.date,row.date)));}
export function integrityChecks(company:PracticeCompany,state:PracticeState){
 const js=journalsFor(company,state),tb=trialBalance(js),bs=financialPosition(js),cf=cashFlow(js),ar=subledger(company,state,'customer'),ap=subledger(company,state,'supplier'),p=progress(company,state),pay=company.payroll[company.career?.activeMonth??'2025-12']??[];
 return [
  {id:'tb',name:'Trial balance',difference:sum(tb.map(r=>r.debit-r.credit)),detail:'Total debit balances less total credit balances.'},
  {id:'bs',name:'Accounting equation',difference:bs.difference,detail:'Assets less liabilities and equity, including current-year profit.'},
  {id:'cash',name:'Cash flow to cash book',difference:cf.difference,detail:'Opening bank plus classified cash flows equals closing bank.'},
  {id:'indirect',name:'Indirect to direct operating cash flow',difference:cf.operatingDifference,detail:'Profit-to-cash bridge compared with actual operating bank movements.'},
  {id:'ar',name:'Receivables control',difference:ar.difference,detail:'Receivables control agrees with all customer balances, including on-account credits.'},
  {id:'ap',name:'Payables control',difference:ap.difference,detail:'Payables control agrees with all supplier balances.'},
  {id:'pay',name:'Payroll gross-to-net',difference:sum(pay.map(p=>p.gross-p.withholding-p.deductions-p.net)),detail:'Gross pay less withholding and deductions equals net wages.'},
  {id:'journals',name:'Individual journals',difference:js.filter(j=>sum(j.lines.map(l=>l.debit-l.credit))!==0).length,detail:'Every journal must balance independently.'},
  {id:'work',name:'Practice adjustments remaining',difference:p.total-p.completed,detail:'Unfinished or incorrect exercises. A balanced ledger can still contain accounting errors.',count:true},
 ];
}

export function reconciliationResult(company:PracticeCompany,state:PracticeState,r:BalanceReconciliation){const normal=ACCOUNT_MAP[r.account]?.normal==='credit'?-1:1,ledger=(accountBalances(journalsFor(company,state),undefined,r.asOf)[r.account]??0)*normal,support=sum(r.items.map(i=>i.amount));return {ledger,support,difference:ledger-support};}
function validBalanceReconciliation(r:BalanceReconciliation,company:PracticeCompany,state:PracticeState){const a=ACCOUNT_MAP[r?.account];if(!r||!a||!['asset','liability','equity'].includes(a.type)||!validDate(r.asOf)||r.asOf<'2025-01-01'||r.asOf>'2026-01-31'||!Array.isArray(r.items)||!r.items.length||r.items.length>50||new Set(r.items.map(i=>i.id)).size!==r.items.length||typeof r.conclusion!=='string'||r.conclusion.length>15000||typeof r.preparer!=='string'||r.preparer.length>100||typeof r.reviewer!=='string'||r.reviewer.length>100||typeof r.prepared!=='boolean'||typeof r.reviewed!=='boolean'||typeof r.updatedAt!=='string')throw new Error('Reconciliation fields are invalid.');
 for(const i of r.items)if(!i||typeof i.id!=='string'||!i.id||i.id.length>100||typeof i.description!=='string'||!i.description.trim()||i.description.length>500||!Number.isSafeInteger(i.amount)||Math.abs(i.amount)>100_000_000_000||(i.documentId&&![...company.documents,...state.customDocuments].some(d=>d.id===i.documentId)))throw new Error('Each component needs a description, a valid amount and an existing evidence reference.');
 if(r.prepared&&(!r.preparer.trim()||!r.conclusion.trim()))throw new Error('Record a preparer and conclusion before signing the reconciliation as prepared.');
 if(r.reviewed&&(!r.prepared||!r.reviewer.trim()||!r.items.some(i=>i.documentId)||reconciliationResult(company,state,r).difference!==0))throw new Error('A reviewed reconciliation must agree, have linked evidence and have preparer and reviewer sign-offs.');
}
function validJournalTemplate(t:JournalTemplate,company:PracticeCompany){if(!t||typeof t.name!=='string'||!t.name.trim()||t.name.length>150||typeof t.notes!=='string'||t.notes.length>5000||typeof t.updatedAt!=='string')throw new Error('Journal template fields are invalid.');const err=journalError({id:t.id,date:company.career?monthEnd(company.career.activeMonth):'2025-12-31',description:t.description,reference:'TEMPLATE',module:'Template',lines:t.lines,sourceId:t.sourceId,cashClass:t.cashClass},company);if(err)throw new Error(err);}
function validEvidenceRequest(r:EvidenceRequest,company:PracticeCompany,state:PracticeState){
 if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||typeof r.title!=='string'||!r.title.trim()||r.title.length>200||typeof r.description!=='string'||r.description.length>5000||typeof r.owner!=='string'||r.owner.length>100||!validDate(r.dueDate)||!['High','Normal','Low'].includes(r.priority)||!EVIDENCE_STATUSES.includes(r.status)||!(/^(?:[ABCDFGHIJKL]-01|E-0[12])$/).test(r.workpaper)||typeof r.notes!=='string'||r.notes.length>15000||typeof r.updatedAt!=='string'||!Array.isArray(r.evidence)||r.evidence.length>200||new Set(r.evidence).size!==r.evidence.length||r.evidence.some(id=>![...company.documents,...state.customDocuments].some(d=>d.id===id)))throw new Error('Evidence request fields or document links are invalid.');
 if(r.status==='Reviewed'&&(!r.notes.trim()||!r.evidence.length))throw new Error('A reviewed request needs linked evidence and a documented conclusion.');
 if(r.status==='Not applicable'&&!r.notes.trim())throw new Error('Explain why this evidence request is not applicable.');
}
function validDisclosure(d:Disclosure){if(!d||!(/^(?:0[1-9]|1[0-8])$/).test(d.id)||typeof d.text!=='string'||d.text.length>15000||typeof d.completed!=='boolean'||typeof d.updatedAt!=='string')throw new Error('Disclosure fields are invalid.');if(d.completed&&!d.text.trim())throw new Error('Write your assessment before marking the disclosure complete.');}
function validWorkpaper(w:Workpaper){if(!w||typeof w.id!=='string'||!(/^(?:[ABCDFGHIJKL]-01|E-0[12])$/).test(w.id)||typeof w.prepared!=='boolean'||typeof w.reviewed!=='boolean'||typeof w.updatedAt!=='string'||typeof w.conclusion!=='string'||w.conclusion.length>15000||typeof w.preparer!=='string'||w.preparer.length>100||typeof w.reviewer!=='string'||w.reviewer.length>100||!Array.isArray(w.evidence)||w.evidence.length>200||w.evidence.some(e=>typeof e!=='string'||e.length>100))throw new Error('Workpaper contains invalid fields.');if(w.reviewed&&(!w.prepared||!w.preparer.trim()||!w.reviewer.trim()||!w.conclusion.trim()||w.evidence.length===0))throw new Error('Add a conclusion, evidence, preparer and reviewer before marking this workpaper reviewed.');}
export function invoiceJournalLines(d:SourceDocument,company:PracticeCompany):Line[]{
 if(!d||!['Sales invoice','Supplier invoice','Credit note','Supplier credit note'].includes(d.kind)||!validDate(d.date)||!d.id||typeof d.id!=='string'||d.id.length>100||!d.party||typeof d.party!=='string'||d.party.length>200||typeof d.title!=='string'||d.title.length>300||!Array.isArray(d.journalIds)||d.journalIds.length!==1||typeof d.journalIds[0]!=='string'||!Array.isArray(d.lines)||!d.lines.length||d.lines.length>50||!Array.isArray(d.notes)||d.notes.length>20||d.notes.some(n=>typeof n!=='string'||n.length>5000))throw new Error('Invoice fields are incomplete.');
 if(d.dueDate&&(!validDate(d.dueDate)||d.dueDate<d.date))throw new Error('The invoice due date must be a valid date on or after its issue date.');
 const sales=d.kind==='Sales invoice'||d.kind==='Credit note',credit=d.kind==='Credit note'||d.kind==='Supplier credit note',contact=company.contacts.find(c=>c.id===d.metadata?.contactId&&c.kind===(sales?'customer':'supplier'));
 if(!contact||contact.name!==d.party)throw new Error('Invoice counterparty does not agree with the selected contact.');
 for(const l of d.lines){if(!l||!Number.isFinite(l.quantity)||l.quantity<=0||!Number.isSafeInteger(l.unitPrice)||l.unitPrice<0||!Number.isSafeInteger(l.net)||l.net!==Math.round(l.quantity*l.unitPrice)||!Number.isSafeInteger(l.tax)||!([0,pct(l.net,1000)].includes(l.tax))||typeof l.description!=='string'||!l.description.trim()||l.description.length>500)throw new Error('Invoice line quantities, values or GST do not agree.');const a=ACCOUNT_MAP[l.account??''];if(!a||(sales?!(a.type==='income'&&a.group==='Revenue'):!(a.type==='expense'||['1200','1300','1310','1500'].includes(a.code))))throw new Error('An invoice line has an invalid revenue, cost or asset account.');if(l.itemId){const item=company.inventory.find(i=>i.id===l.itemId);if(!item||!Number.isSafeInteger(l.quantity)||(sales?!['4000','4020'].includes(l.account!):l.account!=='1200'||l.unitPrice!==item.cost))throw new Error('Linked inventory needs a known product, whole units and the case fixed purchase cost.');}}
 if(sum(d.lines.map(l=>l.net))!==d.net||sum(d.lines.map(l=>l.tax))!==d.tax||d.net+d.tax!==d.total||d.total<=0)throw new Error('Invoice totals do not agree.');
 const detail=(l:typeof d.lines[number],debit:boolean):Line=>({...debit?dr(l.account!,l.net):cr(l.account!,l.net),...(!sales&&l.itemId?{itemId:l.itemId}:{})});
 const lines:Line[]=sales?[credit?cr('1100',d.total,contact.id):dr('1100',d.total,contact.id),...d.lines.map(l=>detail(l,credit)),...(d.tax?[credit?dr('2200',d.tax):cr('2200',d.tax)]:[])]:[credit?dr('2000',d.total,contact.id):cr('2000',d.total,contact.id),...d.lines.map(l=>detail(l,!credit)),...(d.tax?[credit?cr('1400',d.tax):dr('1400',d.tax)]:[])];
 if(sales)for(const l of d.lines.filter(l=>l.itemId)){const item=company.inventory.find(i=>i.id===l.itemId)!,cost=l.quantity*item.cost;lines.push({...credit?dr('1200',cost):cr('1200',cost),itemId:item.id},{...credit?cr('5000',cost):dr('5000',cost),itemId:item.id});}
 return lines.filter(l=>l.debit||l.credit);
}
function inventoryTags(lines:Line[]){const values:Record<string,number>={};for(const l of lines.filter(l=>l.itemId)){const key=`${l.account}|${l.itemId}`;values[key]=(values[key]??0)+l.debit-l.credit;}return values;}
export function validateBackup(value:PracticeState):string|null {
 if(!value||value.schemaVersion!==1||!Number.isInteger(value.seed)||value.seed<1||value.seed>2147483647)return 'This is not a supported LedgerLab backup.';
 const record=(v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v);
 if(!Array.isArray(value.journals)||value.journals.length>2000||!Array.isArray(value.customDocuments)||value.customDocuments.length>1000||!record(value.bankMatches)||!record(value.attempts)||!record(value.workpapers)||!record(value.taskChecks)||!Array.isArray(value.revealed)||!Array.isArray(value.auditLog)||typeof value.notes!=='string'||value.notes.length>30000||!['guided','exam'].includes(value.mode)||typeof value.periodLocked!=='boolean')return 'Backup fields are invalid or exceed the supported size.';
 if(value.career){const err=careerShapeError(value.career);if(err)return err;if(value.periodLocked)return 'Takeover periods use individual monthly closes, not the legacy December lock.';}
 const company=companyForState(value,false),ids=new Set<string>();for(const j of value.journals){const err=journalError(j,company);if(err)return err;if(ids.has(j.id)||j.id===company.opening.id||company.baseJournals.some(b=>b.id===j.id))return 'Duplicate journal ID in backup.';ids.add(j.id);}
 const documentIds=new Set(company.documents.map(d=>d.id));for(const d of value.customDocuments){try{invoiceJournalLines(d,company);}catch(e){return (e as Error).message;}if(documentIds.has(d.id))return 'Duplicate source document ID in backup.';const original=value.journals.find(j=>j.id===d.journalIds[0]);if(!original||original.sourceId!==d.id||original.date!==d.date)return 'Backup source document is missing its original journal.';const expectedLines=invoiceJournalLines(d,company),actual=aggregateLines([original]),expected=aggregateLines([{...original,lines:expectedLines}]),actualTags=inventoryTags(original.lines),expectedTags=inventoryTags(expectedLines);if([...new Set([...Object.keys(actual),...Object.keys(expected)])].some(k=>(actual[k]??0)!==(expected[k]??0))||[...new Set([...Object.keys(actualTags),...Object.keys(expectedTags)])].some(k=>(actualTags[k]??0)!==(expectedTags[k]??0)))return 'Backup invoice and original journal do not agree.';documentIds.add(d.id);}
 if(value.allocations!==undefined&&(!Array.isArray(value.allocations)||value.allocations.length>2000))return 'Backup allocations are invalid.';
 const allocationState={...value,allocations:[] as CreditAllocation[]};for(const a of value.allocations??[]){const err=allocationError(a,company,allocationState);if(err)return err;allocationState.allocations.push(a);}
 const allJournals=journalsFor(company,value),matched=new Set<string>();for(const [bankId,journalIds] of Object.entries(value.bankMatches)){const row=company.bank.find(r=>r.id===bankId);if(!row||!Array.isArray(journalIds)||!journalIds.length||new Set(journalIds).size!==journalIds.length)return 'Backup contains an invalid bank match.';let total=0;for(const id of journalIds){const j=allJournals.find(j=>j.id===id);if(!j||matched.has(id)||bankAmount(j)===0)return 'Backup reuses or references a missing cash-book entry.';matched.add(id);total+=bankAmount(j);}if(total!==row.amount)return 'Backup contains a bank match that does not balance.';}
 if(value.revealed.some(id=>!company.exercises.some(e=>e.id===id))||Object.values(value.attempts).some(v=>!Number.isSafeInteger(v)||v<0)||Object.values(value.taskChecks).some(v=>typeof v!=='boolean'))return 'Backup progress fields are invalid.';
 if(value.auditLog.length>10000||value.auditLog.some(e=>!e||typeof e.id!=='string'||typeof e.at!=='string'||typeof e.action!=='string'||typeof e.detail!=='string'||e.detail.length>10000))return 'Backup activity history is invalid.';
 if(value.balanceReconciliations!==undefined){if(!record(value.balanceReconciliations)||Object.keys(value.balanceReconciliations).length>120)return 'Backup balance reconciliations are invalid.';for(const [key,r] of Object.entries(value.balanceReconciliations)){if(!r||key!==`${r.account}|${r.asOf}`)return 'Balance reconciliation key does not agree.';try{validBalanceReconciliation(r,company,value);}catch(e){return (e as Error).message;}}}
 if(value.journalTemplates!==undefined){if(!Array.isArray(value.journalTemplates)||value.journalTemplates.length>100||new Set(value.journalTemplates.map(t=>t.id)).size!==value.journalTemplates.length)return 'Backup journal templates are invalid.';for(const t of value.journalTemplates){try{validJournalTemplate(t,company);}catch(e){return (e as Error).message;}}}
 if(value.evidenceRequests!==undefined){if(!Array.isArray(value.evidenceRequests)||value.evidenceRequests.length>150||new Set(value.evidenceRequests.map(r=>r.id)).size!==value.evidenceRequests.length)return 'Backup evidence requests are invalid.';for(const r of value.evidenceRequests){try{validEvidenceRequest(r,company,value);}catch(e){return (e as Error).message;}}}
 if(value.disclosures!==undefined){if(!value.disclosures||Array.isArray(value.disclosures)||typeof value.disclosures!=='object')return 'Backup disclosures are invalid.';for(const [id,d] of Object.entries(value.disclosures)){if(!d||id!==d.id)return 'Disclosure reference does not match.';try{validDisclosure(d);}catch(e){return (e as Error).message;}}}
 const desktopError=desktopStateError(value.desktop);if(desktopError)return desktopError;
 const reviewError=reviewReceiptsError(value.monthReviews,value);if(reviewError)return reviewError;
 const workdayError=workdayShapeError(value);if(workdayError)return workdayError;
 const careerError=validateCareerRecords(company,value);if(careerError)return careerError;
 for(const [id,w] of Object.entries(value.workpapers)){if(!w||w.id!==id)return 'Workpaper reference does not match its saved key.';try{validWorkpaper(w);}catch(e){return (e as Error).message;}}
 return null;
}

export function applyCommand(current:PracticeState,command:Command,now=new Date().toISOString()):PracticeState{
 const s=structuredClone(current),company=companyForState(s,false),log=(action:string,detail:string)=>{s.auditLog.push({id:`EV-${now}-${s.auditLog.length}`,at:now,action,detail});};
 const add=(j:Journal)=>{assertCareerOpenDate(s,j.date);if(s.career&&j.sourceId&&![...company.documents,...s.customDocuments].some(d=>d.id===j.sourceId))throw new Error('Link an available source document. Future source evidence is not released.');const err=journalError(j,company,s.periodLocked);if(err)throw new Error(err);if(journalsFor(company,s).some(x=>x.id===j.id))throw new Error('This journal was already posted.');if(s.journals.length>=2000)throw new Error('Export this case before starting another; the case has reached 2,000 practice journals.');invalidateCareerMonth(s);s.journals.push({...j,createdAt:now,origin:j.origin==='solution'?'solution':'learner'});for(const w of Object.values(s.workpapers))w.reviewed=false;for(const d of Object.values(s.disclosures??{}))d.completed=false;for(const r of Object.values(s.balanceReconciliations??{}))r.reviewed=false;};
 assertWorkdayCommand(s,command,company);
 switch(command.type){
  case 'enableWorkday':enableWorkday(s);log('Day-by-day mode enabled',`PC date ${s.workday!.today}. Existing work retained; no rewind.`);break;
  case 'advanceWorkday':advanceWorkday(s,command,now);log('PC date advanced',`${current.workday?.today} → ${s.workday!.today}. No transactions auto-posted.`);break;
  case 'saveDailySubmission':saveDailySubmission(s,command.submission,now);log('Daily assignment saved',`${command.submission.taskId}: ${command.submission.status}`);break;
  case 'saveDesktopFile': {
   const invalid=desktopFileError(command.file);if(invalid)throw new Error(invalid);
   const d=s.desktop??emptyDesktop(),old=d.files.find(f=>f.id===command.file.id);
   if(command.expectedUpdatedAt!==(old?.updatedAt??null))throw new Error('This file changed after you opened it. Reload its saved copy or save your draft under a new name.');
   if(old?.deleted)throw new Error('Restore this file from the recycle bin before editing it.');
   if(command.file.deleted)throw new Error('Use the recycle-bin action to remove a learner file.');
   // Server timestamps and creation history are authoritative. Source evidence is not addressable here.
   const updatedAt=old?new Date(Math.max(Date.parse(now),Date.parse(old.updatedAt)+1)).toISOString():now;
   const file={...command.file,createdAt:old?.createdAt??now,updatedAt,deleted:false};
   const next={...d,files:[...d.files.filter(f=>f.id!==file.id),file]};
   const error=desktopStateError(next);if(error)throw new Error(error);s.desktop=next;
   log('Desktop file saved',`${file.folder}/${file.name}`);break;
  }
  case 'trashDesktopFile': case 'restoreDesktopFile': {
   const d=s.desktop??emptyDesktop(),file=d.files.find(f=>f.id===command.fileId);
   if(!file)throw new Error('Only learner-created files can be moved to or restored from the recycle bin.');
   if(command.expectedUpdatedAt!==file.updatedAt)throw new Error('This file changed in another window. Reload before changing it.');
   const deleted=command.type==='trashDesktopFile';
   if(file.deleted===deleted)throw new Error(deleted?'This file is already in the recycle bin.':'This file is already restored.');
   const updatedAt=new Date(Math.max(Date.parse(now),Date.parse(file.updatedAt)+1)).toISOString();
   const next={...d,files:d.files.map(f=>f.id===file.id?{...f,deleted,updatedAt}:f)};
   const error=desktopStateError(next);if(error)throw new Error(error);s.desktop=next;
   log(deleted?'Desktop file recycled':'Desktop file restored',`${file.folder}/${file.name}`);break;
  }
  case 'markDesktopMailRead': {
   if(typeof command.mailId!=='string'||!/^MAIL-[A-Za-z0-9_-]{1,120}$/.test(command.mailId)||typeof command.read!=='boolean')throw new Error('Invalid scenario-mail marker.');
   const d=s.desktop??emptyDesktop();
   s.desktop={...d,readMail:command.read?[...new Set([...d.readMail,command.mailId])]:d.readMail.filter(id=>id!==command.mailId)};
   const error=desktopStateError(s.desktop);if(error)throw new Error(error);break;
  }
  case 'startCareer': {
   if(command.confirmation!=='START TAKEOVER')throw new Error('Export the existing case and confirm START TAKEOVER before replacing it.');
   if(!Number.isInteger(command.seed)||command.seed<1||command.seed>2147483647||!CAREER_MONTHS.includes(command.startMonth)||!['financial-accountant','financial-manager'].includes(command.role)||!['supported','messy'].includes(command.scenario))throw new Error('Choose valid takeover settings.');
   const next=initialState(command.seed);
   next.career={version:1,startMonth:command.startMonth,activeMonth:command.startMonth,role:command.role,scenario:command.scenario,startedAt:now,closed:{},submissions:{},forecasts:{}};
   next.mode='exam';next.evidenceRequests=[];
   const c=companyForState(next);
   for(const row of c.bank.filter(r=>r.date<`${command.startMonth}-01`))if(row.journalId&&c.baseJournals.some(j=>j.id===row.journalId))next.bankMatches[row.id]=[row.journalId];
   next.auditLog=[{id:`EV-${now}`,at:now,action:'Takeover started',detail:`${command.startMonth}; ${command.role}; ${command.scenario}; seed ${command.seed}. Previous practice is retained only in an exported backup.`}];
   if(command.daily!==undefined&&typeof command.daily!=='boolean')throw new Error('Invalid daily-mode setting.');
   if(command.daily)enableWorkday(next);
   return next;
  }
  case 'saveCareerSubmission': {
   if(!s.career)throw new Error('Start a takeover first.');assertCareerOpenDate(s,`${command.submission?.month}-01`);
   const error=validateCareerSubmission(company,s,command.submission);if(error)throw new Error(error);
   s.career.submissions[careerKey(command.submission.month,command.submission.taskId)]={...command.submission,updatedAt:now};
   log('Role deliverable saved',`${command.submission.taskId}: ${command.submission.status}. Narrative quality is not independently assessed.`);break;
  }
  case 'saveCareerForecast': {
   if(!s.career)throw new Error('Start a takeover first.');assertCareerOpenDate(s,`${command.forecast?.month}-01`);
   const error=validateCareerForecast(company,s,command.forecast);if(error)throw new Error(error);
   s.career.forecasts[command.forecast.month]={...command.forecast,updatedAt:now};
   // A changed forecast reopens the linked liquidity recommendation, not unrelated submitted work.
   const recommendation=s.career.submissions[careerKey(s.career.activeMonth,'liquidity')];if(recommendation)recommendation.status='draft';
   log('Cash forecast saved',`${command.forecast.month}: ${command.forecast.status}`);break;
  }
  case 'submitMonthReview': {
   if(!s.career)throw new Error('Start a finance takeover before submitting a month.');
   if(s.career.closed[s.career.activeMonth])throw new Error('This month is closed. Reopen it before submitting another review.');
   const r=assessMonth(company,s),history=s.monthReviews??[];
   // Repeated clicks on unchanged saved work do not manufacture additional attempts.
   const last=history.at(-1);if(last?.month===r.month&&last.fingerprint===r.fingerprint)break;
   const receipt={id:`MR-${now.replace(/[^0-9]/g,'')}-${s.auditLog.length}`,month:r.month,at:now,fingerprint:r.fingerprint,passed:r.passed,total:r.total,blockers:r.blockers,warnings:r.warnings,manual:r.manual,issueIds:r.checks.filter(c=>c.blocking&&c.status!=='pass'||c.status==='warning').map(c=>c.id),feedbackRevealed:true};
   s.monthReviews=[...history,receipt].slice(-24);
   log('Month submitted for review',`${r.month}: ${r.passed}/${r.total} objective/completion checks pass; ${r.blockers} blockers. Answers shown; no posting, close or month advance.`);break;
  }
  case 'closeCareerMonth': {
   if(!s.career)throw new Error('Start a takeover first.');assertCareerOpenDate(s,`${s.career.activeMonth}-01`);
   if(typeof command.reason!=='string'||command.reason.trim().length<20||command.reason.length>1000)throw new Error('Document the close conclusion and unresolved qualitative matters (20–1,000 characters).');
   const failures=careerEvidenceChecks(company,s).filter(c=>c.remaining!==0);
   if(failures.length)throw new Error(`Resolve before closing: ${failures.map(c=>`${c.label} (${c.remaining})`).join(', ')}.`);
   s.career.closed[s.career.activeMonth]={month:s.career.activeMonth,at:now,reason:command.reason,assisted:s.revealed.length>0||s.journals.some(j=>j.origin==='solution')||!!s.monthReviews?.some(r=>r.feedbackRevealed),journalCount:s.journals.length};
   log('Takeover month closed',`${s.career.activeMonth}: ${command.reason}`);break;
  }
  case 'advanceCareerMonth': {
   if(!s.career||!s.career.closed[s.career.activeMonth])throw new Error('Close the active takeover month before advancing.');
   const next=CAREER_MONTHS[CAREER_MONTHS.indexOf(s.career.activeMonth)+1];
   if(!next)throw new Error('The 2025 takeover scenario is complete. Export your portfolio; no 2026 operating scenario has been generated.');
   s.career.activeMonth=next;if(s.workday&&s.workday.today<next+'-01')s.workday.today=next+'-01';log('Next takeover month released',next);break;
  }
  case 'reopenCareerMonth': {
   if(!s.career||!s.career.closed[s.career.activeMonth])throw new Error('Only the latest active closed month can be reopened.');
   if(typeof command.reason!=='string'||command.reason.trim().length<20||command.reason.length>1000)throw new Error('Record why this close is being reopened (20–1,000 characters).');
   delete s.career.closed[s.career.activeMonth];invalidateCareerMonth(s);
   log('Takeover month reopened',`${s.career.activeMonth}: ${command.reason}`);break;
  }

  case 'postJournal': add({...command.journal,origin:'learner',reverses:undefined});log('Journal posted',`${command.journal.id} · ${command.journal.description}`);break;
  case 'importJournals':if(!Array.isArray(command.journals)||command.journals.length<1||command.journals.length>200)throw new Error('Import between 1 and 200 journals at a time.');for(const j of command.journals)add({...j,origin:'learner',reverses:undefined});log('Journals imported',`${command.journals.length} journals validated and posted as one batch`);break;
  case 'captureSourceInvoice': {
   const d=company.documents.find(d=>d.id===command.documentId);
   if(!d||!['Sales invoice','Supplier invoice','Credit note','Supplier credit note'].includes(d.kind))throw new Error('Choose an existing invoice or credit note.');
   const sales=d.kind==='Sales invoice'||d.kind==='Credit note',code=sales?'1100':'2000';
   const recorded=sum(journalsFor(company,s).filter(j=>j.sourceId===d.id&&!j.lines.some(l=>l.account==='1000')).flatMap(j=>j.lines.filter(l=>l.account===code).map(l=>l.debit-l.credit)));
   if(recorded!==0)throw new Error('This source invoice is already recorded. Reverse an incorrect capture before replacing it; record settlements separately.');
   if(command.journal.sourceId!==d.id||command.journal.date!==d.date)throw new Error('Capture must retain the source invoice reference and issue date.');
   if(command.journal.lines.some(l=>l.account==='1000')||!command.journal.lines.some(l=>l.account===code))throw new Error('Capture the invoice through its customer or supplier control; process bank settlement separately.');
   add({...command.journal,origin:'learner',reverses:undefined});log('Source invoice captured',d.id);break;
  }
  case 'postDocument': {
   const d=command.document;if(s.customDocuments.length>=1000)throw new Error('This case has reached the document limit.');const expectedLines=invoiceJournalLines(d,company);
   if([...company.documents,...s.customDocuments].some(x=>x.id===d.id))throw new Error('This document reference already exists.');
   for(const l of d.lines)if(!Number.isFinite(l.quantity)||l.quantity<=0||!Number.isSafeInteger(l.unitPrice)||l.unitPrice<0||!Number.isSafeInteger(l.net)||l.net!==Math.round(l.quantity*l.unitPrice)||!Number.isSafeInteger(l.tax)||l.tax<0||l.tax>l.net||typeof l.description!=='string'||l.description.length>500)throw new Error('Invoice line calculations do not agree.');
   if(sum(d.lines.map(l=>l.net))!==d.net||sum(d.lines.map(l=>l.tax))!==d.tax||d.net+d.tax!==d.total)throw new Error('Invoice totals do not agree.');
   if(command.journal.sourceId!==d.id||command.journal.date!==d.date||d.journalIds[0]!==command.journal.id)throw new Error('Journal and document dates and references must agree.');
   const proposed=aggregateLines([command.journal]),expected=aggregateLines([{...command.journal,lines:expectedLines}]);if([...new Set([...Object.keys(proposed),...Object.keys(expected)])].some(k=>(proposed[k]??0)!==(expected[k]??0)))throw new Error('The journal does not match the invoice accounts, tax or counterparty.');
   const actualTags=inventoryTags(command.journal.lines),expectedTags=inventoryTags(expectedLines);if([...new Set([...Object.keys(actualTags),...Object.keys(expectedTags)])].some(k=>(actualTags[k]??0)!==(expectedTags[k]??0)))throw new Error('Inventory item labels do not agree with the invoice.');
   s.customDocuments.push(d);add({...command.journal,origin:'learner'});log('Invoice created',`${d.id} · ${d.party}`);break;
  }
  case 'reverseJournal':{const original=s.journals.find(j=>j.id===command.journalId);if(!original)throw new Error('Only your practice journals can be reversed.');if(command.date<original.date)throw new Error('A reversal cannot precede the original journal.');if(s.journals.some(j=>j.reverses===original.id))throw new Error('This journal has already been reversed.');if(!command.reason.trim()||command.reason.length>400)throw new Error('Add a short reversal reason.');if((s.allocations??[]).some(a=>a.sourceJournalId===original.id||a.invoiceId===original.sourceId))throw new Error('Remove the linked credit allocation before reversing this journal.');if(Object.values(s.bankMatches).flat().includes(original.id))throw new Error('Unmatch this bank transaction before reversing it.');const reversal:Journal={...original,id:`REV-${now.replace(/[^0-9]/g,'')}-${s.journals.length}`,date:command.date,description:`Reversal: ${command.reason}`,lines:original.lines.map(l=>({...l,debit:l.credit,credit:l.debit})),reverses:original.id,origin:'learner'};add(reversal);log('Journal reversed',`${original.id} · ${command.reason}`);break;}
  case 'reverseJournalBatch':{if(!Array.isArray(command.journalIds)||!command.journalIds.length||command.journalIds.length>50||new Set(command.journalIds).size!==command.journalIds.length)throw new Error('Choose between 1 and 50 unique journals to reverse.');let next=s;for(const journalId of command.journalIds)next=applyCommand(next,{type:'reverseJournal',journalId,date:command.date,reason:command.reason},now);return next;}
  case 'saveBalanceReconciliation':{const r=command.reconciliation;assertCareerOpenDate(s,r?.asOf??'');validBalanceReconciliation(r,company,s);const key=`${r.account}|${r.asOf}`;if(Object.keys(s.balanceReconciliations??{}).length>=120&&!s.balanceReconciliations?.[key])throw new Error('This case has reached the saved reconciliation limit.');s.balanceReconciliations={...(s.balanceReconciliations??{}),[key]:{...r,updatedAt:now}};log('Balance reconciliation saved',`${r.account} · ${r.asOf}`);break;}
  case 'saveJournalTemplate':{validJournalTemplate(command.template,company);const templates=journalTemplates(s);if(templates.length>=100&&!templates.some(t=>t.id===command.template.id))throw new Error('The case has reached the template limit.');s.journalTemplates=[...templates.filter(t=>t.id!==command.template.id),{...command.template,updatedAt:now}];log('Journal template saved',command.template.name);break;}
  case 'deleteJournalTemplate':{s.journalTemplates=journalTemplates(s).filter(t=>t.id!==command.templateId);log('Journal template removed',command.templateId);break;}
  case 'applySolution':{if(s.mode==='exam')throw new Error('Worked answers are hidden in exam mode.');const e=company.exercises.find(e=>e.id===command.exerciseId);if(!e)throw new Error('Exercise was not found.');if(s.career&&e.expected.some(j=>j.date.slice(0,7)!==s.career!.activeMonth))throw new Error('Worked postings are limited to the active takeover month.');if(gradeExercise(e,s).correct)throw new Error('This exercise is already correct.');if(Object.keys(aggregateLines(gradeExercise(e,s).posted)).length)throw new Error('Reverse your active attempt before posting the worked answer.');for(const j of e.expected)add({...j,id:`SOL-${j.id}-${s.journals.length}`,origin:'solution'});if(!s.revealed.includes(e.id))s.revealed.push(e.id);log('Worked answer posted',e.title);break;}
  case 'reveal':{if(s.mode==='exam')throw new Error('Hints and answers are hidden in exam mode.');if(!company.exercises.some(e=>e.id===command.exerciseId))throw new Error('Unknown exercise.');if(!s.revealed.includes(command.exerciseId))s.revealed.push(command.exerciseId);log('Answer revealed',command.exerciseId);break;}
  case 'attempt':{if(!company.exercises.some(e=>e.id===command.exerciseId))throw new Error('Unknown exercise.');s.attempts[command.exerciseId]=(s.attempts[command.exerciseId]??0)+1;log('Exercise checked',command.exerciseId);break;}
  case 'matchBank':{if(s.career){const row=company.bank.find(r=>r.id===command.bankId);assertCareerOpenDate(s,row?.date??'');invalidateCareerMonth(s);}if(s.periodLocked)throw new Error('Reopen December before changing its reconciliation.');const row=company.bank.find(r=>r.id===command.bankId);if(!row)throw new Error('Bank transaction not found.');if(s.bankMatches[row.id])throw new Error('This bank transaction is already matched.');if(!Array.isArray(command.journalIds)||!command.journalIds.length||command.journalIds.length>100||new Set(command.journalIds).size!==command.journalIds.length)throw new Error('Select one or more unique cash-book journals.');const js=journalsFor(company,s),used=new Set(Object.values(s.bankMatches).flat()),selected=command.journalIds.map(id=>js.find(j=>j.id===id));if(selected.some(j=>!j||used.has(j.id)||bankAmount(j)===0))throw new Error('A selected journal is missing, already matched, or has no bank movement.');if(sum((selected as Journal[]).map(bankAmount))!==row.amount)throw new Error('Selected cash-book amounts do not equal the bank transaction.');s.bankMatches[row.id]=command.journalIds;log('Bank transaction matched',`${row.id} → ${command.journalIds.join(', ')}`);break;}
  case 'unmatchBank':if(s.career){const row=company.bank.find(r=>r.id===command.bankId);assertCareerOpenDate(s,row?.date??'');invalidateCareerMonth(s);}if(s.periodLocked)throw new Error('Reopen December before changing its reconciliation.');delete s.bankMatches[command.bankId];log('Bank match removed',command.bankId);break;
  case 'matchBankBatch':{if(s.career){if(!Array.isArray(command.matches))throw new Error('Invalid bank batch.');for(const m of command.matches){const row=company.bank.find(r=>r.id===m.bankId);assertCareerOpenDate(s,row?.date??'');}invalidateCareerMonth(s);}if(s.periodLocked)throw new Error('Reopen December before changing its reconciliation.');if(!Array.isArray(command.matches)||!command.matches.length||command.matches.length>150)throw new Error('Choose between 1 and 150 bank matches.');const js=journalsFor(company,s),used=new Set(Object.values(s.bankMatches).flat());for(const m of command.matches){const row=company.bank.find(r=>r.id===m.bankId);if(!row||s.bankMatches[m.bankId])throw new Error('A statement line is missing or already matched.');if(!Array.isArray(m.journalIds)||!m.journalIds.length||m.journalIds.length>100||new Set(m.journalIds).size!==m.journalIds.length)throw new Error('Each bank match needs unique journal IDs.');const selected=m.journalIds.map(id=>js.find(j=>j.id===id));if(selected.some(j=>!j||used.has(j.id)||bankAmount(j)===0))throw new Error('A cash-book entry is missing, has no bank movement or is used more than once.');if(sum((selected as Journal[]).map(bankAmount))!==row.amount)throw new Error('One of the selected matches does not balance.');s.bankMatches[m.bankId]=m.journalIds;for(const id of m.journalIds)used.add(id);}log('Bank batch matched',`${command.matches.length} statement lines matched after review`);break;}
  case 'allocateCredit':{assertCareerOpenDate(s,command.allocation?.date??'');invalidateCareerMonth(s);if(s.periodLocked&&command.allocation.date<='2025-12-31')throw new Error('Reopen December before changing its allocations.');if((s.allocations??[]).length>=2000)throw new Error('The case has reached the allocation limit.');const err=allocationError(command.allocation,company,s);if(err)throw new Error(err);s.allocations=[...(s.allocations??[]),{...command.allocation,createdAt:now}];for(const w of Object.values(s.workpapers))w.reviewed=false;log('Credit allocated',`${command.allocation.sourceJournalId} → ${command.allocation.invoiceId}`);break;}
  case 'removeAllocation':{const allocation=s.allocations?.find(a=>a.id===command.allocationId);if(!allocation)throw new Error('Allocation not found.');assertCareerOpenDate(s,allocation.date);invalidateCareerMonth(s);if(s.periodLocked&&allocation.date<='2025-12-31')throw new Error('Reopen December before changing its allocations.');s.allocations=s.allocations?.filter(a=>a.id!==allocation.id);for(const w of Object.values(s.workpapers))w.reviewed=false;log('Credit allocation removed',`${allocation.sourceJournalId} → ${allocation.invoiceId}`);break;}
  case 'saveEvidenceRequest':{validEvidenceRequest(command.request,company,s);const requests=evidenceRequests(s);if(requests.length>=150&&!requests.some(r=>r.id===command.request.id))throw new Error('This case has reached the evidence request limit.');s.evidenceRequests=[...requests.filter(r=>r.id!==command.request.id),{...command.request,updatedAt:now}].sort((a,b)=>a.id.localeCompare(b.id));log('Evidence request updated',`${command.request.id} · ${command.request.status}`);break;}
  case 'saveDisclosure':validDisclosure(command.disclosure);s.disclosures={...(s.disclosures??{}),[command.disclosure.id]:{...command.disclosure,updatedAt:now}};log('Financial statement note saved',`Note ${command.disclosure.id}`);break;
  case 'saveWorkpaper':validWorkpaper(command.workpaper);s.workpapers[command.workpaper.id]={...command.workpaper,updatedAt:now};log('Workpaper saved',command.workpaper.id);break;
  case 'checkTask':if(typeof command.taskId!=='string'||command.taskId.length>100)throw new Error('Invalid task.');s.taskChecks[command.taskId]=!!command.checked;log('Close checklist updated',command.taskId);break;
  case 'lockPeriod':if(s.career)throw new Error('Use the takeover month-end gates on Your finance desk.');if(!command.reason.trim()||command.reason.length>500)throw new Error('Add a reason for the period status change.');if(command.locked){const failing=integrityChecks(company,s).filter(c=>c.difference!==0);if(failing.length)throw new Error(`Resolve before locking: ${failing.map(c=>c.name).join(', ')}.`);if(!bankReconciliation(company,s).complete)throw new Error('Finish matching and reconciling the December bank statement before locking.');}s.periodLocked=command.locked;s.lockDate=command.locked?now:undefined;log(command.locked?'Period locked':'Period reopened',command.reason);break;
  case 'saveNotes':if(typeof command.notes!=='string'||command.notes.length>30000)throw new Error('Keep notebook text under 30,000 characters.');s.notes=command.notes;log('Notebook saved','Practice notebook updated');break;
  case 'setMode':if(!['guided','exam'].includes(command.mode))throw new Error('Invalid practice mode.');s.mode=command.mode;log('Practice mode changed',command.mode);break;
  case 'newCase':if(!Number.isInteger(command.seed)||command.seed<1||command.seed>2147483647)throw new Error('Use a seed from 1 to 2,147,483,647.');return {...initialState(command.seed),auditLog:[{id:`EV-${now}`,at:now,action:'New case generated',detail:`Seed ${command.seed}. Previous case must be retained in an exported backup.`}]};
  case 'importBackup':{const err=validateBackup(command.state);if(err)throw new Error(err);return {...structuredClone(command.state),auditLog:[...command.state.auditLog,{id:`EV-${now}`,at:now,action:'Backup restored',detail:'State restored from an imported LedgerLab backup.'}]};}
  default:throw new Error('Unknown workspace action.');
 }
 if(s.workday)syncDayCompletions(s);
 return s;
}
