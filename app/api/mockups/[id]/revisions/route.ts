import {z} from 'zod';
import type {Revision} from '@/lib/types';
import {db,failure,validOrigin} from '@/lib/storage';
import {appendRevision,ensureOriginal,getMockup,readHtml,RevisionError,screensSchema} from '@/lib/revisions';
const identity={requestId:z.string().uuid(),expectedRevision:z.number().int().nonnegative(),author:z.string().trim().min(1).max(24)};
const actionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('apply'),...identity,html:z.string().min(1).max(5*1024*1024),screens:screensSchema,prompt:z.string().trim().min(1).max(3000),model:z.string().max(160)}),
  z.object({action:z.literal('restore'),...identity,targetRevision:z.number().int().nonnegative()}),
  z.object({action:z.literal('version'),targetRevision:z.number().int().nonnegative(),label:z.string().trim().min(1).max(80)}),
]);
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  const {id}=await params;const record=await getMockup(id);const url=new URL(request.url);
  const before=Number(url.searchParams.get('before')??record.revision+1);const named=url.searchParams.get('named')==='1';
  if(!Number.isSafeInteger(before)||before<0)throw new RevisionError('이력 목록을 불러올 수 없어요.');
  const {results}=await db().prepare(`SELECT id,mockup_id,revision,screens,kind,author,prompt,model,restored_from,label,version_number,created_at FROM revisions WHERE mockup_id=? AND revision<? ${named?'AND label IS NOT NULL':''} ORDER BY revision DESC LIMIT 31`).bind(id,before).all<Record<string,unknown>>();
  const rows=results.slice(0,30).map(r=>({...r,screens:JSON.parse(r.screens as string)} as Revision));
  if(!rows.length&&!named&&record.revision===0&&before>0)rows.push({id:`${id}:original`,mockup_id:id,revision:0,screens:JSON.parse(record.screens),kind:'upload',author:'업로드',prompt:'',model:null,restored_from:null,label:null,version_number:null,created_at:record.created_at});
  return Response.json({history:rows,currentRevision:record.revision,nextBefore:results.length>30?rows[rows.length-1].revision:null},{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(e instanceof RevisionError)return Response.json({error:e.message},{status:e.status});return failure(e);}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 if(!validOrigin(request))return Response.json({error:'허용되지 않은 요청이에요.'},{status:403});
 try {
  if(Number(request.headers.get('content-length')||0)>6*1024*1024)return Response.json({error:'HTML 파일은 5MB 이하로 저장해 주세요.'},{status:413});
  const parsed=actionSchema.safeParse(await request.json());if(!parsed.success)throw new RevisionError('저장할 내용과 버전 정보를 확인해 주세요.');
  const input=parsed.data;const {id}=await params;const record=await getMockup(id);
  if(input.action==='version'){
    await ensureOriginal(record);
    const row=await db().prepare('SELECT id,label,version_number FROM revisions WHERE mockup_id=? AND revision=?').bind(id,input.targetRevision).first<{id:string;label:string|null;version_number:number|null}>();
    if(!row)throw new RevisionError('저장할 변경 이력을 찾을 수 없어요.',404);
    if(row.label===input.label)return Response.json({ok:true});
    if(row.label)throw new RevisionError('이미 이름을 붙여 저장한 버전이에요.',409);
    const updated=await db().prepare('UPDATE revisions SET label=?,version_number=(SELECT COALESCE(MAX(version_number),0)+1 FROM revisions WHERE mockup_id=?) WHERE id=? AND label IS NULL').bind(input.label,id,row.id).run();
    if(updated.meta.changes!==1)throw new RevisionError('다른 이름으로 먼저 저장됐어요. 이력을 새로고침해 주세요.',409);
    return Response.json({ok:true});
  }
  if(input.action==='restore'){
    const snapshot=await readHtml(record,input.targetRevision);
    const result=await appendRevision(record,{...input,html:snapshot.html,screens:snapshot.screens,kind:'restore',prompt:`변경 #${input.targetRevision}에서 복원`,model:null,restoredFrom:input.targetRevision});
    return Response.json(result);
  }
  if(new TextEncoder().encode(input.html).length>5*1024*1024)throw new RevisionError('HTML 파일은 5MB 이하로 저장해 주세요.');
  if(!/<html[\s>]/i.test(input.html)||!/<\/html>\s*$/i.test(input.html))throw new RevisionError('완성된 HTML 문서만 적용할 수 있어요. 다시 생성해 주세요.');
  const result=await appendRevision(record,{...input,kind:'ai',restoredFrom:null});
  return Response.json(result);
 }catch(e){if(e instanceof RevisionError)return Response.json({error:e.message},{status:e.status});return failure(e);}
}
