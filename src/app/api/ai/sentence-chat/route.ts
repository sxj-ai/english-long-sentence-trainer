import type { Prisma } from "@prisma/client";
import { streamChatCompletion, type ChatMessage } from "@/lib/sub2api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type SentenceChatRequest = {
  sentence?: string;
  question?: string;
  mode?: string;
  history?: Array<{
    role?: "user" | "assistant";
    content?: string;
  }>;
  context?: {
    articleId?: string;
    sentenceId?: string;
    translationLiteral?: string;
    chunks?: unknown;
    keyWords?: unknown;
    keyPhrases?: unknown;
  };
};

function buildMessages(body: SentenceChatRequest): ChatMessage[] {
  const sentence = String(body.sentence || "").trim();
  const question = String(body.question || "").trim();
  const mode = String(body.mode || "考研解析").trim();
  const history = Array.isArray(body.history)
    ? body.history
        .filter((message) => (message.role === "user" || message.role === "assistant") && String(message.content || "").trim())
        .slice(-8)
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: String(message.content || "").trim().slice(0, 4000)
        }))
    : [];

  if (!sentence && !question) {
    throw new Error("请提供英文长难句或问题。");
  }

  return [
    {
      role: "system",
      content:
        "你是考研英语长难句老师。你的任务是帮助学生真正学会拆句、判断主干、理解从句和修饰关系，并把英语结构转成自然中文。回答要具体、分层、可操作，不要只给结论。"
    },
    ...history,
    {
      role: "user",
      content: JSON.stringify(
        {
          mode,
          sentence,
          question,
          context: body.context || null,
          outputRequirements: [
            "先说明句子主干",
            "再拆解从句、插入语、非谓语、修饰关系",
            "给出结构直译和自然译文",
            "指出考研阅读中容易误解的地方",
            "最后给学生一个可以马上练习的小任务"
          ]
        },
        null,
        2
      )
    }
  ];
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "STUDENT") {
    return Response.json({ conversations: [] });
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true }
  });

  if (!student) {
    return Response.json({ conversations: [] });
  }

  const url = new URL(request.url);
  const articleId = url.searchParams.get("articleId")?.trim();
  const sentenceId = url.searchParams.get("sentenceId")?.trim();

  const conversations = (
    await prisma.aiConversation.findMany({
    where: {
      studentId: student.id,
      ...(articleId ? { articleId } : {}),
      ...(sentenceId ? { sentenceId } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      question: true,
      answer: true,
      articleId: true,
      sentenceId: true,
      createdAt: true
    }
    })
  ).reverse();

  return Response.json({
    conversations: conversations.map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
      articleId: item.articleId,
      sentenceId: item.sentenceId,
      createdAt: item.createdAt.toISOString()
    }))
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SentenceChatRequest;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return Response.json({ error: "请先登录学生账号，再向 AI 老师提问。" }, { status: 401 });
    }

    if (currentUser.role !== "STUDENT") {
      return Response.json({ error: "只有学生账号可以向 AI 老师提问。" }, { status: 403 });
    }

    const student =
      await prisma.studentProfile.findUnique({
        where: { userId: currentUser.id },
        select: {
          id: true,
          teacherId: true,
          classId: true
        }
      });

    if (!student) {
      return Response.json({ error: "当前学生资料不存在，请重新登录或联系老师。" }, { status: 403 });
    }

    const messages = buildMessages(body);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let answer = "";

        try {
          for await (const delta of streamChatCompletion(messages, { temperature: 0.2 })) {
            answer += delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }

          if (answer.trim()) {
            await prisma.aiConversation.create({
              data: {
                studentId: student.id,
                teacherId: student.teacherId,
                classId: student.classId,
                articleId: body.context?.articleId || null,
                sentenceId: body.context?.sentenceId || null,
                sentenceText: String(body.sentence || "").trim(),
                mode: body.mode || "考研解析",
                question: String(body.question || "").trim() || "请按考研长难句学习方法讲解这个句子。",
                answer,
                contextJson: toJsonValue(body.context)
              }
            });
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                message: error instanceof Error ? error.message : "AI 流式回答失败。"
              })}\n\n`
            )
          );
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8"
      }
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "请求格式不正确。"
      },
      {
        status: 400
      }
    );
  }
}
