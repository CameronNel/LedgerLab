import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {companyForState} from '../../lib/accounting/career';
import {careerPortfolioHTML} from '../../lib/accounting/career-exports';
import {initialState,journalsFor,validateBackup} from '../../lib/accounting/engine';
import {sourcePack,documentHTML,journalCSV,trialBalanceCSV,bankCSV,payrollCSV,financialStatementsHTML} from '../../lib/accounting/exports';
import {financialReportData} from '../../lib/accounting/financial-notes';
const args=process.argv.slice(2),arg=(name:string,fallback:string)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1];};
const backupPath=arg('--backup',''),backup=backupPath?JSON.parse(readFileSync(resolve(backupPath),'utf8')):null,restored=backup?.state??backup;
if(restored){const error=validateBackup(restored);if(error)throw new Error(error);}
const seed=restored?.seed??Number(arg('--seed','271828')),out=resolve(arg('--out','output/accounting')),includeAnswers=args.includes('--answers');
if(!Number.isInteger(seed)||seed<1||seed>2147483647)throw new Error('Seed must be an integer from 1 to 2147483647.');
const s=restored??initialState(seed),c=companyForState(s),month=s.career?.activeMonth??'2025-12';mkdirSync(out,{recursive:true});
writeFileSync(join(out,`LedgerLab-source-pack-${seed}.zip`),sourcePack(c,s,month,includeAnswers));
writeFileSync(join(out,'case-source.json'),JSON.stringify({seed:c.seed,name:c.name,currency:c.currency,year:c.year,period:c.period,contacts:c.contacts,documents:[...c.documents,...s.customDocuments],bank:c.bank,employees:c.employees,payroll:c.payroll,assets:c.assets,inventory:c.inventory,opening:c.opening,budget:c.budget,exercises:c.exercises.map(({expected,reasoning,hints,...e})=>includeAnswers?{...e,expected,reasoning,hints}:e)},null,2));
writeFileSync(join(out,s.journals.length?'learner-ledger.csv':'unadjusted-ledger.csv'),journalCSV(journalsFor(c,s)));
writeFileSync(join(out,s.journals.length?'learner-trial-balance.csv':'unadjusted-trial-balance.csv'),trialBalanceCSV(journalsFor(c,s)));
for(let m=1;m<=Number(month.slice(5,7));m++){const month=`2025-${String(m).padStart(2,'0')}`;writeFileSync(join(out,`bank-${month}.csv`),bankCSV(c,month));writeFileSync(join(out,`payroll-${month}.csv`),payrollCSV(c,month));}
writeFileSync(join(out,'learner-financial-statements.html'),financialStatementsHTML(c,s));
writeFileSync(join(out,'financial-report-data.json'),JSON.stringify(financialReportData(c,s),null,2));
if(includeAnswers){const worked=initialState(seed);if(s.career)worked.career=structuredClone(s.career);worked.journals=c.exercises.flatMap(e=>e.expected.map(j=>({...j,id:'WORKED-'+j.id,origin:'solution' as const})));writeFileSync(join(out,'worked-financial-statements.html'),financialStatementsHTML(c,worked));writeFileSync(join(out,'worked-financial-report-data.json'),JSON.stringify({...financialReportData(c,worked),mode:'Worked numerical example; disclosure evidence gaps remain open'},null,2));writeFileSync(join(out,'solution-ledger.csv'),journalCSV([c.opening,...c.solutionJournals]));writeFileSync(join(out,'solution-trial-balance.csv'),trialBalanceCSV([c.opening,...c.solutionJournals]));}
if(s.career)writeFileSync(join(out,'finance-takeover-portfolio.html'),careerPortfolioHTML(c,s));
console.log(`Generated seed ${seed}: ${c.documents.length+s.customDocuments.length} documents, ${c.bank.length} bank movements, ${c.exercises.length} exercises. Output: ${out}`);
