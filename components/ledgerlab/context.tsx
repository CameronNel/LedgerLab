'use client';
import {createContext,useContext} from 'react';
import type {NotebookDraft} from '@/lib/workspace/notebook-draft';
import type {PracticeCompany,PracticeState,Journal,Command} from '@/lib/accounting/types';
export type JournalDraft={exerciseId?:string;sourceId?:string;description?:string;date?:string;lines?:Journal['lines'];cashClass?:Journal['cashClass'];templateId?:string;templateName?:string;templateNotes?:string};
export type WorkspaceContextValue={company:PracticeCompany;state:PracticeState;journals:Journal[];saving:boolean;loaded:boolean;send:(c:Command)=>Promise<boolean>;go:(view:string)=>void;view:string;month:string;setMonth:(m:string)=>void;openJournal:(draft?:JournalDraft)=>void;openDocument:(id:string)=>void;openExercise:(id:string)=>void;inspectJournal:(j:Journal)=>void;reload:()=>void;notebook:NotebookDraft;editNotebook:(text:string)=>void;resolveNotebook:(keepDraft:boolean)=>void;};
export const WorkspaceContext=createContext<WorkspaceContextValue|null>(null);
export function useWorkspace(){const c=useContext(WorkspaceContext);if(!c)throw new Error('Workspace provider missing');return c;}
