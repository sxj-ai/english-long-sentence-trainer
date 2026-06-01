import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

const sessionCookieName = "trainer_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;
const defaultAuthSecret = "dev-only-change-before-deployment";

interface SessionPayload {
  userId: string;
  role: UserRole;
  exp: number;
}

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  displayName: string;
}

function isTransientDatabaseError(error: unknown) {
  const candidate = error as {
    code?: string;
    message?: string;
    meta?: {
      driverAdapterError?: {
        name?: string;
      };
    };
  };

  return (
    candidate.code === "P1017" ||
    candidate.code === "P1001" ||
    candidate.meta?.driverAdapterError?.name === "DriverAdapterError" ||
    candidate.message?.includes("ConnectionClosed") ||
    candidate.message?.includes("Server has closed the connection")
  );
}

async function withDatabaseRetry<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDatabaseError(error)) {
      throw error;
    }

    console.warn("Transient database error; retrying once.");
    await new Promise((resolve) => setTimeout(resolve, 300));
    return operation();
  }
}

function getAuthSecret() {
  return process.env.AUTH_SECRET ?? defaultAuthSecret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function createSessionToken(payload: SessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;

    if (!payload.userId || !payload.role || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function setSession(user: { id: string; role: UserRole }) {
  const cookieStore = await cookies();
  const token = createSessionToken({
    userId: user.id,
    role: user.role,
    exp: Date.now() + sessionMaxAgeSeconds * 1000
  });

  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds
  });
}

export async function clearSession() {
  const cookieStore = await cookies();

  cookieStore.delete(sessionCookieName);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);

  if (!payload) {
    return null;
  }

  const user = await withDatabaseRetry(() =>
    prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        adminProfile: true,
        teacherProfile: true,
        studentProfile: true
      }
    })
  );

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName:
      user.adminProfile?.displayName ??
      user.teacherProfile?.realName ??
      user.studentProfile?.realName ??
      user.username
  };
}

export async function requireUser(role?: UserRole) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (role && user.role !== role) {
    redirect("/");
  }

  return user;
}

export function getDefaultPathForRole(role: UserRole) {
  if (role === "ADMIN") {
    return "/admin";
  }

  if (role === "TEACHER") {
    return "/teacher";
  }

  return "/student";
}
