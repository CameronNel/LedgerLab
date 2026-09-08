import type {PracticeCompany,PracticeState} from './types';
import {subledger} from './engine';
import {sum} from './money';

export function statementReconciliations(company:PracticeCompany,state:PracticeState,kind:'customer'|'supplier',asOf='2025-12-31') {
 return subledger(company,state,kind,asOf).contacts.map(contact=>{
  const statement=company.documents.find(d=>d.id===`STMT-${contact.contact.id}-${asOf.slice(0,7)}`)!;
  const external=new Map(statement.lines.filter(l=>!l.description.startsWith('Unapplied')).map(l=>[l.description.split(' | ')[0],l.net]));
  const rows=contact.invoices.filter(i=>external.has(i.document.id)||i.open!==0||i.unposted).map(i=>({id:i.document.id,document:i.document,external:external.get(i.document.id)??0,ledger:i.open,difference:i.open-(external.get(i.document.id)??0),reason:i.unposted?'Invoice not recorded':i.allocated?'Credit allocation / statement timing':i.open!==(external.get(i.document.id)??0)?'Investigate invoice or settlement':'Agreed'}));
  const externalOnAccount=Number(statement.metadata?.onAccount??0),onAccountDifference=contact.onAccount-externalOnAccount,difference=contact.balance-statement.total;
  return {...contact,statement,rows,externalOnAccount,onAccountDifference,difference,componentDifference:sum(rows.map(r=>r.difference))+onAccountDifference};
 });
}
