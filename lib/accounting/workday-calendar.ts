import type {PracticeCompany, PracticeState, SourceDocument, Journal} from './types';
import {addDays, monthEnd} from './money';
const fullScenario=new WeakMap<PracticeCompany,PracticeCompany>();
/** Preserve the independent key for internal assessors without rebuilding from a historically scoped state. */
export const unprojectWorkdayCompany=(company:PracticeCompany)=>fullScenario.get(company)??company;

export function validScenarioDate(date: unknown): date is string {
  if (typeof date !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + 'T12:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
export const isWorkingDay = (date: string) => ![0, 6].includes(new Date(date + 'T12:00:00Z').getUTCDay());
/** Fictional internal Monday-Friday calendar. No jurisdictional holiday or tax-calendar inference. */
export function businessDay(date: string): string {
  while (!isWorkingDay(date)) date = addDays(date, 1);
  return date;
}
export function addBusinessDays(date: string, days: number): string {
  const step = days < 0 ? -1 : 1;
  for (let i = 0; i < Math.abs(days);) { date = addDays(date, step); if (isWorkingDay(date)) i++; }
  return date;
}
export function priorBusinessDay(date: string): string {
  while (!isWorkingDay(date)) date = addDays(date, -1);
  return date;
}
export const closePackDate = (month: string) => addBusinessDays(monthEnd(month), 1);
export const workdayLimit = (month: string) => addBusinessDays(monthEnd(month), 10);
export const bankAvailableOn = (date: string) => addBusinessDays(date, 1);
export const formatDay = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
export const asOfDate = (state: PracticeState, month = state.career?.activeMonth ?? '2025-12') => state.workday ? [state.workday.today, monthEnd(month)].sort()[0] : monthEnd(month);

/** A document's issue/effective date and the date it reaches finance are intentionally separate. */
export function documentAvailableOn(doc: SourceDocument, state: PracticeState): string {
  if (!state.workday || !state.career) return doc.date;
  const start = state.career.startMonth + '-01', month = doc.date.slice(0, 7);
  if (doc.date < start) return doc.date; // The inherited archive is already on the desk.
  if (typeof doc.metadata?.availableOn === 'string') return doc.metadata.availableOn;
  if (doc.kind === 'Payroll register' || doc.kind === 'Payslip' || /^HR-/.test(doc.id)) return priorBusinessDay(month + '-23');
  if (['Bank statement', 'Supplier statement', 'Customer statement'].includes(doc.kind) || /^FA-REGISTER-20/.test(doc.id)) return closePackDate(month);
  if (doc.kind === 'Supplier invoice' || doc.kind === 'Supplier credit note') return addBusinessDays(doc.date, 1);
  return doc.date;
}
export function taskSchedule(id: string, month: string, startMonth: string): {release: string; due: string} {
  if (id === 'handover') return {release: startMonth+'-01', due: addBusinessDays(startMonth+'-01', 3)};
  if (id === 'investment') return {release: businessDay(month+'-07'), due: businessDay(month+'-20')};
  const offset = ({bank:2,payroll:2,receivables:3,payables:3,inventory:3,assets:4,cutoff:4,tax:4,controls:4,reporting:5,liquidity:5,afs:7,auditPack:7} as Record<string,number>)[id] ?? 5;
  return {release: closePackDate(month), due: addBusinessDays(monthEnd(month), offset)};
}
export function sourceIsAvailable(company: PracticeCompany, state: PracticeState, id: string): boolean {
  if (!state.workday) return [...company.documents, ...state.customDocuments].some(d => d.id === id);
  if (/^BANK-2025-\d{2}$/.test(id) && id.slice(5) <= (state.career?.activeMonth ?? '') && id.slice(5)+'-01' <= state.workday.today) return true; // As-of bank extract exists, even before its first movement.
  const doc = [...company.documents, ...state.customDocuments].find(d => d.id === id);
  return !!doc && documentAvailableOn(doc,state) <= state.workday.today;
}
export function journalAvailableOn(journal: Journal, company: PracticeCompany, state: PracticeState): string {
  const doc = company.documents.find(d => d.id === journal.sourceId);
  let date = journal.date;
  if (doc && !doc.id.startsWith('BANK-')) date = [date,documentAvailableOn(doc,state)].sort().at(-1)!;
  const bankRow = company.bank.find(r => r.journalId === journal.id);
  if (bankRow) date = [date,bankAvailableOn(bankRow.date)].sort().at(-1)!;
  return date;
}

/** Remove unreleased actuals from every UI/export consumer, not just from Explorer. The full independent key remains separate. */
export function projectWorkdayCompany(company: PracticeCompany, state: PracticeState): PracticeCompany {
  if (!state.workday || !state.career) return company;
  const today = state.workday.today, start = state.career.startMonth+'-01', active = state.career.activeMonth;
  const bank = company.bank.filter(r => r.date < start || bankAvailableOn(r.date) <= today);
  const documents = company.documents.filter(d => documentAvailableOn(d,state) <= today).map(d => {
    if (d.date < start) return d;
    return {...d, journalIds: d.journalIds.filter(id => company.solutionJournals.some(j => j.id===id && journalAvailableOn(j,company,state)<=today)), notes:d.notes.map(n=>d.id.startsWith('CEO-')?n.replace('Report by calendar day five after month-end','Report by working day five after month-end'):n),metadata:{...d.metadata, availableOn:documentAvailableOn(d,state)}};
  });
  // Before the signed monthly statement arrives, supply a strictly as-of transaction extract under the bank source reference.
  if (today < closePackDate(active)) {
    const original = company.documents.find(d => d.id===`BANK-${active}`);
    if (original) {
      const rows = bank.filter(r=>r.date.startsWith(active));
      const opening = Number(original.metadata?.opening ?? original.total-original.net);
      const closing = rows.at(-1)?.balance ?? opening;
      documents.push({...original,date:asOfDate(state),title:`Operating bank extract available on ${today} (not the month-end statement)`,
        net:closing-opening,total:closing,journalIds:rows.flatMap(r=>r.journalId?[r.journalId]:[]),
        notes:[`As-of extract delivered on ${today}. Bank movements arrive on the following working day. It contains only the ${rows.length} lines available now.`,
          `Opening statement balance AUD ${(opening/100).toFixed(2)}; last available balance AUD ${(closing/100).toFixed(2)}.`,
          `The complete ${active} statement is delivered on ${closePackDate(active)}. Do not treat this partial extract as a completed month-end reconciliation.`],
        metadata:{opening,closing,transactionCount:rows.length,availableOn:today,partial:1,asOf:today}});
    }
  }
  const availableIds = new Set(documents.map(d=>d.id));
  const solutionJournals = company.solutionJournals.filter(j => j.date < start || journalAvailableOn(j,company,state) <= today);
  const expectedIds = new Set(solutionJournals.map(j=>j.id));
  const exercises = company.exercises.map(ex => ({...ex, expected:ex.expected.filter(j=>expectedIds.has(j.id)),documents:ex.documents.filter(id=>availableIds.has(id))})).filter(ex=>ex.expected.length);
  const inventory = company.inventory.map(item => ({...item,
    bought:item.bought.map((v,i)=>{const month=`2025-${String(i+1).padStart(2,'0')}`;if(month<start.slice(0,7)||closePackDate(month)<=today)return v;return documents.filter(d=>d.date.startsWith(month)&&d.kind==='Supplier invoice').reduce((n,d)=>n+d.lines.filter(l=>l.itemId===item.id).reduce((s,l)=>s+l.quantity,0),0);}),
    sold:item.sold.map((v,i)=>{const month=`2025-${String(i+1).padStart(2,'0')}`;if(month<start.slice(0,7)||closePackDate(month)<=today)return v;return documents.filter(d=>d.date.startsWith(month)&&['Sales invoice','Credit note'].includes(d.kind)).reduce((n,d)=>n+(d.kind==='Credit note'?-1:1)*d.lines.filter(l=>l.itemId===item.id).reduce((s,l)=>s+l.quantity,0),0);}),
    countVariance:availableIds.has('COUNT-2025')?item.countVariance:0,nrv:availableIds.has('COUNT-2025')?item.nrv:item.price}));
  const projected={...company,documents,bank,solutionJournals,exercises,inventory,
    assets:company.assets.filter(a=>a.purchaseDate<start || a.purchaseDate<=today&&(!a.documentId||availableIds.has(a.documentId))),
    payroll:Object.fromEntries(Object.entries(company.payroll).filter(([month])=>month<state.career!.startMonth||availableIds.has(`PAY-${month}`)))};
  fullScenario.set(projected,company);return projected;
}
