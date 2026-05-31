import "dotenv/config";
import { defineConfig } from "prisma/config";

const defaultDatabaseUrl =
  "postgresql://postgres:postgres@localhost:5432/english_long_sentence_trainer?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx scripts/seed-admin.ts"
  }
});
