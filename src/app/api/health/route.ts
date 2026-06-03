import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function hasValue(name: string) {
  return Boolean(process.env[name]?.trim());
}

function getDatabaseHost() {
  const value = process.env.DATABASE_URL;

  if (!value) {
    return null;
  }

  try {
    return new URL(value).host;
  } catch {
    return "invalid-url";
  }
}

export async function GET() {
  const env = {
    DATABASE_URL: hasValue("DATABASE_URL"),
    AUTH_SECRET: hasValue("AUTH_SECRET"),
    SUB2API_BASE_URL: hasValue("SUB2API_BASE_URL"),
    SUB2API_API_KEY: hasValue("SUB2API_API_KEY"),
    SUB2API_MODEL: hasValue("SUB2API_MODEL")
  };

  let database:
    | {
        ok: true;
        host: string | null;
        currentDatabase: string;
        currentUser: string;
      }
    | {
        ok: false;
        host: string | null;
        error: string;
      };

  try {
    const result = await prisma.$queryRaw<Array<{ current_database: string; current_user: string }>>`
      SELECT current_database(), current_user
    `;

    database = {
      ok: true,
      host: getDatabaseHost(),
      currentDatabase: result[0]?.current_database ?? "unknown",
      currentUser: result[0]?.current_user ?? "unknown"
    };
  } catch (error) {
    const candidate = error as { code?: string; message?: string };
    database = {
      ok: false,
      host: getDatabaseHost(),
      error: candidate.code ?? candidate.message ?? "unknown-error"
    };
  }

  return NextResponse.json({
    ok: database.ok,
    env,
    database
  });
}
