import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(), name: text('name').notNull(), color: text('color').notNull(), createdAt: integer('created_at').notNull(),
});
export const mockups = sqliteTable('mockups', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(), storageKey: text('storage_key'), screens: text('screens').notNull(), createdAt: integer('created_at').notNull(),
}, t => [index('idx_mockups_project').on(t.projectId)]);
export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id),
  mockupId: text('mockup_id').references(() => mockups.id), screenIndex: integer('screen_index'),
  x: real('x'), y: real('y'), author: text('author').notNull(), body: text('body').notNull(),
  parentId: text('parent_id'), resolved: integer('resolved').notNull().default(0), createdAt: integer('created_at').notNull(),
}, t => [index('idx_comments_project_created').on(t.projectId, t.createdAt)]);
export const presence = sqliteTable('presence', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(), name: text('name').notNull(),
  color: text('color').notNull(), x: real('x'), y: real('y'), updatedAt: integer('updated_at').notNull(),
}, t => [index('idx_presence_project_updated').on(t.projectId, t.updatedAt)]);
