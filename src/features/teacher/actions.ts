"use server";

import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getCurrentTeacherProfile() {
  const teacherUser = await requireUser("TEACHER");
  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: teacherUser.id }
  });

  if (!teacher) {
    redirect("/teacher?teacherError=teacher-profile-missing");
  }

  return { teacherUser, teacher };
}

export async function createClassAction(formData: FormData) {
  const { teacherUser, teacher } = await getCurrentTeacherProfile();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    redirect("/teacher?classError=missing-name");
  }

  const existingClass = await prisma.class.findUnique({
    where: {
      teacherId_name: {
        teacherId: teacher.id,
        name
      }
    }
  });

  if (existingClass) {
    redirect("/teacher?classError=name-exists");
  }

  const classItem = await prisma.class.create({
    data: {
      teacherId: teacher.id,
      name,
      description: description || null
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: teacherUser.id,
      action: "CREATE_CLASS",
      targetType: "Class",
      targetId: classItem.id,
      payloadJson: {
        name,
        description: description || null
      }
    }
  });

  redirect(`/teacher?createdClass=${encodeURIComponent(name)}`);
}

export async function assignStudentToClassAction(formData: FormData) {
  const { teacherUser, teacher } = await getCurrentTeacherProfile();
  const studentId = String(formData.get("studentId") ?? "").trim();
  const classId = String(formData.get("classId") ?? "").trim();

  if (!studentId || !classId) {
    redirect("/teacher?assignError=missing");
  }

  const [student, classItem] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { id: studentId }
    }),
    prisma.class.findUnique({
      where: { id: classId }
    })
  ]);

  if (!student || student.teacherId !== teacher.id) {
    redirect("/teacher?assignError=student-not-found");
  }

  if (!classItem || classItem.teacherId !== teacher.id || classItem.status !== "ACTIVE") {
    redirect("/teacher?assignError=class-not-found");
  }

  await prisma.studentProfile.update({
    where: { id: student.id },
    data: {
      classId: classItem.id,
      status: "ACTIVE"
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: teacherUser.id,
      action: "ASSIGN_STUDENT_TO_CLASS",
      targetType: "StudentProfile",
      targetId: student.id,
      payloadJson: {
        studentNo: student.studentNo,
        studentName: student.realName,
        classId: classItem.id,
        className: classItem.name
      }
    }
  });

  redirect(
    `/teacher?assignedStudent=${encodeURIComponent(student.realName)}&assignedClass=${encodeURIComponent(classItem.name)}`
  );
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "invalid" as const;
  }

  return date;
}

function parsePositiveInt(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

interface ExamDraftInput {
  teacherUserId: string;
  teacherId: string;
  classItem: {
    id: string;
    name: string;
  };
  title: string;
  description: string | null;
  timeLimitMinutes: number;
  scorePerQuestion: number;
  startAt: Date | null;
  submitDeadline: Date | null;
  gradingDeadline: Date | null;
  vocabularyItems: Array<{
    id: string;
    word: string;
    meaning: string;
  }>;
}

async function createExamDraftRecord(input: ExamDraftInput) {
  if (input.vocabularyItems.length === 0) {
    redirect("/teacher?examError=no-questions");
  }

  const exam = await prisma.exam.create({
    data: {
      teacherId: input.teacherId,
      classId: input.classItem.id,
      title: input.title,
      description: input.description,
      status: "DRAFT",
      startAt: input.startAt,
      submitDeadline: input.submitDeadline,
      gradingDeadline: input.gradingDeadline,
      timeLimitMinutes: input.timeLimitMinutes,
      scorePerQuestion: input.scorePerQuestion,
      questions: {
        create: input.vocabularyItems.map((item, index) => ({
          vocabularyItemId: item.id,
          promptWord: item.word,
          standardMeaning: item.meaning,
          orderIndex: index + 1,
          score: input.scorePerQuestion
        }))
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: input.teacherUserId,
      action: "CREATE_EXAM_DRAFT",
      targetType: "Exam",
      targetId: exam.id,
      payloadJson: {
        title: input.title,
        className: input.classItem.name,
        questionCount: input.vocabularyItems.length
      }
    }
  });

  return exam;
}

async function getOwnedExamForTeacher(examId: string) {
  const { teacherUser, teacher } = await getCurrentTeacherProfile();
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      class: true,
      _count: {
        select: {
          questions: true
        }
      }
    }
  });

  if (!exam || exam.teacherId !== teacher.id || exam.class.teacherId !== teacher.id) {
    redirect("/teacher?examError=exam-not-found");
  }

  return { teacherUser, teacher, exam };
}

