/** Shared information architecture for the classic sidebar, desktop and search. */
export const WORKSTATION_VERSION = '3.2.0';
export const WORKSPACE_SECTIONS = [
    { id: 'today', name: 'Today', description: 'Priorities, correspondence and assignments' },
    { id: 'work', name: 'Work', description: 'Record transactions and reconcile the books' },
    { id: 'close', name: 'Close', description: 'Prepare, review and close the period' },
    { id: 'reports', name: 'Reports', description: 'Explain the numbers' },
    { id: 'files', name: 'Files', description: 'Evidence and supporting work' },
    { id: 'learn', name: 'Learn', description: 'Guidance and targeted practice' },
    { id: 'settings', name: 'Settings', description: 'Case setup, notebook and backups' },
] as const;
export type WorkspaceSection = typeof WORKSPACE_SECTIONS[number]['id'];
export type WorkspaceApp = {
    id: string;
    name: string;
    short: string;
    section: WorkspaceSection;
    icon: string;
    keywords: string;
};
/** IDs remain stable so existing bookmarks and saved cases keep working. */
export const WORKSPACE_APPS: readonly WorkspaceApp[] = [
    { id: 'desktop', name: 'Today', short: 'Today', section: 'today', icon: 'Monitor', keywords: 'home daily finance pc desk workbench' },
    { id: 'career', name: 'Assignments & deliverables', short: 'Assignments', section: 'today', icon: 'BookOpen', keywords: 'finance desk takeover career forecast' },
    { id: 'overview', name: 'Company overview', short: 'Overview', section: 'today', icon: 'LayoutDashboard', keywords: 'dashboard cash business' },
    { id: 'ledger', name: 'Journal & ledger', short: 'Ledger', section: 'work', icon: 'BookOpen', keywords: 'general ledger gl trial balance debit credit' },
    { id: 'receivables', name: 'Receivables', short: 'Receivables', section: 'work', icon: 'ReceiptText', keywords: 'ar sales customers debtors' },
    { id: 'payables', name: 'Payables', short: 'Payables', section: 'work', icon: 'WalletCards', keywords: 'ap purchases suppliers creditors' },
    { id: 'bank', name: 'Bank reconciliation', short: 'Bank', section: 'work', icon: 'Landmark', keywords: 'banking cash matching statement' },
    { id: 'payroll', name: 'Payroll', short: 'Payroll', section: 'work', icon: 'Users', keywords: 'wages salaries super employees' },
    { id: 'assets', name: 'Assets & leases', short: 'Assets', section: 'work', icon: 'Building2', keywords: 'fixed assets depreciation lease' },
    { id: 'inventory', name: 'Inventory', short: 'Inventory', section: 'work', icon: 'Package', keywords: 'stock cost of sales nrv' },
    { id: 'tax', name: 'Tax workspace', short: 'Tax', section: 'work', icon: 'Calculator', keywords: 'gst income tax deferred tax' },
    { id: 'close', name: 'Month-end close', short: 'Month-end', section: 'close', icon: 'ListChecks', keywords: 'period lock review adjustments reconciliations' },
    { id: 'provisions', name: 'Provisions', short: 'Provisions', section: 'close', icon: 'Scale', keywords: 'warranty legal ecl estimates' },
    { id: 'audit', name: 'Audit support', short: 'Audit support', section: 'close', icon: 'ShieldCheck', keywords: 'evidence requests sign off workpapers' },
    { id: 'reports', name: 'Financial statements', short: 'Reports', section: 'reports', icon: 'ChartNoAxesCombined', keywords: 'afs management profit loss balance sheet cash flow budget' },
    { id: 'documents', name: 'Source documents', short: 'Documents', section: 'files', icon: 'Files', keywords: 'invoices statements evidence source' },
    { id: 'knowledge', name: 'Accounting guide', short: 'Guidance', section: 'learn', icon: 'GraduationCap', keywords: 'accounting desk lessons concepts explanation' },
    { id: 'practice', name: 'Targeted practice', short: 'Practice', section: 'learn', icon: 'GraduationCap', keywords: 'practice path exercises guided exam' },
    { id: 'settings', name: 'Case, notebook & backups', short: 'Settings', section: 'settings', icon: 'Settings', keywords: 'save restore data new seed setup' },
];
export const FINANCE_APPS = WORKSPACE_APPS.filter(app => app.id !== 'desktop');
export const appsForSection = (section: WorkspaceSection) => WORKSPACE_APPS.filter(app => app.section === section);
export const appById = (id: string) => WORKSPACE_APPS.find(app => app.id === id);
export const isWorkspaceView = (id: string) => WORKSPACE_APPS.some(app => app.id === id);

/** Desktop utilities share the same navigation/search catalogue without replacing accounting routes. */
export const WORKSPACE_UTILITIES = [
    { id: 'review-notes', name: 'Review notes', section: 'close', keywords: 'preparer responses review clearance history' },
    { id: 'ledger-checks', name: 'Ledger checks', section: 'close', keywords: 'health exceptions duplicate suspense missing source bank' },
] as const;
