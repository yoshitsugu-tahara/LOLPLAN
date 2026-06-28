import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// DATABASE_URL 未設定時はダミー接続文字列を使う（ビルド時にモジュールが
// 読み込まれても neon() は実接続しないので落ちない）。実クエリは実行時に
// 本物の DATABASE_URL で行われる。
const url =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

const sql = neon(url);

export const db = drizzle(sql, { schema });
export { schema };
