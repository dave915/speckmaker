export type Screen = { name: string; selector?: string; index?: number; panelId?: string };
export type Project = { id: string; name: string; color: string; created_at: number; count?: number };
export type Mockup = { id: string; project_id: string; name: string; revision: number; screens: Screen[]; created_at: number };
export type Comment = { id: string; project_id: string; mockup_id: string | null; screen_index: number | null; x: number | null; y: number | null; anchor_height: number; author: string; body: string; parent_id: string | null; resolved: number; created_at: number };
export type Person = { id: string; name: string; color: string; x: number | null; y: number | null };
export type WorkspaceState = { projects: Project[]; mockups: Mockup[]; comments: Comment[]; people: Person[] };

export type Revision = {id:string; mockup_id:string; revision:number; screens:Screen[]; kind:'upload'|'ai'|'restore'; author:string; prompt:string; model:string|null; restored_from:number|null; label:string|null; version_number:number|null; created_at:number};
export type MockupPreview = {viewKey?:string;mockupId:string; html:string; screens:Screen[]; title:string; kind:'ai'|'revision'; revision?:number};
