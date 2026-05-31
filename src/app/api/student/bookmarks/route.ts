import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type BookmarkRequest = {
  articleId?: string;
  articleTitle?: string;
  sentenceId?: string;
  sentenceText?: string;
  translationLiteral?: string;
  difficulty?: number;
  note?: string;
};

async function getCurrentStudent() {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== "STUDENT") return null;

  return prisma.studentProfile.findUnique({
    where: {
      userId: currentUser.id
    },
    select: {
      id: true,
      teacherId: true,
      classId: true
    }
  });
}

export async function GET(request: Request) {
  const student = await getCurrentStudent();

  if (!student) {
    return Response.json({ error: "请先使用学生账号登录。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const articleId = searchParams.get("articleId");
  const sentenceId = searchParams.get("sentenceId");

  if (articleId && sentenceId) {
    const bookmark = await prisma.sentenceBookmark.findUnique({
      where: {
        studentId_articleId_sentenceId: {
          studentId: student.id,
          articleId,
          sentenceId
        }
      }
    });

    return Response.json({
      bookmarked: Boolean(bookmark),
      bookmark
    });
  }

  const bookmarks = await prisma.sentenceBookmark.findMany({
    where: {
      studentId: student.id
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20
  });

  return Response.json({ bookmarks });
}

export async function POST(request: Request) {
  const student = await getCurrentStudent();

  if (!student) {
    return Response.json({ error: "请先使用学生账号登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as BookmarkRequest;
  const articleId = String(body.articleId || "").trim();
  const articleTitle = String(body.articleTitle || "").trim();
  const sentenceId = String(body.sentenceId || "").trim();
  const sentenceText = String(body.sentenceText || "").trim();

  if (!articleId || !articleTitle || !sentenceId || !sentenceText) {
    return Response.json({ error: "缺少文章或句子信息。" }, { status: 400 });
  }

  const bookmark = await prisma.sentenceBookmark.upsert({
    where: {
      studentId_articleId_sentenceId: {
        studentId: student.id,
        articleId,
        sentenceId
      }
    },
    create: {
      studentId: student.id,
      teacherId: student.teacherId,
      classId: student.classId,
      articleId,
      articleTitle,
      sentenceId,
      sentenceText,
      translationLiteral: body.translationLiteral || null,
      difficulty: typeof body.difficulty === "number" ? body.difficulty : null,
      note: body.note || null
    },
    update: {
      note: body.note || undefined,
      updatedAt: new Date()
    }
  });

  return Response.json({
    bookmarked: true,
    bookmark
  });
}

export async function DELETE(request: Request) {
  const student = await getCurrentStudent();

  if (!student) {
    return Response.json({ error: "请先使用学生账号登录。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const articleId = searchParams.get("articleId");
  const sentenceId = searchParams.get("sentenceId");

  if (!articleId || !sentenceId) {
    return Response.json({ error: "缺少文章或句子信息。" }, { status: 400 });
  }

  await prisma.sentenceBookmark.deleteMany({
    where: {
      studentId: student.id,
      articleId,
      sentenceId
    }
  });

  return Response.json({
    bookmarked: false
  });
}
