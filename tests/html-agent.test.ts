import test from 'node:test';
import assert from 'node:assert/strict';
import {HtmlWorkspace} from '../lib/html-workspace';
import {runHtmlAgent,compactMessages} from '../lib/html-agent';
import {ollamaToolTurn} from '../lib/ollama';
import type {OllamaMessage,PreviewValidator,PreviewReport} from '../lib/agent-types';
const doc=(body:string)=>`<!DOCTYPE html><html><head><title>Test</title></head><body>${body}</body></html>`;
const call=(name:string,args:Record<string,unknown>):OllamaMessage=>({role:'assistant',content:'',tool_calls:[{function:{name,arguments:args}}]});
const report=(errors:string[]=[],assertions:{selector:string;passed:boolean;actual:string}[]=[]):PreviewReport=>({ok:!errors.length&&assertions.every(a=>a.passed),errors:[],warnings:[],screens:[{index:0,name:'Test',ok:!errors.length,errors,warnings:[],assertions,text:'Test',controls:[],height:880,horizontalOverflow:false}]});
// Screen detection only needs this small document surface in protocol tests; real DOM tests run in Chromium.
(globalThis as unknown as {DOMParser:unknown}).DOMParser=class {parseFromString(){return {querySelectorAll:()=>[],title:'Test'};}};

