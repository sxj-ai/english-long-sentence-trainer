"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import type { ImportanceLevel, VocabularySourceType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseOptionalInt(value: FormDataEntryValue | null) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const parsed = Number.parseInt(text, 10);

  if (!Number.isFinite(parsed)) {
    return "invalid" as const;
  }

  return parsed;
}

function parseSourceType(value: FormDataEntryValue | null) {
  const text = normalizeText(value);

  if (text === "ARTICLE" || text === "UNIT" || text === "MANUAL") {
    return text as VocabularySourceType;
  }

  return null;
}

function parseImportanceLevel(value: FormDataEntryValue | null) {
  const text = normalizeText(value);

  if (text === "LOW" || text === "MEDIUM" || text === "HIGH") {
    return text as ImportanceLevel;
  }

  return null;
}

async function getCurrentAdminProfile() {
  const adminUser = await requireUser("ADMIN");
  const adminProfile = await prisma.adminProfile.findUnique({
    where: { userId: adminUser.id }
  });

  if (!adminProfile) {
    redirect("/admin?vocabularyError=admin-profile-missing");
  }

  return { adminUser, adminProfile };
}

function generateManualSourceKey() {
  return `manual:${randomBytes(8).toString("hex")}`;
}

function buildVocabularyPayload(formData: FormData) {
  const word = normalizeText(formData.get("word"));
  const meaning = normalizeText(formData.get("meaning"));
  const pos = normalizeText(formData.get("pos"));
  const sourceType = parseSourceType(formData.get("sourceType"));
  const sourceArticleId = normalizeText(formData.get("sourceArticleId"));
  const sourceSentenceId = normalizeText(formData.get("sourceSentenceId"));
  const sourceChunkId = normalizeText(formData.get("sourceChunkId"));
  const sourceFile = normalizeText(formData.get("sourceFile"));
  const sourceText = normalizeText(formData.get("sourceText"));
  const unitCode = normalizeText(formData.get("unitCode"));
  const examYear = parseOptionalInt(formData.get("examYear"));
  const examType = normalizeText(formData.get("examType"));
  const textId = normalizeText(formData.get("textId"));
  const importanceLevel = parseImportanceLevel(formData.get("importanceLevel"));

  return {
    word,
    meaning,
    pos,
    sourceType,
    sourceArticleId,
    sourceSentenceId,
    sourceChunkId,
    sourceFile,
    sourceText,
    unitCode,
    examYear,
    examType,
    textId,
    importanceLevel
  };
}

type VocabularyPayload = ReturnType<typeof buildVocabularyPayload>;

type ValidatedVocabularyPayload = Omit<VocabularyPayload, "sourceType" | "examYear" | "importanceLevel"> & {
  sourceType: VocabularySourceType;
  examYear: number | null;
  importanceLevel: ImportanceLevel;
};

function ensureVocabularyFields(payload: VocabularyPayload): ValidatedVocabularyPayload {
  if (!payload.word || !payload.meaning) {
    redirectWithError("missing");
  }

  if (payload.sourceType === null || payload.importanceLevel === null) {
    redirectWithError("missing");
  }

  if (payload.examYear === "invalid") {
    redirectWithError("invalid-exam-year");
  }

  return payload as ValidatedVocabularyPayload;
}

function redirectWithError(error: string) {
  redirect(`/admin/vocabulary?vocabularyError=${encodeURIComponent(error)}`);
}

