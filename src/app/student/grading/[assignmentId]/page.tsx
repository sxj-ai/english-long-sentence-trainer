import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/common/Badge";
import { submitGradingAction } from "@/features/student/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface StudentGradingPageProps {
  params: Promise<{
    assignmentId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    graded?: string;
  }>;
}

const gradingErrorMessages: Record<string, string> = {
  "missing-assignment": "没有找到要批改的任务。",
  "assignment-not-found": "批改任务不存在，或不属于你。",
  "grading-deadline-passed": "这份试卷已经超过批改截止时间。",
  "no-submission": "这位同学还没有可批改的提交。"
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

export default async function StudentGradingPage({ params, searchParams }: StudentGradingPageProps) {
  const studentUser = await requireUser("STUDENT");
  const { assignmentId } = await params;
  const resolvedSearchParams = await searchParams;
  const grader = await prisma.studentProfile.findUnique({
    where: { userId: studentUser.id }
  });

  if (!grader || !grader.classId || grader.status !== "ACTIVE") {
    redirect("/student/grading?error=no-class");
  }

  const assignment = await prisma.gradingAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      exam: {
        include: {
          class: {
            select: {
              name: true
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
          }
        }
      },
      submitter: {
        select: {
          realName: true,
          studentNo: true
        }
      },
      grader: {
        select: {
          realName: true,
          studentNo: true
        }
      },
      results: {
        orderBy: {
          submittedAt: "desc"
        },
        include: {
          items: {
            select: {
              examQuestionId: true,
              isCorrect: true,
              score: true
            }
          }
        },
        take: 1
      }
    }
  });

  if (
    !assignment ||
    assignment.graderStudentId !== grader.id ||
    assignment.exam.classId !== grader.classId ||
    assignment.exam.status !== "PUBLISHED"
  ) {
    redirect("/student/grading?error=assignment-not-found");
  }

  const submission = await prisma.examSubmission.findFirst({
    where: {
      examId: assignment.examId,
      studentId: assignment.submitterStudentId,
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
  });

  if (!submission) {
    redirect(`/student/grading/${assignment.id}?error=no-submission`);
  }

  const answerMap = new Map(submission.answers.map((answer) => [answer.examQuestionId, answer.answerText]));
  const latestResult = assignment.results[0];
  const resultItemMap = new Map(
    latestResult?.items.map((item) => [item.examQuestionId, { isCorrect: item.isCorrect, score: item.score }]) ?? []
  );
  const canEdit = assignment.status === "READY";

  return (
    <div className="page-stack">
      <section className="hero-band admin-hero">
        <div>
          <Badge tone="amber">批改试卷</Badge>
          <h1>{assignment.exam.title}</h1>
          <p className="hero-copy">
            给出逐题对错判断后直接提交。题目成绩会立即写入老师端总览。
          </p>
        </div>
      </section>

      {resolvedSearchParams?.graded ? <div className="form-success page-notice">批改结果已提交。</div> : null}

      {resolvedSearchParams?.error ? (
        <div className="form-alert page-notice">
          {gradingErrorMessages[resolvedSearchParams.error] ?? "批改页面加载失败，请稍后重试。"}
        </div>
      ) : null}

      <section className="section-block">
        <div className="exam-meta-grid">
          <div>
            <span>班级</span>
            <strong>{assignment.exam.class.name}</strong>
          </div>
          <div>
            <span>考生</span>
            <strong>
              {assignment.submitter.studentNo} {assignment.submitter.realName}
            </strong>
          </div>
          <div>
            <span>批改人</span>
            <strong>
              {assignment.grader.studentNo} {assignment.grader.realName}
            </strong>
          </div>
          <div>
            <span>提交时间</span>
            <strong>{formatDateTime(submission.submittedAt)}</strong>
          </div>
          <div>
            <span>批改状态</span>
            <strong>{assignment.status === "GRADED" ? "已批改" : "待批改"}</strong>
          </div>
          <div>
            <span>最近成绩</span>
            <strong>{latestResult ? `${latestResult.totalScore}/${latestResult.maxScore}` : "未批改"}</strong>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">答案对照</Badge>
          <h2>逐题批改</h2>
          <p>上方显示考生原始答案，右侧给出标准释义。每题判断后提交，系统自动汇总总分。</p>
        </div>

        {canEdit ? (
          <form action={submitGradingAction} className="grading-form">
            <input type="hidden" name="assignmentId" value={assignment.id} />

            <div className="grading-question-list">
              {assignment.exam.questions.map((question) => {
                const answerText = answerMap.get(question.id) || "未填写";
                const resultItem = resultItemMap.get(question.id);
                const trueChecked = resultItem ? resultItem.isCorrect : undefined;

                return (
                  <div className="grading-question-card" key={question.id}>
                    <div className="grading-question-head">
                      <strong>{question.orderIndex}. {question.promptWord}</strong>
                      <span>{question.score} 分</span>
                    </div>
                    <div className="grading-question-body">
                      <div>
                        <span>考生答案</span>
                        <p>{answerText}</p>
                      </div>
                      <div>
                        <span>标准释义</span>
                        <p>{question.standardMeaning}</p>
                      </div>
                      <div className="grading-choice-row">
                        <label>
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            value="true"
                            defaultChecked={trueChecked === true}
                            required
                          />
                          正确
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            value="false"
                            defaultChecked={trueChecked === false}
                            required
                          />
                          错误
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="student-action-row">
              <button className="primary-link form-submit" type="submit">
                提交批改
              </button>
              <Link className="secondary-link" href="/student/grading">
                返回列表
              </Link>
            </div>
          </form>
        ) : (
          <div className="grading-result-panel">
            <div className="grading-result-summary">
              <strong>{latestResult ? `${latestResult.totalScore}/${latestResult.maxScore}` : "未批改"}</strong>
              <span>这份试卷已经提交过批改结果。</span>
            </div>

            <div className="grading-question-list">
              {assignment.exam.questions.map((question) => {
                const answerText = answerMap.get(question.id) || "未填写";
                const resultItem = resultItemMap.get(question.id);

                return (
                  <div className="grading-question-card" key={question.id}>
                    <div className="grading-question-head">
                      <strong>
                        {question.orderIndex}. {question.promptWord}
                      </strong>
                      <span>{question.score} 分</span>
                    </div>
                    <div className="grading-question-body">
                      <div>
                        <span>考生答案</span>
                        <p>{answerText}</p>
                      </div>
                      <div>
                        <span>标准释义</span>
                        <p>{question.standardMeaning}</p>
                      </div>
                      <div>
                        <span>批改结果</span>
                        <p>{resultItem ? `${resultItem.isCorrect ? "正确" : "错误"} · ${resultItem.score} 分` : "未批改"}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="student-action-row">
              <Link className="secondary-link" href="/student/grading">
                返回列表
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
