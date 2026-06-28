import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// .env.local を読み込む（drizzle-kit は Next と違い自動では読まない）
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
