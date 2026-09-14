import { db, failure, validOrigin } from '@/lib/storage';
import { demoScreens } from '@/lib/demo';
const bad = (message:string) => Response.json({error:message},{status:400});
const str=(v:unknown,max=120)=>typeof v==='string'?v.trim().slice(0,max):'';
export async function GET(request:Request) {
  try {
    const project=new URL(request.url).searchParams.get('project') || 'demo-luma';
    const database=db();
    const [projects,mockups,comments,people]=await database.batch<Record<string,unknown>>([
      database.prepare('SELECT p.*, (SELECT COUNT(*) FROM mockups m WHERE m.project_id=p.id) AS count FROM projects p ORDER BY p.created_at ASC'),
      database.prepare('SELECT id, project_id, name, screens, created_at FROM mockups WHERE project_id=? ORDER BY created_at ASC').bind(project),
      database.prepare('SELECT * FROM comments WHERE project_id=? ORDER BY created_at ASC').bind(project),
      database.prepare('SELECT id,name,color,x,y FROM presence WHERE project_id=? AND updated_at>?').bind(project,Date.now()-15000),
    ]);
    return Response.json({projects:projects.results,mockups:mockups.results.map((m)=>({...m,screens:JSON.parse(m.screens as string)})),comments:comments.results,people:people.results},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return failure(e);}
}
export async function POST(request:Request) {
  if(!validOrigin(request))return Response.json({error:'허용되지 않은 요청이에요.'},{status:403});
  try {
    if(Number(request.headers.get('content-length')||0)>24000)return bad('내용이 너무 길어요.');
    const p=await request.json() as {action:string; name:string; projectId:string; sessionId:string; color:string; x:number; y:number; body:string; parentId:string; mockupId:string; screenIndex:number; author:string; id:string; resolved:boolean}; const database=db(); const now=Date.now();
    if(p.action==='init'){
      await database.batch<Record<string,unknown>>([
        database.prepare('INSERT OR IGNORE INTO projects(id,name,color,created_at) VALUES(?,?,?,?)').bind('demo-luma','Luma 워크스페이스','#81936e',now),
        database.prepare('INSERT OR IGNORE INTO mockups(id,project_id,name,screens,created_at) VALUES(?,?,?,?,?)').bind('demo-dashboard','demo-luma','luma-dashboard.html',JSON.stringify(demoScreens),now),
        database.prepare('INSERT OR IGNORE INTO comments(id,project_id,mockup_id,screen_index,x,y,author,body,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('guide-1','demo-luma','demo-dashboard',0,0.64,0.23,'Speck 가이드','각 탭을 독립된 화면으로 펼쳤어요. 세 화면을 나란히 비교해 보세요.',now),
        database.prepare('INSERT OR IGNORE INTO comments(id,project_id,mockup_id,screen_index,x,y,author,body,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('guide-2','demo-luma','demo-dashboard',1,0.72,0.49,'Speck 가이드','화면의 원하는 위치에 핀을 찍고 피드백을 남겨보세요. C 키로 코멘트 모드를 켤 수 있어요.',now+1),
        database.prepare('INSERT OR IGNORE INTO comments(id,project_id,mockup_id,screen_index,x,y,author,body,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('guide-3','demo-luma','demo-dashboard',2,0.58,0.32,'Speck 가이드','논의가 끝난 코멘트는 체크 버튼으로 해결할 수 있어요. 해결된 코멘트도 다시 볼 수 있어요.',now+2),
      ]); return Response.json({ok:true});
    }
    if(p.action==='project'){
      const name=str(p.name,80);if(!name)return bad('프로젝트 이름을 입력해 주세요.');const id=crypto.randomUUID();
      await database.prepare('INSERT INTO projects(id,name,color,created_at) VALUES(?,?,?,?)').bind(id,name,['#829f70','#bc8b6c','#8394bd','#b698b8'][Math.floor(Math.random()*4)],now).run();return Response.json({id});
    }
    const projectId=str(p.projectId);if(!await database.prepare('SELECT id FROM projects WHERE id=?').bind(projectId).first())return bad('프로젝트를 찾을 수 없어요.');
    if(p.action==='presence'){
      const id=str(p.sessionId);if(!id)return bad('참여자 정보가 없어요.');
      await database.batch<Record<string,unknown>>([
        database.prepare('INSERT INTO presence(id,project_id,name,color,x,y,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,name=excluded.name,color=excluded.color,x=excluded.x,y=excluded.y,updated_at=excluded.updated_at').bind(id,projectId,str(p.name,24)||'방문자',/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#71975b',Number.isFinite(p.x)?p.x:null,Number.isFinite(p.y)?p.y:null,now),
        database.prepare('DELETE FROM presence WHERE updated_at<?').bind(now-60000),
      ]);return Response.json({ok:true});
    }
    if(p.action==='comment'){
      const body=str(p.body,3000);if(!body)return bad('코멘트를 입력해 주세요.');
      const parentId=str(p.parentId)||null;let mockupId=str(p.mockupId)||null;let screenIndex=Number.isInteger(p.screenIndex)?p.screenIndex:null;
      let x=Number.isFinite(p.x)?Math.max(0,Math.min(1,p.x)):null;let y=Number.isFinite(p.y)?Math.max(0,Math.min(1,p.y)):null;
      if(parentId){const parent=await database.prepare('SELECT * FROM comments WHERE id=? AND project_id=? AND parent_id IS NULL').bind(parentId,projectId).first();if(!parent)return bad('원본 코멘트를 찾을 수 없어요.');mockupId=parent.mockup_id as string;screenIndex=parent.screen_index as number;x=null;y=null;}
      else if(mockupId){const mockup=await database.prepare('SELECT screens FROM mockups WHERE id=? AND project_id=?').bind(mockupId,projectId).first();if(!mockup)return bad('목업을 찾을 수 없어요.');const screens=JSON.parse(mockup.screens as string);if(screenIndex===null||screenIndex<0||screenIndex>=screens.length||x===null||y===null)return bad('핀 위치를 다시 선택해 주세요.');}
      else {screenIndex=null;x=null;y=null;}
      const id=crypto.randomUUID();await database.prepare('INSERT INTO comments(id,project_id,mockup_id,screen_index,x,y,author,body,parent_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,projectId,mockupId,screenIndex,x,y,str(p.author,24)||'방문자',body,parentId,now).run();return Response.json({id});
    }
    if(p.action==='resolve'){
      await database.prepare('UPDATE comments SET resolved=? WHERE id=? AND project_id=? AND parent_id IS NULL').bind(p.resolved?1:0,str(p.id),projectId).run();return Response.json({ok:true});
    }
    return bad('알 수 없는 요청이에요.');
  }catch(e){return failure(e);}
}
