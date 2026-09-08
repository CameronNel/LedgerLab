#!/usr/bin/env node
/** Bundle the actual dependency-free desktop for its isolated browser checks/preview.
 * This deliberately does not replace or claim to build the React/Vinext application.
 * No runtime eval, external scripts, package downloads or production credentials.
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(import.meta.url);
let ts;
try{ts=require('typescript');}catch{ts=require(resolve(dirname(process.execPath),'../lib/node_modules/typescript'));}
const modules=new Map();
function collect(path){
  const id=relative(root,path).replaceAll('\\','/');if(modules.has(id))return id;modules.set(id,null);
  const result=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,strict:true},fileName:path,reportDiagnostics:true});
  const errors=result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)??[];
  if(errors.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>root,getCanonicalFileName:x=>x,getNewLine:()=> '\n'}));
  const deps={};
  for(const match of result.outputText.matchAll(/require\("([^"\n]+)"\)/g)){
    const name=match[1];if(!name.startsWith('.'))throw new Error(`Preview must be dependency-free: ${id} imports ${name}`);
    const base=resolve(dirname(path),name),target=[base,base+'.ts',resolve(base,'index.ts')].find(f=>existsSync(f));
    if(!target)throw new Error(`Missing dependency ${name}`);deps[name]=collect(target);
  }
  modules.set(id,{code:result.outputText,deps});return id;
}
const entry=collect(resolve(root,'scripts/desktop/preview.ts'));
const bundle=`(()=>{'use strict';const modules={${[...modules].map(([id,m])=>`${JSON.stringify(id)}:[function(require,module,exports){\n${m.code}\n},${JSON.stringify(m.deps)}]`).join(',\n')}};const cache={};function load(id){if(cache[id])return cache[id].exports;const [run,deps]=modules[id],m=cache[id]={exports:{}};run(name=>load(deps[name]),m,m.exports);return m.exports;}load(${JSON.stringify(entry)});})();`;
const css=readFileSync(resolve(root,'components/ledgerlab/desktop/desktop.css'),'utf8');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LedgerLab · Finance Workstation v3 · Day-by-Day</title><style>html,body{margin:0;height:100%;overflow:hidden}#preview-label{position:fixed;bottom:65px;right:14px;font:10px Arial;color:#c6e1df;z-index:30;pointer-events:none}${css}</style></head><body><div id="desktop"></div><div id="preview-label">LOCAL FINANCE WORKSTATION · Browser storage · Export backups</div><script>${bundle.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
const output=resolve(process.argv[2]??'/tmp/ledgerlab-desktop-preview.html');mkdirSync(dirname(output),{recursive:true});writeFileSync(output,html);console.log(`Desktop preview: ${modules.size} production/fixture modules, ${Buffer.byteLength(html)} bytes → ${output}`);
