import assert from 'node:assert/strict';
import {generateCompany} from '../../lib/accounting/generator';
import {initialState, journalsFor, financialPosition, cashFlow, integrityChecks, applyCommand, gradeExercise, subledger, bankAmount, bankReconciliation, journalError} from '../../lib/accounting/engine';
import {sum} from '../../lib/accounting/money';
let checks=0;function check(value:unknown,message:string){assert.ok(value,message);checks++;}
for(const seed of [1,7,42,271828,999999]){
 const c=generateCompany(seed),s=initialState(seed),all=[c.opening,...c.solutionJournals];
 check(c.solutionJournals.length>600,'Full-year transaction coverage');
 for(const j of all)check(sum(j.lines.map(l=>l.debit-l.credit))===0,`${seed}: ${j.id} is balanced`);
 check(new Set(all.map(j=>j.id)).size===all.length,'Unique journals');
 check(new Set(c.documents.map(d=>d.id)).size===c.documents.length,'Unique source document IDs');
 check(all.every(j=>j.lines.every(l=>Number.isSafeInteger(l.debit)&&Number.isSafeInteger(l.credit)&&l.debit>=0&&l.credit>=0)),`Nonnegative cents: seed ${seed}`);
 for(const d of c.documents.filter(d=>['Sales invoice','Supplier invoice'].includes(d.kind)))check(d.net+d.tax===d.total&&sum(d.lines.map(l=>l.net))===d.net&&sum(d.lines.map(l=>l.tax))===d.tax,`Invoice totals ${d.id}`);
 for(const rows of Object.values(c.payroll))for(const p of rows)check(p.gross-p.withholding-p.deductions===p.net&&p.gross===p.salary+p.allowance+p.overtime,'Payroll recalculation');
 check(financialPosition(all).difference===0,'Solution accounting equation');
 const cf=cashFlow(all);check(cf.difference===0,'Direct cash flow rollforward');check(cf.operatingDifference===0,`Indirect cash flow agreement ${seed}: ${cf.operatingDifference}`);
 check(subledger(c,s,'customer','2025-12-31','solution').difference===0,'AR control');check(subledger(c,s,'supplier','2025-12-31','solution').difference===0,'AP control');
 let balance=21000000;for(const row of c.bank){balance+=row.amount;check(balance===row.balance,'Statement running balances');}
 check(sum(all.map(bankAmount))-balance===180000,'Exactly $1,800 deposit in transit');
 let worked=s;for(const e of c.exercises){worked=applyCommand(worked,{type:'applySolution',exerciseId:e.id},'2026-09-06T23:00:00Z');check(gradeExercise(e,worked).correct,`Worked answer grades correctly ${e.id}`);}
 const issues=integrityChecks(c,worked).filter(c=>c.difference!==0);check(issues.length===0,`All final controls: ${JSON.stringify(issues)}`);
 check(financialPosition(journalsFor(c,worked)).assets===financialPosition(all).assets,'Worked answers recreate solution balances');
 const invalid={...c.exercises[0].expected[0],id:'UNBALANCED',lines:[{account:'1000',debit:100,credit:0},{account:'4000',debit:0,credit:99}]};check(!!journalError(invalid,c),'Unbalanced postings blocked');
 check(!!journalError({...invalid,lines:[{account:'1100',debit:100,credit:0},{account:'4000',debit:0,credit:100}]},c),'Receivables require a customer');
}
console.log(`PASS: ${checks.toLocaleString()} accounting checks across five independently generated cases.`);
