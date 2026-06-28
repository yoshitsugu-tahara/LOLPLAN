import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ───────────────────────── Auth.js 標準テーブル ─────────────────────────
// https://authjs.dev/getting-started/adapters/drizzle に準拠

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ───────────────────────── 招待制 allowlist ─────────────────────────
// ここに載っているメール（＋ env の OWNER_EMAIL）だけログインできる。

export const allowedEmails = pgTable("allowed_email", {
  email: text("email").primaryKey(),
  invitedBy: text("invited_by"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// ───────────────────────── アプリのデータ（ユーザー単位） ─────────────────────────

export const sections = pgTable(
  "section",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    order: integer("order").notNull(),
  },
  (t) => [index("section_user_idx").on(t.userId)],
);

export const notes = pgTable(
  "note",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    content: jsonb("content"),
    sectionId: text("section_id"),
    // 新規ノートを先頭に置くため -Date.now() を入れるので integer では溢れる
    order: bigint("order", { mode: "number" }),
    labels: text("labels").array(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("note_user_idx").on(t.userId),
    index("note_user_updated_idx").on(t.userId, t.updatedAt),
  ],
);

export const maps = pgTable(
  "map",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    snapshot: jsonb("snapshot"),
    preview: text("preview"),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [index("map_user_idx").on(t.userId)],
);

export const plans = pgTable(
  "plan",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    snapshot: jsonb("snapshot"),
    preview: text("preview"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [index("plan_user_idx").on(t.userId)],
);
