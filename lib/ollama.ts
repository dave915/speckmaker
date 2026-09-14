import type {OllamaMessage,OllamaTool,OllamaToolCall} from './agent-types';
export const DEFAULT_OLLAMA_URL='http://localhost:11434';
export type OllamaSettings={url:string;model:string};
export function ollamaUrl(value:string){
 let url:URL;try{url=new URL(value.trim());}catch{throw new Error('Ollama 주소를 확인해 주세요. 예: http://localhost:11434');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('인증 정보나 쿼리 없이 http 또는 https 주소를 입력해 주세요.');
 return url.toString().replace(/\/+$/,'');
}
export async function listOllamaModels(address:string,signal?:AbortSignal):Promise<string[]>{
 const response=await fetch(ollamaUrl(address)+'/api/tags',{signal:signal??AbortSignal.timeout(10000),credentials:'omit',cache:'no-store'});
 if(!response.ok)throw new Error(response.status===403?'Ollama에서 이 사이트의 연결을 허용하지 않았어요. 아래 연결 안내를 확인해 주세요.':`Ollama 연결에 실패했어요 (${response.status}).`);
 const data=await response.json() as {models?:{name?:string}[]};if(!Array.isArray(data.models))throw new Error('Ollama 모델 목록이 아니에요. 서버 주소를 확인해 주세요.');
 return data.models.map(m=>m.name).filter((name):name is string=>typeof name==='string'&&name.length>0);
}
export async function getOllamaModel(address:string,model:string,signal:AbortSignal){
 const response=await fetch(ollamaUrl(address)+'/api/show',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',signal,body:JSON.stringify({model})});
 const data=await response.json() as {error?:string;capabilities?:string[];model_info?:Record<string,unknown>};if(!response.ok)throw Error(data.error||'모델 정보를 불러올 수 없어요.');
 if(!data.capabilities?.includes('tools'))throw Error('이 모델은 도구 호출을 지원하지 않아요. tool use를 지원하는 모델을 선택해 주세요.');
 const limits=Object.entries(data.model_info??{}).filter(([key,value])=>key.endsWith('.context_length')&&typeof value==='number'&&value>0).map(([,value])=>value as number);
 return {contextLength:Math.min(32768,...(limits.length?limits:[32768]))};
}
export async function ollamaToolTurn(input:{url:string;model:string;messages:OllamaMessage[];tools:OllamaTool[];contextLength:number;signal:AbortSignal;onProgress?:(characters:number)=>void}):Promise<OllamaMessage>{
 const response=await fetch(ollamaUrl(input.url)+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',signal:input.signal,body:JSON.stringify({model:input.model,messages:input.messages,tools:input.tools,stream:true,think:false,options:{temperature:0.1,num_ctx:input.contextLength,num_predict:4096}})});
 if(!response.ok){const text=await response.text();let error='';try{error=(JSON.parse(text) as {error?:string}).error||'';}catch{}throw Error(error||`Ollama 요청이 실패했어요 (${response.status}).`);}
 if(!response.body)throw Error('Ollama 응답이 비어 있어요.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',content='',thinking='',completed=false,reason='',received=0;
 const calls=new Map<string,{id?:string;index:number;name:string;arguments:Record<string,unknown>|string}>();
 function consume(line:string){
  if(!line.trim())return;let chunk:{error?:string;message?:{content?:string;thinking?:string;tool_calls?:OllamaToolCall[]};done?:boolean;done_reason?:string};
  try{chunk=JSON.parse(line);}catch{throw Error('Ollama 스트리밍 응답을 해석하지 못했어요. 다시 시도해 주세요.');}
  if(chunk.error)throw Error(chunk.error);
  content+=chunk.message?.content||'';thinking+=chunk.message?.thinking||'';
  for(const [position,call] of (chunk.message?.tool_calls??[]).entries()){
   const fn=call.function;if(!fn||typeof fn.name!=='string'||fn.name.length>100)throw Error('도구 호출 형식이 올바르지 않아요.');const index=fn.index??(typeof fn.arguments==='object'?calls.size:position),key=call.id??(fn.index===undefined&&typeof fn.arguments==='object'?'unindexed-'+index:String(index)),old=calls.get(key);
   if(!old){calls.set(key,{id:call.id,index,name:fn.name||'',arguments:fn.arguments??{}});continue;}
   if(fn.name&&fn.name!==old.name)old.name=fn.name.startsWith(old.name)?fn.name:old.name+fn.name;
   if(typeof fn.arguments==='string')old.arguments=typeof old.arguments==='string'?old.arguments+fn.arguments:fn.arguments;
   else if(fn.arguments)old.arguments={...(typeof old.arguments==='object'?old.arguments:{}),...fn.arguments};
  }
  if(calls.size>8)throw Error('한 응답에 너무 많은 도구 호출이 포함됐어요.');
  input.onProgress?.(content.length+thinking.length);
  if(chunk.done){completed=true;reason=chunk.done_reason||'';}
 }
 try{while(true){const part=await reader.read();if(part.done)break;received+=part.value.length;if(received>2*1024*1024)throw Error('한 단계의 모델 응답이 너무 큽니다. 요청을 작게 나눠 주세요.');buffer+=decoder.decode(part.value,{stream:true});let index;while((index=buffer.indexOf('\n'))!==-1){consume(buffer.slice(0,index));buffer=buffer.slice(index+1);}}buffer+=decoder.decode();consume(buffer);}
 catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 if(!completed||reason==='length')throw Error('모델 응답이 중간에 잘렸어요. 현재 목업은 변경하지 않았습니다. 수정 범위를 줄여 다시 요청해 주세요.');
 return {role:'assistant',content,...(thinking?{thinking}:{}),...(calls.size?{tool_calls:[...calls.values()].map(call=>({...(call.id?{id:call.id}:{}),function:{index:call.index,name:call.name,arguments:call.arguments}}))}:{})};
}
export function connectionError(error:unknown){
 if(error instanceof Error&&error.name==='TimeoutError')return 'Ollama 응답 시간이 초과됐어요. 실행 상태와 주소를 확인해 주세요.';
 if(error instanceof TypeError)return 'Ollama에 연결할 수 없어요. 서버 실행, 허용 출처(OLLAMA_ORIGINS), 브라우저의 로컬 네트워크 권한을 확인해 주세요.';
 return error instanceof Error?error.message:'연결 중 문제가 생겼어요. 다시 시도해 주세요.';
}
