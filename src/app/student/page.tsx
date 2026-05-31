import Link from "next/link";
import { Badge } from "@/components/common/Badge";
import { StudentAiAnalysisPanel } from "@/components/student/StudentAiAnalysisPanel";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface StudentPageProps {
  searchParams?: Promise<{
    registered?: string;
    error?: string;
  }>;
}

const studentErrorMessages: Record<string, string> = {
  "student-profile-missing": "当前账号是学生角色，但没有找到对应的学生资料。请联系老师或管理员处理。"
};

function formatDateTime(value: Date | null) {
  if (!value) {
    return "未设置";
  }

  return value.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default async function StudentPage({ searchParams }: StudentPageProps) {
  const studentUser = await requireUser("STUDENT");
  const resolvedSearchParams = await searchParams;
  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentUser.id },
    include: {
      teacher: {
        select: {
          realName: true
        }
      },
      class: {
        select: {
          name: true,
          description: true
        }
      }
    }
  });

  if (!student) {
    return (
      <div className="section-block narrow">
        <div className="section-heading">
          <Badge tone="red">账号异常</Badge>
          <h1>学生资料缺失</h1>
          <p>当前账号是学生角色，但没有对应的学生资料。请联系老师或管理员重新处理账号。</p>
        </div>
      </div>
    );
  }

  const publishedExams = student.classId
    ? await prisma.exam.findMany({
        where: {
          classId: student.classId,
          status: "PUBLISHED"
        },
        orderBy: {
          createdAt: "desc"
        },
        include: {
          submissions: {
            where: {
              studentId: student.id,
              status: "SUBMITTED"
            },
            select: {
              submittedAt: true
            },
            orderBy: {
              submittedAt: "desc"
            },
            take: 1
          },
          _count: {
            select: {
              questions: true
            }
          }
        },
        take: 5
      })
    : [];
  const submittedExamCount = publishedExams.filter((exam) => exam.submissions.length > 0).length;
  const pendingExamCount = Math.max(publishedExams.length - submittedExamCount, 0);
  const pendingGradingCount = student.classId
    ? await prisma.gradingAssignment.count({
        where: {
          graderStudentId: student.id,
          status: "READY"
        }
      })
    : 0;
  const [recentAiConversations, latestAiAnalysis] = await Promise.all([
    prisma.aiConversation.findMany({
      where: {
        studentId: student.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20
    }),
    prisma.studentAiAnalysis.findFirst({
      where: {
        studentId: student.id
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  ]);
  const recentPracticeGradings = await prisma.practiceAiGrading.findMany({
    where: {
      studentId: student.id
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 5
  });
  const bookmarkedSentences = await prisma.sentenceBookmark.findMany({
    where: {
      studentId: student.id
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 8
  });
  const needsReviewGradings = recentPracticeGradings.filter((grading) => !grading.isAcceptable).slice(0, 4);
  const unreviewedBookmarks = bookmarkedSentences
    .filter((bookmark) => !bookmark.lastReviewedAt || bookmark.reviewCount === 0)
    .slice(0, 4);
  const todayTasks = [
    unreviewedBookmarks[0]
      ? `复习收藏句子：${unreviewedBookmarks[0].sentenceId}，先口头说出主干，再看结构直译。`
      : bookmarkedSentences[0]
        ? `回看收藏句子：${bookmarkedSentences[0].sentenceId}，尝试重新翻译一遍。`
        : "从文章列表选择一篇真题，收藏 1 个你觉得难的长难句。",
    needsReviewGradings[0]
      ? `重做未达标主观题：${needsReviewGradings[0].sentenceId}，重点修改 AI 指出的第一个问题。`
      : "完成 1 道精分析主观题，并使用 AI 批改查看反馈。",
    recentAiConversations[0]
      ? `追问最近句子：${recentAiConversations[0].sentenceId || "上次提问句"}，让 AI 检查你的拆句过程。`
      : "在文章详情页向 AI 老师提 1 个具体问题，例如“这个从句修饰谁”。"
  ];

  return (
    <div className="page-stack">
      <section className="hero-band admin-hero">
        <div>
          <Badge tone="green">学生端</Badge>
          <h1>{student.realName}的学习工作台</h1>
          <p className="hero-copy">
            这里会显示老师发布的默写考试。长难句文章学习功能仍然可以从顶部“文章”入口进入。
          </p>
        </div>

        <div className="hero-stats">
          <div>
            <strong>{pendingExamCount}</strong>
            <span>待完成</span>
          </div>
          <div>
            <strong>{pendingGradingCount}</strong>
            <span>待批改</span>
          </div>
        </div>
      </section>

      {resolvedSearchParams?.registered ? (
        <div className="form-success page-notice">注册成功。老师分班后，你会在这里看到对应班级的考试。</div>
      ) : null}

      {resolvedSearchParams?.error ? (
        <div className="form-alert page-notice">
          {studentErrorMessages[resolvedSearchParams.error] ?? "学生端加载失败，请稍后重试。"}
        </div>
      ) : null}

      <section className="student-dashboard-grid">
        <div className="section-block">
          <div className="section-heading">
            <Badge tone="blue">我的信息</Badge>
            <h2>老师与班级</h2>
          </div>

          <dl className="profile-dl">
            <dt>学号</dt>
            <dd>{student.studentNo}</dd>
            <dt>老师</dt>
            <dd>{student.teacher.realName}</dd>
            <dt>班级</dt>
            <dd>{student.class?.name ?? "等待老师分班"}</dd>
            <dt>状态</dt>
            <dd>{student.status === "ACTIVE" ? "已分班" : "待分班"}</dd>
          </dl>

          {student.class?.description ? <p className="muted-text">{student.class.description}</p> : null}
        </div>

        <div className="section-block">
          <div className="section-heading">
            <Badge tone="amber">考试入口</Badge>
            <h2>最近考试</h2>
            <p>只显示老师已经发布的考试。可以重复提交，系统会以后一次提交作为当前答案。</p>
          </div>

          {!student.classId ? (
            <div className="empty-state">你已经绑定老师，但还没有进入班级。等待老师分班后会出现考试入口。</div>
          ) : publishedExams.length === 0 ? (
            <div className="empty-state">当前班级还没有已发布考试。</div>
          ) : (
            <div className="compact-exam-list">
              {publishedExams.map((exam) => (
                <div className="compact-exam-item" key={exam.id}>
                  <div>
                    <h3>{exam.title}</h3>
                    <p>
                      {exam._count.questions} 题 · 截止 {formatDateTime(exam.submitDeadline)}
                    </p>
                  </div>
                  <Link className="primary-link" href={`/student/exams/${exam.id}`}>
                    {exam.submissions.length > 0 ? "继续查看" : "去答题"}
                  </Link>
                </div>
              ))}
            </div>
          )}

          <div className="student-action-row">
            <Link className="primary-link" href="/student/exams">
              查看全部考试
            </Link>
            <Link className="secondary-link" href="/student/grading">
              待我批改
            </Link>
            <Link className="secondary-link" href="/">
              继续学习文章
            </Link>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="green">今日建议</Badge>
          <h2>今天先完成这 3 件事</h2>
          <p>根据你的收藏、AI 问答和 AI 批改记录自动生成。先不追求多，重点是每天有明确动作。</p>
        </div>
        <div className="today-task-grid">
          {todayTasks.map((task, index) => (
            <div className="today-task-card" key={task}>
              <span>{index + 1}</span>
              <p>{task}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="student-dashboard-grid">
        <div className="section-block">
          <div className="section-heading">
            <Badge tone="blue">收藏句子</Badge>
            <h2>待复习收藏</h2>
            <p>收藏的句子会进入这里，适合做每日回看和二次翻译。</p>
          </div>

          {bookmarkedSentences.length > 0 ? (
            <div className="compact-exam-list">
              {bookmarkedSentences.map((bookmark) => (
                <div className="compact-exam-item" key={bookmark.id}>
                  <div>
                    <h3>
                      {bookmark.articleTitle} · {bookmark.sentenceId}
                    </h3>
                    <p>{bookmark.sentenceText}</p>
                    <p>
                      已复习 {bookmark.reviewCount} 次 · 最近复习 {formatDateTime(bookmark.lastReviewedAt)}
                    </p>
                  </div>
                  <Link className="primary-link" href={`/articles/${bookmark.articleId}`}>
                    去复习
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">还没有收藏句子。进入文章详情页，点击右侧“收藏句子”。</div>
          )}
        </div>

        <div className="section-block">
          <div className="section-heading">
            <Badge tone="amber">待复习</Badge>
            <h2>需要回炉的内容</h2>
            <p>AI 批改不达标的主观题会先进入这里，后续再接错题本和复习计划。</p>
          </div>

          {needsReviewGradings.length > 0 ? (
            <div className="compact-exam-list">
              {needsReviewGradings.map((grading) => (
                <div className="compact-exam-item" key={grading.id}>
                  <div>
                    <h3>{grading.sentenceId}</h3>
                    <p>
                      AI 评分 {grading.score}/{grading.maxScore} · {grading.explanation.slice(0, 120)}
                      {grading.explanation.length > 120 ? "..." : ""}
                    </p>
                  </div>
                  <Link className="secondary-link" href={`/practice/${grading.articleId}`}>
                    重练
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">暂时没有 AI 判定需要重练的主观题。</div>
          )}
        </div>
      </section>

      <section className="section-block">
        <StudentAiAnalysisPanel
          initialAnalysis={
            latestAiAnalysis
              ? {
                  id: latestAiAnalysis.id,
                  createdAt: latestAiAnalysis.createdAt.toISOString(),
                  summary: latestAiAnalysis.summary,
                  evidence: latestAiAnalysis.evidenceJson,
                  ability: latestAiAnalysis.abilityJson,
                  suggestions: latestAiAnalysis.suggestionsJson,
                  nextActions: latestAiAnalysis.nextActionsJson,
                  triggerSource: latestAiAnalysis.triggerSource
                }
              : null
          }
          title="我的 AI 学习分析"
          description="你可以自己调用 AI，根据最近问过的句子、考试和批改记录分析当前学习状态。"
        />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">AI 问答记录</Badge>
          <h2>最近 20 条 AI 问答历史</h2>
          <p>这里保存你最近在文章详情页问 AI 老师的问题。点击记录可以展开完整回答，也可以回到原句继续追问。</p>
        </div>

        {recentAiConversations.length > 0 ? (
          <div className="teacher-ai-record-list">
            {recentAiConversations.map((item) => (
              <details className="teacher-ai-record" key={item.id}>
                <summary className="teacher-ai-record-summary student-ai-record-summary">
                  <div>
                    <strong>{item.sentenceId || item.articleId || "自选句子"}</strong>
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p>{item.question}</p>
                  <small>{item.answer.length > 180 ? `${item.answer.slice(0, 180)}...` : item.answer}</small>
                </summary>

                <div className="teacher-ai-record-body">
                  <div>
                    <span>原句</span>
                    <p>{item.sentenceText || "未记录原句"}</p>
                  </div>

                  <div>
                    <span>我的问题</span>
                    <p>{item.question}</p>
                  </div>

                  <div>
                    <span>AI 完整回答</span>
                    <p className="record-answer">{item.answer}</p>
                  </div>

                  {item.articleId ? (
                    <div className="student-record-actions">
                      <Link
                        className="primary-link"
                        href={`/articles/${item.articleId}?ai=1${item.sentenceId ? `&sentenceId=${encodeURIComponent(item.sentenceId)}` : ""}`}
                      >
                        回到原句继续问
                      </Link>
                    </div>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="empty-state">还没有 AI 问答记录。进入文章详情页，选一句话后点击“问 AI 老师”。</div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="amber">AI 批改记录</Badge>
          <h2>最近精分析批改</h2>
          <p>这里保存你在精分析主观题中调用 AI 批改的结果，后续会进入错因本和复习计划。</p>
        </div>

        {recentPracticeGradings.length > 0 ? (
          <div className="teacher-answer-list">
            {recentPracticeGradings.map((item) => (
              <div className="teacher-answer-row" key={item.id}>
                <div>
                  <strong>{item.sentenceId}</strong>
                  <small>{formatDateTime(item.createdAt)}</small>
                </div>
                <div>
                  <span>题目</span>
                  <p>{item.prompt}</p>
                </div>
                <div>
                  <span>AI 评分</span>
                  <p>
                    {item.score}/{item.maxScore} · {item.isAcceptable ? "基本达标" : "需要重练"}
                  </p>
                </div>
                <div>
                  <span>解释</span>
                  <p>{item.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">还没有 AI 批改记录。进入精分析检测页，完成主观题后点击“AI 批改”。</div>
        )}
      </section>
    </div>
  );
}
