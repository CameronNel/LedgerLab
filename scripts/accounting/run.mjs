import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.argv[2]??'check',entries={clarity:'clarity-check.ts',workbook:'workbook-check.ts',workspace:'workspace-check.ts',workday:'workday-check.ts',review:'month-review-check.ts',check:'check.ts',export:'export-case.ts',workflows:'workflow-check.ts',persistence:'persistence-check.ts',career:'career-check.ts',desktop:'desktop-check.ts',render:'render-check.tsx'};
if(!entries[mode])throw new Error('Use workspace, workday, review, check, workflows, persistence, career, desktop, render or export.');
const temporary=mkdtempSync(join(tmpdir(),'ledgerlab-')),bundle=join(temporary,'task.mjs');
try{await build({entryPoints:[join(root,'scripts/accounting',entries[mode])],outfile:bundle,bundle:true,platform:'node',format:'esm',banner:mode==='render'?{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"}:undefined,logLevel:'warning'});const r=spawnSync(process.execPath,[bundle,...process.argv.slice(3)],{cwd:root,stdio:'inherit'});process.exitCode=r.status??1;}finally{rmSync(temporary,{recursive:true,force:true});}
