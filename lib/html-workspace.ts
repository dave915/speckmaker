export const MOCKUP_PATH='mockup.html';
export const MAX_MOCKUP_BYTES=5*1024*1024;
export type HtmlEdit={revision:number;offset:number;line:number;before:string;after:string};
export class ToolError extends Error {}
export class HtmlWorkspace {
  readonly original:string;
  html:string;
  revision=0;
  edits:HtmlEdit[]=[];
  constructor(html:string){if(new TextEncoder().encode(html).length>MAX_MOCKUP_BYTES)throw new ToolError('목업 업로드 한도(5MB)를 초과했습니다.');this.original=html;this.html=html;}
  checkPath(path:unknown){if(path!==MOCKUP_PATH)throw new ToolError(`이 작업에서는 ${MOCKUP_PATH}만 접근할 수 있습니다. list_files로 확인하세요.`);}
  info(){return {path:MOCKUP_PATH,characters:this.html.length,bytes:new TextEncoder().encode(this.html).length,lines:this.html.split('\n').length,revision:this.revision};}
  read(path:unknown,start=0,length=2000,maxLength=4000){
    this.checkPath(path);if(!Number.isInteger(start)||start<0||start>this.html.length)throw new ToolError('start는 파일 범위 안의 문자 위치여야 합니다.');
    if(!Number.isInteger(length)||length<1)throw new ToolError('length는 양의 정수여야 합니다.');
    const end=Math.min(this.html.length,start+Math.min(length,maxLength));
    return {path:MOCKUP_PATH,revision:this.revision,start,end,total_characters:this.html.length,content:this.html.slice(start,end),next_start:end<this.html.length?end:null};
  }
  search(path:unknown,query:string,from=0,caseSensitive=true,maxLength=4000){
    this.checkPath(path);if(!query||query.length>200)throw new ToolError('검색어는 1~200자로 입력하세요. 정규식이 아닌 일반 문자열 검색입니다.');
    if(!Number.isInteger(from)||from<0||from>this.html.length)throw new ToolError('from 위치가 파일 범위를 벗어났습니다.');
    const expression=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),caseSensitive?'g':'gi');expression.lastIndex=from;
    const matches:{offset:number;start:number;end:number;context:string}[]=[];let used=0,next:number|null=null;
    for(let match;(match=expression.exec(this.html));){
      const start=Math.max(0,match.index-100),end=Math.min(this.html.length,match.index+match[0].length+180),context=this.html.slice(start,end);
      if(matches.length>=8||used+context.length>maxLength){next=match.index;break;}
      matches.push({offset:match.index,start,end,context});used+=context.length;
    }
    return {path:MOCKUP_PATH,revision:this.revision,query,matches,next_from:next};
  }
  replace(path:unknown,oldText:string,newText:string,expectedRevision:number){
    this.checkPath(path);if(expectedRevision!==this.revision)throw new ToolError(`오래된 작업본입니다. 현재 revision=${this.revision}. 코드를 다시 읽고 수정하세요.`);
    if(!oldText||oldText.length>12000||newText.length>12000)throw new ToolError('교체할 문자열은 비어 있지 않아야 하며, 한 번에 기존/새 코드 각각 12,000자 이하여야 합니다. 더 작은 부분으로 나눠 수정하세요.');
    const offset=this.html.indexOf(oldText);if(offset===-1)throw new ToolError('교체할 코드가 없습니다. search_file/read_file로 현재 내용을 다시 확인하세요.');
    if(this.html.indexOf(oldText,offset+1)!==-1)throw new ToolError('교체할 코드가 여러 위치에 일치합니다. 앞뒤 코드를 포함해 한 곳만 특정하세요.');
    if(oldText===newText)throw new ToolError('기존 코드와 새 코드가 같습니다.');
    const next=this.html.slice(0,offset)+newText+this.html.slice(offset+oldText.length);
    if(new TextEncoder().encode(next).length>MAX_MOCKUP_BYTES)throw new ToolError('수정 결과가 목업 저장 한도(5MB)를 초과합니다.');
    const line=this.html.slice(0,offset).split('\n').length;
    this.html=next;this.revision++;this.edits.push({revision:this.revision,offset,line,before:oldText,after:newText});
    return {ok:true,revision:this.revision,replacements:1,offset,line,removed_characters:oldText.length,added_characters:newText.length};
  }
  diff(maxLength=4000){
    let remaining=maxLength;const edits=[];
    for(const edit of this.edits.slice(-8)){
      if(remaining<100)break;const size=Math.max(50,Math.min(700,Math.floor(remaining/2)));const before=edit.before.slice(0,size),after=edit.after.slice(0,size);remaining-=before.length+after.length;
      edits.push({...edit,before,after,truncated:edit.before.length>size||edit.after.length>size});
    }
    return {revision:this.revision,changed:this.html!==this.original,total_edits:this.edits.length,edits,truncated:edits.length!==this.edits.length};
  }
}
