import { createChatCompletion } from "@/lib/sub2api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type AnalysisRequest = {
  studentId?: string;
};

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("AI 学习分析结果不是 JSON。");
  }

  return JSON.parse(source.slice(start, end + 1)) as {
    summary?: string;
    evidence?: unknown;
    ability?: unknown;
    suggestions?: unknown;
    nextActions?: unknown;
  };
}

function normalizeTextList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8);
}

async function resolveTargetStudent(currentUser: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, studentId?: string) {
  if (currentUser.role === "STUDENT") {
    return prisma.studentProfile.findUnique({
      where: { userId: currentUser.id },
      include: {
        teacher: {
          select: {
            id: true,
            realName: true
          }
        },
        class: {
          select: {
            name: true
          }
        }
      }
    });
  }

  if (currentUser.role === "TEACHER" && studentId) {
    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: currentUser.id },
      select: {
        id: true
      }
    });

    if (!teacher) return null;

    return prisma.studentProfile.findFirst({
      where: {
        id: studentId,
        teacherId: teacher.id
      },
      include: {
        teacher: {
          select: {
            id: true,
            realName: true
          }
        },
        class: {
          select: {
            name: true
          }
        }
      }
    });
  }

  return null;
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return Response.json({ error: "请先登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as AnalysisRequest;
  const student = await resolveTargetStudent(currentUser, body.studentId);

  if (!student) {
    return Response.json({ error: "没有找到可分析的学生，或你没有权限查看该学生。" }, { status: 404 });
  }

  const [conversations, scores, gradingAssignments, practiceGradings] = await Promise.all([
    prisma.aiConversation.findMany({
      where: {
        studentId: student.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 12
    }),
    prisma.examScore.findMany({
      where: {
        studentId: student.id
      },
      include: {
        exam: {
          select: {
            title: true
          }
        }
      },
      orderBy: {
        finalizedAt: "desc"
      },
      take: 8
    }),
    prisma.gradingAssignment.findMany({
      where: {
        submitterStudentId: student.id
      },
      include: {
        exam: {
          select: {
            title: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 8
    }),
    prisma.practiceAiGrading.findMany({
      where: {
        studentId: student.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    })
  ]);

  const rawText = await createChatCompletion(
    [
      {
        role: "system",
        content:
          "你是考研英语长难句学习诊断老师。你要根据学生真实问答、考试成绩和批改状态生成具体学习分析。不要只输出抽象标签，必须引用学生真实问题、句子或行为作为依据。只返回 JSON。"
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task:
              "请分析这个学生当前长难句学习状态。返回字段：summary, evidence, ability, suggestions, nextActions。evidence 每项要有 observation、basis、example；ability 要具体到主干、从句、修饰关系、词义、翻译、提问质量等维度；nextActions 要是学生今天就能执行的训练任务。",
            student: {
              realName: student.realName,
              studentNo: student.studentNo,
              teacher: student.teacher.realName,
              className: student.class?.name || "未分班",
              status: student.status
            },
            recentAiConversations: conversations.map((item) => ({
              articleId: item.articleId,
              sentenceId: item.sentenceId,
              sentenceText: item.sentenceText,
              question: item.question,
              answerExcerpt: item.answer.slice(0, 900),
              createdAt: item.createdAt
            })),
            recentScores: scores.map((score) => ({
              examTitle: score.exam.title,
              totalScore: score.totalScore,
              maxScore: score.maxScore,
              finalizedAt: score.finalizedAt
            })),
            recentSubmissionStatus: gradingAssignments.map((assignment) => ({
              examTitle: assignment.exam.title,
              status: assignment.status,
              assignedAt: assignment.assignedAt,
              gradedAt: assignment.gradedAt
            })),
            recentPracticeAiGradings: practiceGradings.map((grading) => ({
              articleId: grading.articleId,
              sentenceId: grading.sentenceId,
              prompt: grading.prompt,
              studentAnswer: grading.studentAnswer,
              score: grading.score,
              maxScore: grading.maxScore,
              isAcceptable: grading.isAcceptable,
              strengths: grading.strengthsJson,
              problems: grading.problemsJson,
              correctedAnswer: grading.correctedAnswer,
              explanation: grading.explanation,
              createdAt: grading.createdAt
            })),
            strictRules: [
              "不要只写主干识别弱、从句判断弱这类抽象标签",
              "每个结论都要有依据",
              "如果数据不足，要说明缺什么数据，并给学生设计下一步采样任务",
              "建议要面向考研英语长难句训练"
            ]
          },
          null,
          2
        )
      }
    ],
    {
      temperature: 0.15
    }
  );

  let parsed: ReturnType<typeof extractJsonObject>;

  try {
    parsed = extractJsonObject(rawText);
  } catch {
    parsed = {
      summary: rawText,
      evidence: [],
      ability: {},
      suggestions: [],
      nextActions: []
    };
  }

  const analysis = await prisma.studentAiAnalysis.create({
    data: {
      studentId: student.id,
      teacherId: student.teacherId,
      generatedByUserId: currentUser.id,
      triggerSource: currentUser.role === "TEACHER" ? "teacher" : "student",
      summary: String(parsed.summary || "AI 已生成学习分析，但摘要为空。").trim(),
      evidenceJson: parsed.evidence ?? [],
      abilityJson: parsed.ability ?? {},
      suggestionsJson: normalizeTextList(parsed.suggestions),
      nextActionsJson: normalizeTextList(parsed.nextActions),
      rawText
    }
  });

  return Response.json({
    analysis: {
      id: analysis.id,
      createdAt: analysis.createdAt,
      summary: analysis.summary,
      evidence: analysis.evidenceJson,
      ability: analysis.abilityJson,
      suggestions: analysis.suggestionsJson,
      nextActions: analysis.nextActionsJson,
      triggerSource: analysis.triggerSource
    }
  });
}
