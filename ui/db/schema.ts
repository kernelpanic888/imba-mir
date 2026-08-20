import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Owner-only aggregate telemetry. No visitor identifiers, addresses, user
 * agents, game choices, or session tokens are stored in D1.
 */
export const authorMetrics = sqliteTable("author_metrics", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});
