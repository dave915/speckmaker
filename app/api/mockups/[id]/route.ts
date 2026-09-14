import { db,bucket,failure } from '@/lib/storage';
import { demoHtml } from '@/lib/demo';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const m=await db().prepare('SELECT storage_key FROM mockups WHERE id=?').bind(id).first();
    if(!m)return Response.json({error:'파일을 찾을 수 없어요.'},{status:404});
    const content=id==='demo-dashboard'?demoHtml:await (await bucket().get(m.storage_key as string))?.text();
    if(!content)return Response.json({error:'파일을 불러올 수 없어요.'},{status:404});
    return Response.json({html:content},{headers:{'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
  }catch(e){return failure(e);}
}
