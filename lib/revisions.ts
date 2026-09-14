import {z} from 'zod';
import {db,bucket} from './storage';
import {demoHtml} from './demo';
import type {Screen} from './types';

export const screensSchema=z.array(z.object({
  name:z.string().min(1).max(100),selector:z.string().max(500).optional(),
  index:z.number().int().min(0).max(1000).optional(),panelId:z.string().max(500).optional(),
})).min(1).max(12);
export type StoredMockup={id:string;project_id:string;name:string;revision:number;storage_key:string|null;screens:string;created_at:number};
export class RevisionError extends Error {constructor(message:string,public status=400){super(message);}}
export async function getMockup(id:string){
  const record=await db().prepare('SELECT * FROM mockups WHERE id=?').bind(id).first<StoredMockup>();
  if(!record)throw new RevisionError('목업을 찾을 수 없어요.',404);return record;
}
export async function readHtml(record:StoredMockup,revision?:number):Promise<{html:string;screens:Screen[];revision:number}> {
  let key=record.storage_key,screens=record.screens,rev=record.revision;
  if(revision!==undefined&&revision!==record.revision){
    const row=await db().prepare('SELECT storage_key,screens,revision FROM revisions WHERE mockup_id=? AND revision=?').bind(record.id,revision).first<{storage_key:string;screens:string;revision:number}>();
    if(!row)throw new RevisionError('변경 이력을 찾을 수 없어요.',404);
    key=row.storage_key;screens=row.screens;rev=row.revision;
  }
  const html=key?await (await bucket().get(key))?.text():(record.id==='demo-dashboard'&&rev===0?demoHtml:undefined);
  if(!html)throw new RevisionError('저장된 HTML을 불러올 수 없어요.',404);
  return {html,screens:JSON.parse(screens),revision:rev};
}
export async function ensureOriginal(record:StoredMockup){
  if(await db().prepare('SELECT id FROM revisions WHERE mockup_id=? AND revision=0').bind(record.id).first())return;
  if(record.revision!==0)throw new RevisionError('원본 이력을 확인하지 못했어요. 새로고침 후 다시 시도해 주세요.',409);
  let key=record.storage_key;
  if(!key){key=`mockups/${record.id}/original.html`;const original=await readHtml(record);await bucket().put(key,original.html,{httpMetadata:{contentType:'text/html; charset=utf-8'}});}
  await db().batch([
    db().prepare("INSERT OR IGNORE INTO revisions(id,mockup_id,revision,storage_key,screens,kind,author,prompt,created_at) VALUES(?,?,0,?,?,'upload','업로드','',?)").bind(`${record.id}:original`,record.id,key,record.screens,record.created_at),
    db().prepare('UPDATE mockups SET storage_key=? WHERE id=? AND revision=0 AND storage_key IS NULL').bind(key,record.id),
  ]);
}
export async function appendRevision(record:StoredMockup,input:{requestId:string;expectedRevision:number;html:string;screens:Screen[];kind:'ai'|'restore';author:string;prompt:string;model:string|null;restoredFrom:number|null}) {
  const duplicate=await db().prepare('SELECT revision FROM revisions WHERE id=? AND mockup_id=?').bind(input.requestId,record.id).first<{revision:number}>();
  if(duplicate)return readHtml(await getMockup(record.id));
  if(record.revision!==input.expectedRevision)throw new RevisionError('다른 변경 사항이 먼저 적용됐어요. 최신 목업을 확인한 뒤 다시 시도해 주세요.',409);
  await ensureOriginal(record);
  const key=`mockups/${record.id}/revisions/${input.requestId}-${crypto.randomUUID()}.html`;
  await bucket().put(key,input.html,{httpMetadata:{contentType:'text/html; charset=utf-8'}});
  const database=db();const next=record.revision+1;
  const results=await database.batch([
    database.prepare('INSERT INTO revisions(id,mockup_id,revision,storage_key,screens,kind,author,prompt,model,restored_from,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mockups WHERE id=? AND revision=?)')
      .bind(input.requestId,record.id,next,key,JSON.stringify(input.screens),input.kind,input.author,input.prompt,input.model,input.restoredFrom,Date.now(),record.id,input.expectedRevision),
    database.prepare('UPDATE mockups SET storage_key=?,screens=?,revision=? WHERE id=? AND revision=?')
      .bind(key,JSON.stringify(input.screens),next,record.id,input.expectedRevision),
  ]);
  if(results[1].meta.changes!==1){await bucket().delete(key);if(await db().prepare('SELECT id FROM revisions WHERE id=? AND mockup_id=?').bind(input.requestId,record.id).first())return readHtml(await getMockup(record.id));throw new RevisionError('동시에 수정된 내용이 있어요. 최신 목업을 확인한 뒤 다시 시도해 주세요.',409);}
  return {html:input.html,screens:input.screens,revision:next};
}
