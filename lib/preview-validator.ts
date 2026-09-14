import {detectScreens,screenHtml,FRAME_WIDTH,FRAME_BASE_HEIGHT} from './html';
import type {PreviewReport,PreviewRequest,ScreenCheck} from './agent-types';
import type {Screen} from './types';

function checkScreen(html:string,screen:Screen,index:number,request:PreviewRequest,signal:AbortSignal):Promise<ScreenCheck>{
 return new Promise((resolve,reject)=>{
  signal.throwIfAborted();
  const frame=document.createElement('iframe');const channel=crypto.randomUUID();let finished=false;
  frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.referrerPolicy='no-referrer';
  Object.assign(frame.style,{position:'fixed',left:'-12000px',top:'0',width:FRAME_WIDTH+'px',height:FRAME_BASE_HEIGHT+'px',border:'0',pointerEvents:'none',opacity:'0'});
  const cleanup=()=>{clearTimeout(timeout);window.removeEventListener('message',receive);signal.removeEventListener('abort',cancel);frame.remove();};
  const finish=(value:ScreenCheck)=>{if(finished)return;finished=true;cleanup();resolve(value);};
  const fail=(message:string)=>finish({completed:false,index,name:screen.name,ok:false,errors:[message],warnings:[],text:'',controls:[],assertions:[],height:0,horizontalOverflow:false});
  const cancel=()=>{if(finished)return;finished=true;cleanup();reject(signal.reason??new DOMException('중단됨','AbortError'));};
  const timeout=setTimeout(()=>fail('미리보기 응답 시간이 초과됐습니다. 스크립트 또는 외부 리소스 로드를 확인하세요.'),8000);
  function receive(event:MessageEvent){
   if(event.source!==frame.contentWindow||!event.data||event.data.channel!==channel)return;
   if(event.data.type==='ready')frame.contentWindow?.postMessage({channel,type:'inspect',actions:request.actions??[],assertions:request.assertions??[]},'*');
   if(event.data.type==='report'){
    const data=event.data.report;
    if(!data||!Array.isArray(data.errors)||!Array.isArray(data.warnings)||!Array.isArray(data.assertions)||!Array.isArray(data.controls)){fail('미리보기 검사 결과가 올바르지 않습니다.');return;}
    const strings=(values:unknown[])=>values.filter((v):v is string=>typeof v==='string').slice(0,12).map(v=>v.slice(0,350));
    const errors=strings(data.errors);const assertions:ScreenCheck['assertions']=data.assertions.slice(0,8).map((a:{selector?:unknown;passed?:unknown;actual?:unknown})=>({selector:String(a.selector||'').slice(0,300),passed:a.passed===true,actual:String(a.actual||'').slice(0,500)}));
    finish({completed:true,index,name:screen.name,ok:errors.length===0&&assertions.every(a=>a.passed),errors,warnings:strings(data.warnings),text:String(data.text||'').slice(0,1400),controls:data.controls.slice(0,20).map((c:{tag?:unknown;id?:unknown;text?:unknown})=>({tag:String(c.tag||'').slice(0,30),id:String(c.id||'').slice(0,100),text:String(c.text||'').slice(0,80)})),assertions,height:Number.isFinite(data.height)?Math.min(100000,data.height):0,horizontalOverflow:data.horizontalOverflow===true});
   }
  }
  window.addEventListener('message',receive);signal.addEventListener('abort',cancel,{once:true});
  const config=JSON.stringify({channel,panelId:screen.panelId}).replaceAll('<','\\u003c');
  const instrument=`<meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'"><script>(function(){
   var config=${config},errors=[],warnings=[],inspecting=false;
   function add(list,text){text=String(text).slice(0,350);if(list.length<12&&list.indexOf(text)===-1)list.push(text);}
   window.addEventListener('error',function(e){if(e.message)add(errors,e.message);else if(e.target&&e.target!==window)add(warnings,'리소스 로드 실패: '+(e.target.tagName||'resource'));},true);
   window.addEventListener('unhandledrejection',function(e){add(errors,e.reason&&e.reason.message||e.reason||'Unhandled promise rejection');});
   var original=console.error;console.error=function(){add(warnings,Array.from(arguments).map(String).join(' '));original.apply(console,arguments);};
   document.addEventListener('submit',function(e){e.preventDefault();},true);
   document.addEventListener('click',function(e){var a=e.target instanceof Element&&e.target.closest('a[href]');if(a&&a.getAttribute('href').charAt(0)!=='#')e.preventDefault();},true);
   function send(type,report){parent.postMessage({channel:config.channel,type:type,report:report},'*');}
   window.addEventListener('message',async function(e){
    if(e.source!==parent||!e.data||e.data.channel!==config.channel||e.data.type!=='inspect'||inspecting)return;
    inspecting=true;var checks=[];
    for(var action of e.data.actions.slice(0,5)){
     try{var targets=document.querySelectorAll(action.selector);if(targets.length!==1)throw Error('동작 대상이 '+targets.length+'곳입니다: '+action.selector);var element=targets[0];
      if(action.type==='click')element.click();
      else if(action.type==='fill'){if(!(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement))throw Error('입력 필드만 채울 수 있습니다.');var proto=element instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(element,String(action.value||''));element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));}
      await new Promise(function(r){setTimeout(r,100);});
     }catch(error){add(errors,error.message);}
    }
    for(var check of e.data.assertions.slice(0,8)){
     try{var found=document.querySelectorAll(check.selector);if(found.length!==1)throw Error('검사 대상이 '+found.length+'곳입니다.');var node=found[0];var value=check.property?getComputedStyle(node).getPropertyValue(check.property).trim():(node instanceof HTMLInputElement||node instanceof HTMLTextAreaElement||node instanceof HTMLSelectElement?String(node.value):node.textContent||'').trim();var passed=true;if(check.equals!==undefined)passed=passed&&value===check.equals;if(check.text_includes!==undefined)passed=passed&&value.includes(check.text_includes);checks.push({selector:check.selector,passed:passed,actual:value.slice(0,500)});
     }catch(error){checks.push({selector:check.selector,passed:false,actual:error.message});}
    }
    if(!document.body||(!document.body.children.length&&!document.body.textContent.trim()))add(errors,'표시할 본문이 없습니다.');
    if(config.panelId&&!e.data.actions.length){var panel=document.getElementById(config.panelId);if(!panel||panel.hidden||getComputedStyle(panel).display==='none')add(errors,'선택한 탭 화면이 표시되지 않습니다: '+config.panelId);}
    send('report',{errors:errors,warnings:warnings,assertions:checks,text:document.body?document.body.innerText.slice(0,1400):'',controls:Array.from(document.querySelectorAll('button,a,input,textarea,select,[role=tab],h1,h2')).slice(0,20).map(function(n){return {tag:n.tagName.toLowerCase(),id:n.id,text:(n.getAttribute('aria-label')||n.textContent||n.getAttribute('placeholder')||'').trim().slice(0,80)};}),height:Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0),horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2});
   });
   function ready(){setTimeout(function(){send('ready');},350);}
   if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  })();<\/script>`;
  let source=screenHtml(html,screen,'validation-'+channel);
  if(/<head[\s>]/i.test(source))source=source.replace(/<head([^>]*)>/i,`<head$1>${instrument}`);
  else if(/<html[\s>]/i.test(source))source=source.replace(/<html([^>]*)>/i,`<html$1><head>${instrument}</head>`);
  else source=instrument+source;
  frame.srcdoc=source;document.body.appendChild(frame);
 });
}

export async function validateHtmlPreview(html:string,request:PreviewRequest,signal:AbortSignal):Promise<PreviewReport>{
 signal.throwIfAborted();
 const errors:string[]=[];
 if(!/<html[\s>]/i.test(html)||!/<\/html>\s*$/i.test(html))errors.push('완전한 HTML 문서가 아닙니다. html 시작/종료 태그를 유지하세요.');
 const screens=detectScreens(html);
 if(request.screen_index!==undefined&&!screens[request.screen_index])return {ok:false,errors:['해당 화면 번호가 없습니다.'],warnings:[],screens:[]};
 const targets=request.screen_index===undefined?screens.map((screen,index)=>({screen,index})):[{screen:screens[request.screen_index],index:request.screen_index}];
 const checked:ScreenCheck[]=[];
 for(let i=0;i<targets.length;i+=2){signal.throwIfAborted();checked.push(...await Promise.all(targets.slice(i,i+2).map(({screen,index})=>checkScreen(html,screen,index,request,signal))));}
 return {ok:errors.length===0&&checked.every(s=>s.ok),errors,warnings:checked.filter(s=>s.horizontalOverflow).map(s=>`${s.name}: 가로 넘침이 있습니다.`),screens:checked};
}
