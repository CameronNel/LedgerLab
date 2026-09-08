import React from 'react';
import {createNotebookDraft} from '../../lib/workspace/notebook-draft';
import assert from 'node:assert/strict';
import {renderToString} from 'react-dom/server';
import {TooltipProvider} from '../../components/ui/tooltip';
import {WorkspaceContext,type WorkspaceContextValue} from '../../components/ledgerlab/context';
import {Overview,PracticeView,DocumentsView,LedgerView} from '../../components/ledgerlab/core-views';
import {SubledgerView,BankView} from '../../components/ledgerlab/reconciliation-views';
import {PayrollView,AssetsView,InventoryView} from '../../components/ledgerlab/schedule-views';
import {TaxView,ProvisionsView} from '../../components/ledgerlab/tax-provisions';
import {ReportsView} from '../../components/ledgerlab/reports';
import {CloseView,AuditView} from '../../components/ledgerlab/close-audit';
import {KnowledgeView} from '../../components/ledgerlab/knowledge';
import {SettingsView} from '../../components/ledgerlab/settings';
import {FinancialNotesView} from '../../components/ledgerlab/financial-notes';
import {StatementReconciliation,CreditAllocations} from '../../components/ledgerlab/statement-reconciliation';
import {EvidenceRequestsView} from '../../components/ledgerlab/evidence-requests';
import {BalanceReconciliationView} from '../../components/ledgerlab/balance-reconciliation';
import {JournalPreparationView} from '../../components/ledgerlab/journal-preparation';
import {generateCompany} from '../../lib/accounting/generator';
import {initialState,journalsFor,applyCommand} from '../../lib/accounting/engine';
import {companyForState} from '../../lib/accounting/career';
import {CareerView,CareerCloseView} from '../../components/ledgerlab/career';
const company=generateCompany(),fresh=initialState(),worked=initialState();worked.journals=company.exercises.flatMap(e=>e.expected.map(j=>({...j,id:'RENDER-'+j.id,origin:'solution' as const})));
const legacy=initialState();delete legacy.allocations;delete legacy.disclosures;delete legacy.evidenceRequests;delete legacy.journalTemplates;delete legacy.balanceReconciliations;
const screens=[<CareerView/>,<Overview/>,<PracticeView/>,<DocumentsView/>,<LedgerView/>,<SubledgerView kind="customer"/>,<SubledgerView kind="supplier"/>,<BankView/>,<PayrollView/>,<AssetsView/>,<InventoryView/>,<TaxView/>,<ProvisionsView/>,<ReportsView/>,<CloseView/>,<AuditView/>,<KnowledgeView/>,<SettingsView/>,<FinancialNotesView to="2025-12-31"/>,<StatementReconciliation kind="customer"/>,<StatementReconciliation kind="supplier"/>,<CreditAllocations kind="customer"/>,<CreditAllocations kind="supplier"/>,<EvidenceRequestsView/>,<JournalPreparationView/>,<BalanceReconciliationView/>];
let count=0;
for(const state of [fresh,worked,legacy]){
 const noop=()=>{};const context:WorkspaceContextValue={company,state,journals:journalsFor(company,state),saving:false,loaded:true,send:async()=>true,go:noop,view:'overview',month:'2025-12',setMonth:noop,openJournal:noop,openDocument:noop,openExercise:noop,inspectJournal:noop,reload:noop,notebook:createNotebookDraft(state.seed,state.notes),editNotebook:noop,resolveNotebook:noop};
 for(const screen of screens){const html=renderToString(<WorkspaceContext.Provider value={context}><TooltipProvider>{screen}</TooltipProvider></WorkspaceContext.Provider>);assert.ok(html.length>100,'Screen renders meaningful content');assert.ok(!html.includes('NaN'),'Screen has no invalid numeric output');count++;}
}
for(const month of ['2025-01','2025-07','2025-12'])for(const processed of [false,true]){
 const state=applyCommand(initialState(42),{type:'startCareer',seed:42,startMonth:month,role:'financial-manager',scenario:'messy',confirmation:'START TAKEOVER'});
 const company=companyForState(state);
 if(processed)state.journals=company.exercises.flatMap(e=>e.expected.map(j=>({...j,id:'SSR-'+j.id,origin:'learner' as const})));
 const noop=()=>{},context:WorkspaceContextValue={company,state,journals:journalsFor(company,state),saving:false,loaded:true,send:async()=>true,go:noop,view:'career',month,setMonth:noop,openJournal:noop,openDocument:noop,openExercise:noop,inspectJournal:noop,reload:noop,notebook:createNotebookDraft(state.seed,state.notes),editNotebook:noop,resolveNotebook:noop};
 const takeoverScreens=[<CareerView/>,<CareerCloseView/>,<DocumentsView/>,<LedgerView/>,<SubledgerView kind="customer"/>,<SubledgerView kind="supplier"/>,<BankView/>,<PayrollView/>,<AssetsView/>,<InventoryView/>,<ReportsView/>,<SettingsView/>,<FinancialNotesView to={month+'-31'}/>,<StatementReconciliation kind="customer"/>,<StatementReconciliation kind="supplier"/>,<BalanceReconciliationView/>];
 for(const screen of takeoverScreens){const html=renderToString(<WorkspaceContext.Provider value={context}><TooltipProvider>{screen}</TooltipProvider></WorkspaceContext.Provider>);assert.ok(html.length>100,'Takeover screen renders meaningful content');assert.ok(!html.includes('NaN'),'Takeover screen has no invalid numeric output');count++;}
}
console.log(`PASS: ${count} component renders across fresh, worked, backward-compatible and takeover states. This checks rendering logic, not browser interaction.`);