export async function createVocabularyItemAction(formData: FormData) {
  const { adminUser, adminProfile } = await getCurrentAdminProfile();
  const payload = ensureVocabularyFields(buildVocabularyPayload(formData));

  const vocabularyItem = await prisma.vocabularyItem.create({
    data: {
      sourceKey: generateManualSourceKey(),
      word: payload.word,
      meaning: payload.meaning,
      pos: payload.pos || null,
      sourceType: payload.sourceType,
      sourceArticleId: payload.sourceArticleId || null,
      sourceSentenceId: payload.sourceSentenceId || null,
      sourceChunkId: payload.sourceChunkId || null,
      sourceFile: payload.sourceFile || null,
      sourceText: payload.sourceText || null,
      unitCode: payload.unitCode || null,
      examYear: payload.examYear === null ? null : payload.examYear,
      examType: payload.examType || null,
      textId: payload.textId || null,
      importanceLevel: payload.importanceLevel
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: adminUser.id,
      action: "CREATE_VOCABULARY_ITEM",
      targetType: "VocabularyItem",
      targetId: vocabularyItem.id,
      payloadJson: {
        word: vocabularyItem.word,
        meaning: vocabularyItem.meaning,
        sourceType: vocabularyItem.sourceType,
        sourceKey: vocabularyItem.sourceKey,
        adminId: adminProfile.id
      }
    }
  });

  redirect(`/admin/vocabulary?createdVocabulary=${encodeURIComponent(vocabularyItem.word)}`);
}

export async function updateVocabularyItemAction(formData: FormData) {
  const { adminUser, adminProfile } = await getCurrentAdminProfile();
  const vocabularyItemId = normalizeText(formData.get("vocabularyItemId"));
  const payload = ensureVocabularyFields(buildVocabularyPayload(formData));

  if (!vocabularyItemId) {
    redirectWithError("missing");
  }

  const existingItem = await prisma.vocabularyItem.findUnique({
    where: { id: vocabularyItemId }
  });

  if (!existingItem) {
    redirectWithError("not-found");
  }

  const item = existingItem as NonNullable<typeof existingItem>;

  const vocabularyItem = await prisma.vocabularyItem.update({
    where: { id: vocabularyItemId },
    data: {
      word: payload.word,
      meaning: payload.meaning,
      pos: payload.pos || null,
      sourceType: payload.sourceType,
      sourceArticleId: payload.sourceArticleId || null,
      sourceSentenceId: payload.sourceSentenceId || null,
      sourceChunkId: payload.sourceChunkId || null,
      sourceFile: payload.sourceFile || null,
      sourceText: payload.sourceText || null,
      unitCode: payload.unitCode || null,
      examYear: payload.examYear === null ? null : payload.examYear,
      examType: payload.examType || null,
      textId: payload.textId || null,
      importanceLevel: payload.importanceLevel
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: adminUser.id,
      action: "UPDATE_VOCABULARY_ITEM",
      targetType: "VocabularyItem",
      targetId: vocabularyItem.id,
      payloadJson: {
        word: vocabularyItem.word,
        meaning: vocabularyItem.meaning,
        sourceType: vocabularyItem.sourceType,
        sourceKey: vocabularyItem.sourceKey,
        adminId: adminProfile.id
      }
    }
  });

  redirect(`/admin/vocabulary?updatedVocabulary=${encodeURIComponent(vocabularyItem.word)}`);
}

export async function deleteVocabularyItemAction(formData: FormData) {
  const { adminUser, adminProfile } = await getCurrentAdminProfile();
  const vocabularyItemId = normalizeText(formData.get("vocabularyItemId"));

  if (!vocabularyItemId) {
    redirectWithError("missing");
  }

  const existingItem = await prisma.vocabularyItem.findUnique({
    where: { id: vocabularyItemId },
    include: {
      _count: {
        select: {
          examQuestions: true
        }
      }
    }
  });

  if (!existingItem) {
    redirectWithError("not-found");
  }

  const item = existingItem as NonNullable<typeof existingItem>;

  if (item._count.examQuestions > 0) {
    redirectWithError("in-use");
  }

  await prisma.vocabularyItem.delete({
    where: { id: vocabularyItemId }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: adminUser.id,
      action: "DELETE_VOCABULARY_ITEM",
      targetType: "VocabularyItem",
      targetId: item.id,
      payloadJson: {
        word: item.word,
        sourceType: item.sourceType,
        sourceKey: item.sourceKey,
        adminId: adminProfile.id
      }
    }
  });

  redirect("/admin/vocabulary?deletedVocabulary=1");
}
