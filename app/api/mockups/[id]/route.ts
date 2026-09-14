import {failure} from '@/lib/storage';
import {getMockup,readHtml,RevisionError} from '@/lib/revisions';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;const value=new URL(request.url).searchParams.get('revision');
    if(value!==null&&!/^\d+$/.test(value))throw new RevisionError('올바른 변경 번호를 선택해 주세요.');
    const record=await getMockup(id);const content=await readHtml(record,value===null?undefined:Number(value));
    return Response.json(content,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch(e){if(e instanceof RevisionError)return Response.json({error:e.message},{status:e.status});return failure(e);}
}
