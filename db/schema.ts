import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('accounting_workspaces',{
 ownerId:text('owner_id').primaryKey(),
 stateJson:text('state_json').notNull(),
 revision:integer('revision').notNull().default(0),
 updatedAt:text('updated_at').notNull(),
});
