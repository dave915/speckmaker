export type Screen = { name: string; selector?: string; index?: number; panelId?: string };
export type Project = { id: string; name: string; color: string; created_at: number; count?: number };
export type Mockup = { id: string; project_id: string; name: string; screens: Screen[]; created_at: number };
export type Comment = { id: string; project_id: string; mockup_id: string | null; screen_index: number | null; x: number | null; y: number | null; author: string; body: string; parent_id: string | null; resolved: number; created_at: number };
export type Person = { id: string; name: string; color: string; x: number | null; y: number | null };
export type WorkspaceState = { projects: Project[]; mockups: Mockup[]; comments: Comment[]; people: Person[] };
