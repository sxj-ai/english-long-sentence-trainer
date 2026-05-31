import Link from "next/link";
import { Badge } from "@/components/common/Badge";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface StudentExamListPageProps {
  searchParams?: Promise<{
    error?: string;
  }>;
}

const examListErrorMessages: Record<string, string> = {
  "missing-exam": "没有找到要提交的考试。",
  "no-class": "老师还没有为你分班，暂时不能参加班级考试。",
  "exam-not-found": "考试不存在，或不属于你的班级。"
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

function getExamState(exam: {
  status: string;
  startAt: Date | null;
  submitDeadline: Date | null;
  submissions: { submittedAt: Date | null }[];
}) {
  const now = new Date();

  if (exam.status === "CLOSED") {
    return { label: "已关闭", tone: "muted" };
  }

  if (exam.startAt && exam.startAt > now) {
    return { label: "未开始", tone: "warning" };
  }

  if (exam.submitDeadline && exam.submitDeadline < now) {
    return exam.submissions.length > 0
      ? { label: "已提交", tone: "success" }
      : { label: "已截止", tone: "muted" };
  }

  if (exam.submissions.length > 0) {
    return { label: "可重交", tone: "success" };
  }

  return { label: "待提交", tone: "draft" };
}

export default async function StudentExamListPage({ searchParams }: StudentExamListPageProps) {
  const studentUser = await requireUser("STUDENT");
  const resolvedSearchParams = await searchParams;
  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentUser.id },
    include: {
      class: {
        select: {
          name: true
        }
      },
      teacher: {
        select: {
          realName: true
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
          <p>当前账号没有对应的学生资料。请联系老师或管理员处理。</p>
        </div>
      </div>
    );
  }

  const exams = student.classId
    ? await prisma.exam.findMany({
        where: {
          classId: student.classId,
          status: {
            in: ["PUBLISHED", "CLOSED"]
          }
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
              attemptNo: true,
              submittedAt: true
            },
            orderBy: {
              attemptNo: "desc"
            },
            take: 1
          },
          _count: {
            select: {
              questions: true
            }
          }
        }
      })
    : [];

  return (
    <div className="page-stack">
      <section className="hero-band admin-hero">
        <div>
          <Badge tone="amber">考试</Badge>
          <h1>我的默写考试</h1>
          <p className="hero-copy">
            {student.class
              ? `${student.teacher.realName} 老师 · ${student.class.name}`
              : `${student.teacher.realName} 老师还没有为你分班。`}
          </p>
        </div>
      </section>

      {resolvedSearchParams?.error ? (
        <div className="form-alert page-notice">
          {examListErrorMessages[resolvedSearchParams.error] ?? "考试列表加载失败，请稍后重试。"}
        </div>
      ) : null}

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">列表</Badge>
          <h2>已发布考试</h2>
          <p>老师发布后才会出现在这里。重复提交时，以最后一次提交作为当前答案。</p>
        </div>

        {!student.classId ? (
          <div className="empty-state">你还没有被分入班级，暂时没有考试。</div>
        ) : exams.length === 0 ? (
          <div className="empty-state">当前班级还没有已发布考试。</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>考试</th>
                  <th>题目数</th>
                  <th>状态</th>
                  <th>开始</th>
                  <th>答题截止</th>
                  <th>最近提交</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => {
                  const state = getExamState(exam);
                  const latestSubmission = exam.submissions[0];
                  const actionLabel =
                    exam.status === "CLOSED"
                      ? latestSubmission
                        ? "查看结果"
                        : "已关闭"
                      : latestSubmission
                        ? "查看/重交"
                        : "进入答题";

                  return (
                    <tr key={exam.id}>
                      <td>{exam.title}</td>
                      <td>{exam._count.questions}</td>
                      <td>
                        <span className={`status-pill status-pill-${state.tone}`}>{state.label}</span>
                      </td>
                      <td>{formatDateTime(exam.startAt)}</td>
                      <td>{formatDateTime(exam.submitDeadline)}</td>
                      <td>{latestSubmission?.submittedAt ? formatDateTime(latestSubmission.submittedAt) : "未提交"}</td>
                      <td>
                        {exam.status === "CLOSED" && !latestSubmission ? (
                          <span className="muted-text">已关闭</span>
                        ) : (
                          <Link className="primary-link inline-action" href={`/student/exams/${exam.id}`}>
                            {actionLabel}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
