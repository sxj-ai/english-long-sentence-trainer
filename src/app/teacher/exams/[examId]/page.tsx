import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/common/Badge";
import { closeExamAction, reopenExamAction } from "@/features/teacher/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface TeacherExamDetailPageProps {
  params: Promise<{
    examId: string;
  }>;
  searchParams?: Promise<{
    closedExam?: string;
    reopenedExam?: string;
    error?: string;
  }>;
}

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

const detailErrorMessages: Record<string, string> = {
  "missing-exam": "没有找到要操作的考试。",
  "not-published": "只有已发布考试才能关闭。",
  "not-closed": "只有已关闭考试才能重开。"
};

const examStatusLabels: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  CLOSED: "已关闭",
  FINISHED: "已完成"
};

export default async function TeacherExamDetailPage({ params, searchParams }: TeacherExamDetailPageProps) {
  const teacherUser = await requireUser("TEACHER");
  const { examId } = await params;
  const resolvedSearchParams = await searchParams;
  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: teacherUser.id }
  });

  if (!teacher) {
    redirect("/teacher?teacherError=teacher-profile-missing");
  }

  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      teacherId: teacher.id
    },
    include: {
      class: {
        include: {
          students: {
            orderBy: {
              studentNo: "asc"
            },
            select: {
              id: true,
              realName: true,
              studentNo: true,
              status: true
            }
          }
        }
      },
      questions: {
        orderBy: {
          orderIndex: "asc"
        },
        select: {
          id: true,
          orderIndex: true,
          promptWord: true,
          standardMeaning: true,
          score: true
        }
      },
      submissions: {
        where: {
          status: "SUBMITTED"
        },
        orderBy: {
          attemptNo: "desc"
        },
        include: {
          answers: {
            select: {
              examQuestionId: true,
              answerText: true
            }
          }
        }
      },
      assignments: {
        orderBy: {
          updatedAt: "desc"
        },
        include: {
          submitter: {
            select: {
              id: true,
              realName: true,
              studentNo: true
            }
          },
          grader: {
            select: {
              id: true,
              realName: true,
              studentNo: true
            }
          },
          results: {
            orderBy: {
              submittedAt: "desc"
            },
            take: 1,
            include: {
              items: {
                select: {
                  examQuestionId: true,
                  isCorrect: true,
                  score: true
                }
              }
            }
          }
        }
      },
      scores: {
        select: {
          studentId: true,
          totalScore: true,
          maxScore: true,
          finalizedAt: true
        }
      }
    }
  });

  if (!exam) {
    redirect("/teacher?examError=exam-not-found");
  }

  const latestSubmissionByStudentId = new Map<string, (typeof exam.submissions)[number]>();
  for (const submission of exam.submissions) {
    if (!latestSubmissionByStudentId.has(submission.studentId)) {
      latestSubmissionByStudentId.set(submission.studentId, submission);
    }
  }

  const currentAssignmentByStudentId = new Map<string, (typeof exam.assignments)[number]>();
  for (const assignment of exam.assignments) {
    if (assignment.status !== "REASSIGNED" && !currentAssignmentByStudentId.has(assignment.submitterStudentId)) {
      currentAssignmentByStudentId.set(assignment.submitterStudentId, assignment);
    }
  }

  const scoreByStudentId = new Map(exam.scores.map((score) => [score.studentId, score]));
  const submittedStudentCount = latestSubmissionByStudentId.size;
  const gradedStudentCount = scoreByStudentId.size;
  const waitingStudentCount = Math.max(submittedStudentCount - gradedStudentCount, 0);

  return (
    <div className="page-stack">
      <section className="hero-band admin-hero">
        <div>
          <Badge tone="green">考试详情</Badge>
          <h1>{exam.title}</h1>
          <p className="hero-copy">
            按学号查看全班提交和批改结果。这里会直接显示每个学生的原始答案与逐题判定。
          </p>
        </div>
      </section>

      {resolvedSearchParams?.closedExam ? (
        <div className="form-success page-notice">
          已关闭考试：<strong>{resolvedSearchParams.closedExam}</strong>
        </div>
      ) : null}

      {resolvedSearchParams?.reopenedExam ? (
        <div className="form-success page-notice">
          已重开考试：<strong>{resolvedSearchParams.reopenedExam}</strong>
        </div>
      ) : null}

      {resolvedSearchParams?.error ? (
        <div className="form-alert page-notice">
          {detailErrorMessages[resolvedSearchParams.error] ?? "考试状态更新失败，请重试。"}
        </div>
      ) : null}

      <section className="section-block">
        <div className="exam-meta-grid">
          <div>
            <span>状态</span>
            <strong>{examStatusLabels[exam.status] ?? exam.status}</strong>
          </div>
          <div>
            <span>已提交</span>
            <strong>{submittedStudentCount}</strong>
          </div>
          <div>
            <span>已批改</span>
            <strong>{gradedStudentCount}</strong>
          </div>
          <div>
            <span>待批改</span>
            <strong>{waitingStudentCount}</strong>
          </div>
          <div>
            <span>班级</span>
            <strong>{exam.class.name}</strong>
          </div>
          <div>
            <span>题目数</span>
            <strong>{exam.questions.length}</strong>
          </div>
          <div>
            <span>待批改</span>
            <strong>{waitingStudentCount}</strong>
          </div>
          <div>
            <span>开始</span>
            <strong>{formatDateTime(exam.startAt)}</strong>
          </div>
          <div>
            <span>答题截止</span>
            <strong>{formatDateTime(exam.submitDeadline)}</strong>
          </div>
          <div>
            <span>批改截止</span>
            <strong>{formatDateTime(exam.gradingDeadline)}</strong>
          </div>
        </div>

        <div className="student-action-row">
          <Link className="secondary-link" href="/teacher">
            返回老师端
          </Link>

          {exam.status === "PUBLISHED" ? (
            <form action={closeExamAction}>
              <input type="hidden" name="examId" value={exam.id} />
              <button className="primary-link" type="submit">
                关闭考试
              </button>
            </form>
          ) : null}

          {exam.status === "CLOSED" ? (
            <form action={reopenExamAction}>
              <input type="hidden" name="examId" value={exam.id} />
              <button className="primary-link" type="submit">
                重开考试
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">学生明细</Badge>
          <h2>按学号排列</h2>
          <p>每个学生都能展开查看：是否提交、谁在批改、原始答案、标准释义和分值。已批改总分会自动汇总。</p>
        </div>

        <div className="teacher-student-list">
          {exam.class.students.map((student) => {
            const submission = latestSubmissionByStudentId.get(student.id);
            const assignment = currentAssignmentByStudentId.get(student.id);
            const result = assignment?.results[0];
            const itemMap = new Map(
              result?.items.map((item) => [item.examQuestionId, item]) ?? []
            );
            const score = scoreByStudentId.get(student.id);
            const isSubmitted = Boolean(submission);
            const isGraded = Boolean(score);

            return (
              <details className="teacher-student-card" key={student.id} open={isSubmitted || isGraded}>
                <summary className="teacher-student-summary">
                  <div>
                    <strong>
                      {student.studentNo} {student.realName}
                    </strong>
                    <span>{student.status}</span>
                  </div>
                  <div>
                    <span className={`status-pill ${isGraded ? "status-pill-success" : "status-pill-warning"}`}>
                      {isGraded ? "已批改" : isSubmitted ? "待批改" : "未提交"}
                    </span>
                    <small>{submission ? `最近提交 ${formatDateTime(submission.submittedAt)}` : "暂无提交"}</small>
                  </div>
                  <div>
                    <span>{assignment ? `${assignment.grader.studentNo} ${assignment.grader.realName}` : "未分配"}</span>
                    <small>{score ? `${score.totalScore}/${score.maxScore}` : "暂无成绩"}</small>
                  </div>
                </summary>

                <div className="teacher-student-detail-body">
                  {!submission ? (
                    <div className="empty-state">该学生还没有提交这场考试。</div>
                  ) : (
                    <>
                      <div className="grading-result-summary">
                        <strong>{score ? `${score.totalScore}/${score.maxScore}` : "未批改"}</strong>
                        <span>
                          {assignment ? `批改人：${assignment.grader.studentNo} ${assignment.grader.realName}` : "批改任务尚未分配"}
                        </span>
                      </div>

                      <div className="teacher-answer-list">
                        {exam.questions.map((question) => {
                          const answerText = submission.answers.find((answer) => answer.examQuestionId === question.id)?.answerText || "未填写";
                          const gradingItem = itemMap.get(question.id);

                          return (
                            <div className="teacher-answer-row" key={question.id}>
                              <div>
                                <strong>
                                  {question.orderIndex}. {question.promptWord}
                                </strong>
                                <small>{question.score} 分</small>
                              </div>
                              <div>
                                <span>考生答案</span>
                                <p>{answerText}</p>
                              </div>
                              <div>
                                <span>标准释义</span>
                                <p>{question.standardMeaning}</p>
                              </div>
                              <div>
                                <span>批改</span>
                                <p>
                                  {gradingItem
                                    ? `${gradingItem.isCorrect ? "正确" : "错误"} · ${gradingItem.score} 分`
                                    : "未批改"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="teacher-detail-foot">
                        <span>提交时间：{formatDateTime(submission.submittedAt)}</span>
                        <span>{assignment ? `批改状态：${assignment.status}` : "批改任务未分配"}</span>
                      </div>
                    </>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
