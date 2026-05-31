import type { Prisma } from "@prisma/client";
import { gradeWithAi } from "@/features/ai-grading/aiGradingService";
import { getArticle } from "@/features/article/jsonArticleRepository";
import { getPrecisionPracticeItems } from "@/features/practice/precisionPracticeRepository";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type PrecisionGradeRequest = {
  articleId?: string;
  practiceId?: string;
  taskId?: string;
  studentAnswer?: string;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PrecisionGradeRequest;
  const articleId = String(body.articleId || "").trim();
  const practiceId = String(body.practiceId || "").trim();
  const taskId = String(body.taskId || "").trim();
  const studentAnswer = String(body.studentAnswer || "").trim();

  if (!articleId || !practiceId || !taskId || !studentAnswer) {
    return Response.json({ error: "缺少文章、题目或学生答案。" }, { status: 400 });
  }

  const article = await getArticle(articleId);
  if (!article) {
    return Response.json({ error: "没有找到对应文章。" }, { status: 404 });
  }

  const items = await getPrecisionPracticeItems(article);
  const item = items.find((candidate) => candidate.practiceId === practiceId);
  const task = item?.subjectiveTasks.find((candidate) => candidate.taskId === taskId);
  const sentence = item ? article.sentences.find((candidate) => candidate.sentenceId === item.sourceSentenceId) : null;

  if (!item || !task || !sentence) {
    return Response.json({ error: "没有找到对应精分析题。" }, { status: 404 });
  }

  const result = await gradeWithAi({
    articleId: article.id,
    sentenceId: sentence.sentenceId,
    original: sentence.original,
    translationLiteral: sentence.translationLiteral,
    chunks: sentence.chunks,
    question: task.prompt,
    studentAnswer,
    gradingRubric: JSON.stringify(
      {
        inputHint: task.inputHint,
        taskScore: task.score,
        answerKey: item.answerKey,
        commonErrors: item.commonErrors
      },
      null,
      2
    ),
    maxScore: task.score
  });

  const currentUser = await getCurrentUser();
  const student =
    currentUser?.role === "STUDENT"
      ? await prisma.studentProfile.findUnique({
          where: { userId: currentUser.id },
          select: {
            id: true,
            teacherId: true
          }
        })
      : null;

  if (student) {
    await prisma.practiceAiGrading.create({
      data: {
        studentId: student.id,
        teacherId: student.teacherId,
        articleId: article.id,
        sentenceId: sentence.sentenceId,
        practiceId: item.practiceId,
        taskId: task.taskId,
        prompt: task.prompt,
        studentAnswer,
        score: result.score,
        maxScore: result.maxScore,
        isAcceptable: result.isAcceptable,
        strengthsJson: toJsonValue(result.strengths),
        problemsJson: toJsonValue(result.problems),
        correctedAnswer: result.correctedAnswer,
        explanation: result.explanation
      }
    });
  }

  return Response.json({
    result
  });
}
