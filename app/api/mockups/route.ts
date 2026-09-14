import { db,bucket,failure,validOrigin } from '@/lib/storage';
export async function POST(request:Request){
  if(!validOrigin(request))return Response.json({error:'허용되지 않은 요청이에요.'},{status:403});
  try {
    if(Number(request.headers.get('content-length')||0)>6*1024*1024)return Response.json({error:'파일은 5MB 이하로 업로드해 주세요.'},{status:413});
    const form=await request.formData();const file=form.get('file');const projectId=String(form.get('projectId')||'');
    if(!file||typeof file==='string'||!(/\.html?$/i.test(file.name))||file.size>5*1024*1024||!file.size)return Response.json({error:'5MB 이하의 HTML 파일을 선택해 주세요.'},{status:400});
    if(!await db().prepare('SELECT id FROM projects WHERE id=?').bind(projectId).first())return Response.json({error:'프로젝트를 찾을 수 없어요.'},{status:404});
    const screens=JSON.parse(String(form.get('screens')||'[]'));
    if(!Array.isArray(screens)||screens.length<1||screens.length>12||screens.some(s=>typeof s.name!=='string'||s.name.length>100||(s.selector!==undefined&&(typeof s.selector!=='string'||s.selector.length>500))||(s.index!==undefined&&(!Number.isInteger(s.index)||s.index<0||s.index>1000))||(s.panelId!==undefined&&(typeof s.panelId!=='string'||s.panelId.length>500))))return Response.json({error:'화면 정보를 확인해 주세요. 최대 12개 화면을 지원해요.'},{status:400});
    const id=crypto.randomUUID();const key='mockups/'+id+'.html';await bucket().put(key,await file.arrayBuffer(),{httpMetadata:{contentType:'text/html; charset=utf-8'}});
    try{await db().prepare('INSERT INTO mockups(id,project_id,name,storage_key,screens,created_at) VALUES(?,?,?,?,?,?)').bind(id,projectId,file.name.slice(0,180),key,JSON.stringify(screens),Date.now()).run();}catch(e){await bucket().delete(key);throw e;}
    return Response.json({id},{status:201});
  }catch(e){return failure(e);}
}
