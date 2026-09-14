import { env } from 'cloudflare:workers';
export function db(): D1Database { const binding = (env as unknown as {DB?: D1Database}).DB; if (!binding) throw new Error('DB unavailable'); return binding; }
export function bucket(): R2Bucket { const binding = (env as unknown as {BUCKET?: R2Bucket}).BUCKET; if (!binding) throw new Error('Storage unavailable'); return binding; }
export function failure(error: unknown) { console.error('[speck]', error); return Response.json({error: '저장소에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'}, {status:503}); }
export function validOrigin(request: Request) { const origin=request.headers.get('origin'); return !origin || origin===new URL(request.url).origin; }