export async function createExamDraftAction(formData: FormData) {
  const { teacherUser, teacher } = await getCurrentTeacherProfile();
  const title = String(formData.get("title") ?? "").trim();
  const classId = String(formData.get("classId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const timeLimitMinutes = parsePositiveInt(formData.get("timeLimitMinutes"), 20);
  const scorePerQuestion = parsePositiveInt(formData.get("scorePerQuestion"), 1);
  const startAt = parseOptionalDate(formData.get("startAt"));
  const submitDeadline = parseOptionalDate(formData.get("submitDeadline"));
  const gradingDeadline = parseOptionalDate(formData.get("gradingDeadline"));
  const vocabularyItemIds = formData
    .getAll("vocabularyItemIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!title || !classId) {
    redirect("/teacher?examError=missing");
  }

  if (startAt === "invalid" || submitDeadline === "invalid" || gradingDeadline === "invalid") {
    redirect("/teacher?examError=invalid-date");
  }

  if (vocabularyItemIds.length === 0) {
    redirect("/teacher?examError=no-questions");
  }

  const classItem = await prisma.class.findUnique({
    where: { id: classId }
  });

  if (!classItem || classItem.teacherId !== teacher.id || classItem.status !== "ACTIVE") {
    redirect("/teacher?examError=class-not-found");
  }

  const vocabularyItems = await prisma.vocabularyItem.findMany({
    where: {
      id: {
        in: vocabularyItemIds
      }
    },
    orderBy: [{ examYear: "desc" }, { textId: "asc" }, { word: "asc" }]
  });

  if (vocabularyItems.length !== vocabularyItemIds.length) {
    redirect("/teacher?examError=vocabulary-not-found");
  }

  const orderById = new Map(vocabularyItemIds.map((id, index) => [id, index]));
  const sortedVocabularyItems = vocabularyItems.sort(
    (a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0)
  );

  await createExamDraftRecord({
    teacherUserId: teacherUser.id,
    teacherId: teacher.id,
    classItem,
    title,
    description: description || null,
    timeLimitMinutes,
    scorePerQuestion,
    startAt,
    submitDeadline,
    gradingDeadline,
    vocabularyItems: sortedVocabularyItems
  });

  redirect(`/teacher?createdExam=${encodeURIComponent(title)}`);
}

export async function createAutoExamDraftAction(formData: FormData) {
  const { teacherUser, teacher } = await getCurrentTeacherProfile();
  const title = String(formData.get("title") ?? "").trim();
  const classId = String(formData.get("classId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const timeLimitMinutes = parsePositiveInt(formData.get("timeLimitMinutes"), 20);
  const scorePerQuestion = parsePositiveInt(formData.get("scorePerQuestion"), 1);
  const questionCount = parsePositiveInt(formData.get("questionCount"), 10);
  const startAt = parseOptionalDate(formData.get("startAt"));
  const submitDeadline = parseOptionalDate(formData.get("submitDeadline"));
  const gradingDeadline = parseOptionalDate(formData.get("gradingDeadline"));
  const vocabQ = String(formData.get("vocabQ") ?? "").trim();
  const vocabYear = String(formData.get("vocabYear") ?? "").trim();
  const vocabExamType = String(formData.get("vocabExamType") ?? "").trim();
  const vocabTextId = String(formData.get("vocabTextId") ?? "").trim();

  if (!title || !classId) {
    redirect("/teacher?autoExamError=missing");
  }

  if (startAt === "invalid" || submitDeadline === "invalid" || gradingDeadline === "invalid") {
    redirect("/teacher?autoExamError=invalid-date");
  }

  if (questionCount <= 0) {
    redirect("/teacher?autoExamError=missing");
  }

  const classItem = await prisma.class.findUnique({
    where: { id: classId }
  });

  if (!classItem || classItem.teacherId !== teacher.id || classItem.status !== "ACTIVE") {
    redirect("/teacher?autoExamError=class-not-found");
  }

  const vocabularyWhere: Prisma.VocabularyItemWhereInput = {};

  if (vocabQ) {
    vocabularyWhere.OR = [
      { word: { contains: vocabQ, mode: "insensitive" } },
      { meaning: { contains: vocabQ, mode: "insensitive" } }
    ];
  }

  if (vocabYear) {
    const year = Number.parseInt(vocabYear, 10);

    if (Number.isFinite(year)) {
      vocabularyWhere.examYear = year;
    }
  }

  if (vocabExamType) {
    vocabularyWhere.examType = vocabExamType;
  }

  if (vocabTextId) {
    vocabularyWhere.textId = vocabTextId;
  }

  const vocabularyItems = await prisma.vocabularyItem.findMany({
    where: vocabularyWhere,
    orderBy: [{ examYear: "desc" }, { examType: "asc" }, { textId: "asc" }, { word: "asc" }]
  });

  if (vocabularyItems.length < questionCount) {
    redirect("/teacher?autoExamError=not-enough-questions");
  }

  const selectedItems = shuffleItems(vocabularyItems).slice(0, questionCount);

  await createExamDraftRecord({
    teacherUserId: teacherUser.id,
    teacherId: teacher.id,
    classItem,
    title,
    description: description || null,
    timeLimitMinutes,
    scorePerQuestion,
    startAt,
    submitDeadline,
    gradingDeadline,
    vocabularyItems: selectedItems
  });

  redirect(`/teacher?generatedExam=${encodeURIComponent(title)}`);
}

export async function publishExamAction(formData: FormData) {
  const examId = String(formData.get("examId") ?? "").trim();

  if (!examId) {
    redirect("/teacher?publishError=missing");
  }

  const { teacherUser, exam } = await getOwnedExamForTeacher(examId);

  if (exam.status !== "DRAFT") {
    redirect("/teacher?publishError=not-draft");
  }

  if (exam._count.questions < 1) {
    redirect("/teacher?publishError=no-questions");
  }

  await prisma.exam.update({
    where: { id: exam.id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date()
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: teacherUser.id,
      action: "PUBLISH_EXAM",
      targetType: "Exam",
      targetId: exam.id,
      payloadJson: {
        title: exam.title,
        className: exam.class.name,
        questionCount: exam._count.questions
      }
    }
  });

  redirect(`/teacher?publishedExam=${encodeURIComponent(exam.title)}`);
}

export async function closeExamAction(formData: FormData) {
  const examId = String(formData.get("examId") ?? "").trim();

  if (!examId) {
    redirect("/teacher/exams?error=missing-exam");
  }

  const { teacherUser, teacher, exam } = await getOwnedExamForTeacher(examId);

  if (exam.status !== "PUBLISHED") {
    redirect(`/teacher/exams/${exam.id}?error=not-published`);
  }

  await prisma.exam.update({
    where: { id: exam.id },
    data: {
      status: "CLOSED"
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: teacherUser.id,
      action: "CLOSE_EXAM",
      targetType: "Exam",
      targetId: exam.id,
      payloadJson: {
        title: exam.title,
        className: exam.class.name,
        teacherId: teacher.id
      }
    }
  });

  redirect(`/teacher/exams/${exam.id}?closedExam=${encodeURIComponent(exam.title)}`);
}

export async function reopenExamAction(formData: FormData) {
  const examId = String(formData.get("examId") ?? "").trim();

  if (!examId) {
    redirect("/teacher/exams?error=missing-exam");
  }

  const { teacherUser, teacher, exam } = await getOwnedExamForTeacher(examId);

  if (exam.status !== "CLOSED") {
    redirect(`/teacher/exams/${exam.id}?error=not-closed`);
  }

  await prisma.exam.update({
    where: { id: exam.id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date()
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: teacherUser.id,
      action: "REOPEN_EXAM",
      targetType: "Exam",
      targetId: exam.id,
      payloadJson: {
        title: exam.title,
        className: exam.class.name,
        teacherId: teacher.id
      }
    }
  });

  redirect(`/teacher/exams/${exam.id}?reopenedExam=${encodeURIComponent(exam.title)}`);
}
