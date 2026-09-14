import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(), name: text('name').notNull(), color: text('color').notNull(), createdAt: integer('created_at').notNull(),
});
export const mockups = sqliteTable('mockups', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(), revision: integer('revision').notNull().default(0), storageKey: text('storage_key'), screens: text('screens').notNull(), createdAt: integer('created_at').notNull(),
}, t => [index('idx_mockups_project').on(t.projectId)]);
export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id),
  mockupId: text('mockup_id').references(() => mockups.id), screenIndex: integer('screen_index'),
  x: real('x'), y: real('y'), anchorHeight: integer('anchor_height').notNull().default(880), author: text('author').notNull(), body: text('body').notNull(),
  parentId: text('parent_id'), resolved: integer('resolved').notNull().default(0), createdAt: integer('created_at').notNull(),
}, t => [index('idx_comments_project_created').on(t.projectId, t.createdAt)]);
export const presence = sqliteTable('presence', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(), name: text('name').notNull(),
  color: text('color').notNull(), x: real('x'), y: real('y'), updatedAt: integer('updated_at').notNull(),
}, t => [index('idx_presence_project_updated').on(t.projectId, t.updatedAt)]);

export const revisions = sqliteTable('revisions', {
  id: text('id').primaryKey(), mockupId: text('mockup_id').notNull().references(() => mockups.id),
  revision: integer('revision').notNull(), storageKey: text('storage_key').notNull(), screens: text('screens').notNull(),
  kind: text('kind').notNull(), author: text('author').notNull(), prompt: text('prompt').notNull().default(''),
  model: text('model'), restoredFrom: integer('restored_from'), label: text('label'), versionNumber: integer('version_number'),
  createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('idx_revisions_mockup_revision').on(t.mockupId, t.revision), uniqueIndex('idx_revisions_named_version').on(t.mockupId, t.versionNumber)]);
