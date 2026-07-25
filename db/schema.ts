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
