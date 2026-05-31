import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type ReviewRequest = {
  bookmarkId?: string;
};

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== "STUDENT") {
    return Response.json({ error: "请先使用学生账号登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as ReviewRequest;
  const bookmarkId = String(body.bookmarkId || "").trim();

  if (!bookmarkId) {
    return Response.json({ error: "缺少收藏记录。" }, { status: 400 });
  }

  const student = await prisma.studentProfile.findUnique({
    where: {
      userId: currentUser.id
    },
    select: {
      id: true
    }
  });

  if (!student) {
    return Response.json({ error: "学生资料不存在。" }, { status: 404 });
  }

  const bookmark = await prisma.sentenceBookmark.update({
    where: {
      id: bookmarkId,
      studentId: student.id
    },
    data: {
      lastReviewedAt: new Date(),
      reviewCount: {
        increment: 1
      }
    }
  });

  return Response.json({ bookmark });
}
