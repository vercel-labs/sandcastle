import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const workspaceStatusEnum = pgEnum("workspace_status", [
  "active",
  "stopped",
  "snapshotted",
  "creating",
  "error",
]);

export const userRoleEnum = pgEnum("user_role", ["user", "admin", "guest"]);

export const appTypeEnum = pgEnum("app_type", ["builtin", "x11", "web"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  vercelId: text("vercel_id"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  sandboxId: text("sandbox_id"),
  snapshotId: text("snapshot_id"),
  icon: text("icon").default("terminal").notNull(),
  status: workspaceStatusEnum("status").default("stopped").notNull(),
  windowState: jsonb("window_state"),
  background: text("background"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const apps = pgTable("apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  icon: text("icon").default("/icons/default.svg").notNull(),
  type: appTypeEnum("type").notNull(),
  command: text("command"),
  component: text("component"),
  category: text("category").default("Other").notNull(),
});

export const warmPoolStatusEnum = pgEnum("warm_pool_status", [
  "available",
  "claimed",
  "expired",
]);

export const warmPool = pgTable("warm_pool", {
  id: uuid("id").primaryKey().defaultRandom(),
  sandboxId: text("sandbox_id").notNull(),
  snapshotId: text("snapshot_id").notNull(),
  status: warmPoolStatusEnum("status").default("available").notNull(),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Global config table for things like the golden snapshot ID
export const config = pgTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AccountRow = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type AppRow = typeof apps.$inferSelect;
export type ConfigRow = typeof config.$inferSelect;
export type WarmPoolRow = typeof warmPool.$inferSelect;