test('large minified HTML is searched and patched without a whole-file rewrite',()=>{
 const html=doc('<div data-padding="'+'x'.repeat(220000)+'"></div><style>#cta{background:#222}</style><button id="cta">Start</button>');
 const workspace=new HtmlWorkspace(html);const found=workspace.search('mockup.html','#cta');assert.equal(found.matches.length,1);assert.ok(found.matches[0].offset>220000);assert.ok(JSON.stringify(found).length<1200);
 const read=workspace.read('mockup.html',found.matches[0].start,4000);assert.ok(read.content.length<=4000);
 workspace.replace('mockup.html','#cta{background:#222}','#cta{background:#ff6600}',0);
 assert.equal(workspace.html,html.replace('#cta{background:#222}','#cta{background:#ff6600}'));
 assert.throws(()=>workspace.replace('mockup.html','Start','Go',0),/오래된/);
 assert.throws(()=>workspace.read('../../private.txt',0,10),/접근/);
});
test('ambiguous and empty replacements never modify the draft',()=>{
 const w=new HtmlWorkspace(doc('<button>A</button><button>A</button>'));
 assert.throws(()=>w.replace('mockup.html','<button>A</button>','B',0),/여러/);
 assert.throws(()=>w.replace('mockup.html','','B',0),/비어/);assert.equal(w.revision,0);assert.equal(w.html,w.original);
});
test('streaming preserves tool call fragments, UTF-8 and thinking for the next round',async()=>{
 const original=globalThis.fetch;
 const lines=[{message:{thinking:'분석',content:'',tool_calls:[{function:{index:0,name:'read_file',arguments:'{"path":"mock'}}]}},{message:{tool_calls:[{function:{index:0,name:'read_file',arguments:'up.html","start":0,"length":10}'}}]}},{done:true,done_reason:'stop'}].map(x=>JSON.stringify(x)).join('\n');
 const bytes=new TextEncoder().encode(lines);
 globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=3)controller.enqueue(bytes.slice(i,i+3));controller.close();}}));
 try{const result=await ollamaToolTurn({url:'http://localhost:11434',model:'test',messages:[],tools:[],contextLength:32768,signal:new AbortController().signal});assert.equal(result.thinking,'분석');assert.equal(result.tool_calls?.[0].function.name,'read_file');assert.deepEqual(JSON.parse(result.tool_calls![0].function.arguments as string),{path:'mockup.html',start:0,length:10});}finally{globalThis.fetch=original;}
});
test('truncated tool output is not treated as an executable completed call',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({message:{tool_calls:[{function:{name:'replace_text',arguments:{}}}]},done:true,done_reason:'length'}));
 try{await assert.rejects(ollamaToolTurn({url:'http://localhost:11434',model:'test',messages:[],tools:[],contextLength:32768,signal:new AbortController().signal}),/잘렸/);}finally{globalThis.fetch=original;}
});
test('agent returns tool failures and repairs a runtime regression before completion',async()=>{
 const original=doc('<style>#cta{color:red}</style>'+'<p>keep</p>'.repeat(10000));let round=0,repairRequested=false;
 const validate:PreviewValidator=async(html)=>report(html.includes('BROKEN')?['ReferenceError: broken']:[]);
 const result=await runHtmlAgent({url:'http://localhost:11434',model:'test',html:original,prompt:'버튼 색 변경',screenName:'Test',fileName:'large.html',signal:new AbortController().signal,onStep:()=>{},contextLength:32768,validate,turn:async input=>{
  assert.ok(!JSON.stringify(input.messages).includes('<p>keep</p>'.repeat(100)), 'Full source must not be sent');
  round++;
  if(round===1)return call('search_file',{path:'mockup.html',query:'#cta'});
  if(round===2)return call('replace_text',{path:'mockup.html',old_text:'missing',new_text:'green',expected_revision:0});
  if(round===3){assert.ok(input.messages.some(m=>m.role==='tool'&&m.content.includes('교체할 코드가 없습니다')));return call('replace_text',{path:'mockup.html',old_text:'color:red',new_text:'color:green;/*BROKEN*/',expected_revision:0});}
  if(round===4)return {role:'assistant',content:'완료'};
  if(round===5){repairRequested=input.messages.some(m=>m.content.includes('app_validation_failed'));return call('replace_text',{path:'mockup.html',old_text:'/*BROKEN*/',new_text:'',expected_revision:1});}
  return {role:'assistant',content:'색상을 변경하고 검사했습니다.'};
 }});
 assert.ok(repairRequested);assert.equal(result.edits.length,2);assert.ok(result.html.includes('color:green;'));assert.ok(!result.html.includes('BROKEN'));assert.equal(result.validation.ok,true);
});
test('a failed requested CSS assertion cannot be bypassed by finishing in prose',async()=>{
 let round=0,assertionRepair=false;
 const validate:PreviewValidator=async(html,request)=>report([],request.assertions?.length?[{selector:'#cta',passed:html.includes('color:green'),actual:html.includes('color:blue')?'blue':'green'}]:[]);
 const result=await runHtmlAgent({url:'http://localhost:11434',model:'test',html:doc('<style>#cta{color:red}</style>'),prompt:'green',screenName:'Test',fileName:'test.html',signal:new AbortController().signal,onStep:()=>{},contextLength:32768,validate,turn:async input=>{
  round++;
  if(round===1)return call('replace_text',{path:'mockup.html',old_text:'color:red',new_text:'color:blue',expected_revision:0});
  if(round===2)return call('validate_preview',{assertions:[{selector:'#cta',property:'color',equals:'green'}]});
  if(round===3)return {role:'assistant',content:'끝'};
  if(round===4){assertionRepair=input.messages.some(m=>m.content.includes('app_validation_failed'));return call('replace_text',{path:'mockup.html',old_text:'color:blue',new_text:'color:green',expected_revision:1});}
  return {role:'assistant',content:'green으로 수정'};
 }});
 assert.ok(assertionRepair);assert.ok(result.html.includes('color:green'));
});
test('context compaction removes whole tool-call/result groups and keeps current draft state',()=>{
 const rounds:OllamaMessage[][]=Array.from({length:10},()=>[call('read_file',{path:'mockup.html',start:0,length:4000}),{role:'tool',tool_name:'read_file',content:'x'.repeat(4000)}]);
 const result=compactMessages([{role:'system',content:'system'},{role:'user',content:'request'}],rounds,'current_revision=7',16384);
 assert.ok(result.dropped>0);assert.ok(result.messages.some(m=>m.content==='current_revision=7'));
 for(let i=3;i<result.messages.length;i+=2){assert.equal(result.messages[i].role,'assistant');assert.equal(result.messages[i+1].role,'tool');}
});
test('cancellation never returns a candidate or mutates the input source',async()=>{
 const controller=new AbortController(),html=doc('<p>unchanged</p>');
 const promise=runHtmlAgent({url:'http://localhost:11434',model:'test',html,prompt:'edit',screenName:'Test',fileName:'test.html',signal:controller.signal,onStep:()=>{},contextLength:32768,validate:async()=>report(),turn:async input=>new Promise((_,reject)=>{input.signal.addEventListener('abort',()=>reject(input.signal.reason),{once:true});queueMicrotask(()=>controller.abort());})});
 await assert.rejects(promise,e=>(e as Error).name==='AbortError');assert.ok(html.includes('unchanged'));
});

test('multiple unindexed streaming tool calls remain separate',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response([
  {message:{tool_calls:[{function:{name:'list_files',arguments:{}}}]}},
  {message:{tool_calls:[{function:{name:'read_file',arguments:{path:'mockup.html',start:0,length:20}}}]}},
  {done:true},
 ].map(x=>JSON.stringify(x)).join('\n'));
 try{const result=await ollamaToolTurn({url:'http://localhost:11434',model:'test',messages:[],tools:[],contextLength:32768,signal:new AbortController().signal});assert.deepEqual(result.tool_calls?.map(c=>c.function.name),['list_files','read_file']);}finally{globalThis.fetch=original;}
});
test('an incomplete preview cannot pass just because the original also timed out',async()=>{
 const {previewRegressions}=await import('../lib/html-agent');
 const failed=report(['preview timeout']);failed.screens[0].completed=false;
 assert.ok(previewRegressions(failed,failed).some(message=>message.includes('완료하지 못')));
});
