import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const monitors = sqliteTable("monitors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  ingredient: text("ingredient").notNull(),
  productName: text("product_name").notNull().default(""),
  aliases: text("aliases").notNull().default(""),
  regions: text("regions").notNull().default("KR,US,EU"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const monitoringRuns = sqliteTable("monitoring_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  weekKey: text("week_key").notNull(),
  reportSequence: integer("report_sequence").notNull().default(1),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  status: text("status").notNull().default("queued"),
  monitorCount: integer("monitor_count").notNull(),
  monitorSnapshot: text("monitor_snapshot").notNull(),
  triggerType: text("trigger_type").notNull().default("manual"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  errorMessage: text("error_message"),
});
