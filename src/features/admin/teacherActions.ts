"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

function normalizeUsername(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function generateInvitationCode() {
  return `T-${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function createUniqueInvitationCode() {
  for (let index = 0; index < 6; index += 1) {
    const invitationCode = generateInvitationCode();
    const existingTeacher = await prisma.teacherProfile.findUnique({
      where: { invitationCode }
    });

    if (!existingTeacher) {
      return invitationCode;
    }
  }

  throw new Error("Unable to generate a unique invitation code.");
}

export async function createTeacherAction(formData: FormData) {
  const admin = await requireUser("ADMIN");
  const username = normalizeUsername(formData.get("username"));
  const realName = normalizeUsername(formData.get("realName"));
  const password = String(formData.get("password") ?? "");

  if (!username || !realName || !password) {
    redirect("/admin?teacherError=missing");
  }

  if (password.length < 8) {
    redirect("/admin?teacherError=weak-password");
  }

  const existingUser = await prisma.user.findUnique({
    where: { username }
  });

  if (existingUser) {
    redirect("/admin?teacherError=username-exists");
  }

  const adminProfile = await prisma.adminProfile.findUnique({
    where: { userId: admin.id }
  });

  if (!adminProfile) {
    redirect("/admin?teacherError=admin-profile-missing");
  }

  const invitationCode = await createUniqueInvitationCode();
  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: {
        create: {
          realName,
          invitationCode,
          createdByAdminId: adminProfile.id
        }
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "CREATE_TEACHER",
      targetType: "TeacherProfile",
      payloadJson: {
        username,
        realName,
        invitationCode
      }
    }
  });

  redirect(`/admin?createdTeacher=${encodeURIComponent(realName)}&invitationCode=${encodeURIComponent(invitationCode)}`);
}
