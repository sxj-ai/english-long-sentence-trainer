"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clearSession, getDefaultPathForRole, setSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

function getSafeRedirectTo(value: FormDataEntryValue | null) {
  const redirectTo = String(value ?? "").trim();

  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "";
  }

  return redirectTo;
}

function getLoginErrorPath(error: string, redirectTo: string) {
  const params = new URLSearchParams({ error });

  if (redirectTo) {
    params.set("redirectTo", redirectTo);
  }

  return `/login?${params.toString()}`;
}

export async function loginAction(formData: FormData) {
  const loginId = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = getSafeRedirectTo(formData.get("redirectTo"));

  if (!loginId || !password) {
    redirect(getLoginErrorPath("missing", redirectTo));
  }

  const userByUsername = await prisma.user.findUnique({
    where: { username: loginId }
  });
  const studentByNo = userByUsername
    ? null
    : await prisma.studentProfile.findUnique({
        where: { studentNo: loginId },
        include: { user: true }
      });
  const user = userByUsername ?? studentByNo?.user;

  if (!user || user.status !== "ACTIVE") {
    redirect(getLoginErrorPath("invalid", redirectTo));
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    redirect(getLoginErrorPath("invalid", redirectTo));
  }

  await setSession({
    id: user.id,
    role: user.role
  });

  redirect(user.role === "STUDENT" && redirectTo ? redirectTo : getDefaultPathForRole(user.role));
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function registerStudentAction(formData: FormData) {
  const realName = String(formData.get("realName") ?? "").trim();
  const studentNo = String(formData.get("studentNo") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const invitationCode = String(formData.get("invitationCode") ?? "")
    .trim()
    .toUpperCase();

  if (!realName || !studentNo || !username || !password || !confirmPassword || !invitationCode) {
    redirect("/register?error=missing");
  }

  if (password.length < 8) {
    redirect("/register?error=weak-password");
  }

  if (password !== confirmPassword) {
    redirect("/register?error=password-mismatch");
  }

  const teacher = await prisma.teacherProfile.findUnique({
    where: { invitationCode },
    include: { user: true }
  });

  if (!teacher || teacher.user.status !== "ACTIVE") {
    redirect("/register?error=invalid-code");
  }

  const [existingUsername, existingStudentNo, usernameAsStudentNo, studentNoAsUsername] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    prisma.studentProfile.findUnique({ where: { studentNo } }),
    prisma.studentProfile.findUnique({ where: { studentNo: username } }),
    prisma.user.findUnique({ where: { username: studentNo } })
  ]);

  if (existingUsername || studentNoAsUsername) {
    redirect("/register?error=username-exists");
  }

  if (existingStudentNo || usernameAsStudentNo) {
    redirect("/register?error=student-no-exists");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: "STUDENT",
      status: "ACTIVE",
      studentProfile: {
        create: {
          realName,
          studentNo,
          teacherId: teacher.id,
          status: "PENDING_CLASS"
        }
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "REGISTER_STUDENT",
      targetType: "StudentProfile",
      payloadJson: {
        realName,
        studentNo,
        username,
        teacherId: teacher.id,
        teacherName: teacher.realName
      }
    }
  });

  await setSession({
    id: user.id,
    role: user.role
  });

  redirect("/student?registered=1");
}
