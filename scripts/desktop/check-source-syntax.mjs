#!/usr/bin/env node
/** Syntax diagnostics for first-party TypeScript only. This is not full React application type checking. */
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(import.meta.url);
let ts;try{ts=require('typescript');}catch{ts=require(resolve(dirname(process.execPath),'../lib/node_modules/typescript'));}
const excluded=new Set(['node_modules','.git','.sites-runtime','.wrangler','.next','dist','outputs','output','public']);
function collect(path){return readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()&&!excluded.has(entry.name)?collect(resolve(path,entry.name)):entry.isFile()&&/\.tsx?$/.test(entry.name)&&!entry.name.endsWith('.d.ts')?[resolve(path,entry.name)]:[]);}
const files=collect(root);let errors=0;
for(const file of files){const parsed=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,isolatedModules:true}});for(const issue of parsed.diagnostics??[])if(issue.category===ts.DiagnosticCategory.Error){console.error(relative(root,file)+': '+ts.flattenDiagnosticMessageText(issue.messageText,'\n'));errors++;}}
if(errors)process.exitCode=1;else console.log(`PASS: ${files.length} first-party TS/TSX files passed syntax transpilation. This does not resolve React dependencies or type-check the full application.`);
