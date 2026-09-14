import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';
const root=process.cwd();fs.mkdirSync(path.join(root,'.sites-runtime'),{recursive:true});const temp=fs.mkdtempSync(path.join(root,'.sites-runtime','agent-tests-'));
const files=['lib/html-workspace.ts','lib/agent-types.ts','lib/agent-tools.ts','lib/html-agent.ts','lib/ollama.ts','lib/html.ts','lib/types.ts','lib/preview-validator.ts','tests/html-agent.test.ts'];
try{
 for(const file of files){let output=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;output=output.replace(/(['"])(\.{1,2}\/[^'"\n]+)\1/g,(match,quote,ref)=>ref.endsWith('.js')?match:quote+ref+'.js'+quote);const dest=path.join(temp,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,output);}
 fs.writeFileSync(path.join(temp,'package.json'),'{"type":"module"}');const result=spawnSync(process.execPath,['--test',path.join(temp,'tests/html-agent.test.js')],{stdio:'inherit'});process.exitCode=result.status??1;
}finally{fs.rmSync(temp,{recursive:true,force:true});}
