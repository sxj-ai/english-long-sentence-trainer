import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/common/Badge";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface StudentExamResultPageProps {
  params: Promise<{
    examId: string;
  }>;
  searchParams?: Promise<{
    submitted?: string;
    error?: string;
  }>;
}

const resultErrorMessages: Record<string, string> = {
  "resubmit-disabled": "这场考试不允许重复提交，已显示你最近一次提交。"
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

export default async function StudentExamResultPage({ params, searchParams }: StudentExamResultPageProps) {
  const studentUser = await requireUser("STUDENT");
  const { examId } = await params;
  const resolvedSearchParams = await searchParams;
  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentUser.id }
  });

  if (!student || !student.classId || student.status !== "ACTIVE") {
    redirect("/student/exams?error=no-class");
  }

  const submission = await prisma.examSubmission.findFirst({
    where: {
      examId,
      studentId: student.id,
      status: "SUBMITTED",
      exam: {
        classId: student.classId,
        status: {
          in: ["PUBLISHED", "CLOSED"]
        }
      }
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
      },
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
              promptWord: true
            }
          }
        }
      }
    }
  });

  if (!submission) {
    redirect(`/student/exams/${examId}`);
  }

  const answerMap = new Map(submission.answers.map((answer) => [answer.examQuestionId, answer.answerText]));
  const canResubmit = !submission.exam.submitDeadline || submission.exam.submitDeadline >= new Date();

  return (
    <div className="page-stack">
      <section className="hero-band admin-hero">
        <div>
          <Badge tone="green">提交记录</Badge>
          <h1>{submission.exam.title}</h1>
          <p className="hero-copy">
            已记录第 {submission.attemptNo} 次提交。后续批改功能接上后，老师端会看到最后一次提交的答案。
          </p>
        </div>
      </section>

      {resolvedSearchParams?.submitted ? <div className="form-success page-notice">答案已提交。</div> : null}

      {resolvedSearchParams?.error ? (
        <div className="form-alert page-notice">
          {resultErrorMessages[resolvedSearchParams.error] ?? "提交记录加载失败，请稍后重试。"}
        </div>
      ) : null}

      <section className="section-block">
        <div className="exam-meta-grid">
          <div>
            <span>班级</span>
            <strong>{submission.exam.class.name}</strong>
          </div>
          <div>
            <span>提交时间</span>
            <strong>{formatDateTime(submission.submittedAt)}</strong>
          </div>
          <div>
            <span>提交次数</span>
            <strong>{submission.attemptNo}</strong>
          </div>
          <div>
            <span>题目数</span>
            <strong>{submission.exam.questions.length}</strong>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">答案</Badge>
          <h2>最近一次提交</h2>
          <p>这里仅显示你的原始答案，不显示标准释义。批改功能会在下一阶段接入。</p>
        </div>

        <div className="submitted-answer-list">
          {submission.exam.questions.map((question) => (
            <div className="submitted-answer-row" key={question.id}>
              <span>{question.orderIndex}</span>
              <strong>{question.promptWord}</strong>
              <p>{answerMap.get(question.id) || "未填写"}</p>
            </div>
          ))}
        </div>

        <div className="student-action-row">
          {canResubmit ? (
            <Link className="primary-link" href={`/student/exams/${submission.exam.id}`}>
              返回修改
            </Link>
          ) : null}
          <Link className="secondary-link" href="/student/exams">
            返回考试列表
          </Link>
        </div>
      </section>
    </div>
  );
}
