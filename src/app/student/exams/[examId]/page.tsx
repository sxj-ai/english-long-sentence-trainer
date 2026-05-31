import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/common/Badge";
import { submitExamAction } from "@/features/student/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface StudentExamPageProps {
  params: Promise<{
    examId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
}

const submitErrorMessages: Record<string, string> = {
  "not-started": "考试还没有开始，暂时不能提交。",
  "deadline-passed": "答题截止时间已过，不能再提交。",
  "resubmit-disabled": "这场考试不允许重复提交。",
  closed: "这场考试已经关闭，不能继续答题。"
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

function getAvailability(exam: { status: string; startAt: Date | null; submitDeadline: Date | null }) {
  const now = new Date();

  if (exam.status === "CLOSED") {
    return { canSubmit: false, message: "这场考试已经关闭，不能继续答题。" };
  }

  if (exam.startAt && exam.startAt > now) {
    return { canSubmit: false, message: `考试将在 ${formatDateTime(exam.startAt)} 开始。` };
  }

  if (exam.submitDeadline && exam.submitDeadline < now) {
    return { canSubmit: false, message: "答题截止时间已过。" };
  }

  return { canSubmit: true, message: "可以提交答案。" };
}

export default async function StudentExamPage({ params, searchParams }: StudentExamPageProps) {
  const studentUser = await requireUser("STUDENT");
  const { examId } = await params;
  const resolvedSearchParams = await searchParams;
  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentUser.id }
  });

  if (!student || !student.classId || student.status !== "ACTIVE") {
    redirect("/student/exams?error=no-class");
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
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
          score: true
        }
      },
      submissions: {
        where: {
          studentId: student.id,
          status: "SUBMITTED"
        },
        orderBy: {
          attemptNo: "desc"
        },
        take: 1,
        include: {
          answers: {
            select: {
              examQuestionId: true,
              answerText: true
            }
          }
        }
      }
    }
  });

  if (!exam || exam.classId !== student.classId || !["PUBLISHED", "CLOSED"].includes(exam.status)) {
    redirect("/student/exams?error=exam-not-found");
  }

  const availability = getAvailability(exam);
  const latestSubmission = exam.submissions[0];
  const latestAnswerMap = new Map(
    latestSubmission?.answers.map((answer) => [answer.examQuestionId, answer.answerText]) ?? []
  );

  return (
    <div className="page-stack">
      <section className="hero-band admin-hero">
        <div>
          <Badge tone="amber">默写考试</Badge>
          <h1>{exam.title}</h1>
          <p className="hero-copy">
            给定英文单词，填写中文释义。可以重复提交，系统会以后一次提交作为当前答案。
          </p>
        </div>
      </section>

      {resolvedSearchParams?.error ? (
        <div className="form-alert page-notice">
          {submitErrorMessages[resolvedSearchParams.error] ?? "提交失败，请稍后重试。"}
        </div>
      ) : null}

      <section className="section-block">
        <div className="exam-meta-grid">
          <div>
            <span>班级</span>
            <strong>{exam.class.name}</strong>
          </div>
          <div>
            <span>题目数</span>
            <strong>{exam.questions.length}</strong>
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
            <span>限时</span>
            <strong>{exam.timeLimitMinutes ? `${exam.timeLimitMinutes} 分钟` : "未设置"}</strong>
          </div>
          <div>
            <span>最近提交</span>
            <strong>{latestSubmission?.submittedAt ? formatDateTime(latestSubmission.submittedAt) : "未提交"}</strong>
          </div>
        </div>
      </section>

      {!availability.canSubmit ? (
        <section className="section-block">
          <div className="section-heading">
            <Badge tone="red">不可提交</Badge>
            <h2>{availability.message}</h2>
            <p>如果你已经提交过，可以查看最近一次提交记录。</p>
          </div>

          <div className="student-action-row">
            {latestSubmission ? (
              <Link className="primary-link" href={`/student/exams/${exam.id}/result`}>
                查看提交记录
              </Link>
            ) : null}
            <Link className="secondary-link" href="/student/exams">
              返回考试列表
            </Link>
          </div>
        </section>
      ) : (
        <section className="section-block">
          <div className="section-heading">
            <Badge tone="green">答题</Badge>
            <h2>{latestSubmission ? "修改并重新提交" : "填写中文释义"}</h2>
            <p>{latestSubmission ? "下面已带入你最近一次提交的答案，修改后再次提交即可。" : availability.message}</p>
          </div>

          <form action={submitExamAction} className="exam-answer-form">
            <input type="hidden" name="examId" value={exam.id} />

            <div className="exam-question-list">
              {exam.questions.map((question) => (
                <label className="exam-question-row" key={question.id}>
                  <span>{question.orderIndex}</span>
                  <strong>{question.promptWord}</strong>
                  <textarea
                    name={`answer-${question.id}`}
                    defaultValue={latestAnswerMap.get(question.id) ?? ""}
                    rows={2}
                    placeholder="填写中文释义"
                  />
                </label>
              ))}
            </div>

            <div className="student-action-row">
              <button className="primary-link form-submit" type="submit">
                提交答案
              </button>
              <Link className="secondary-link" href="/student/exams">
                返回列表
              </Link>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
