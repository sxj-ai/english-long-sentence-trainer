import Link from "next/link";
import { Badge } from "@/components/common/Badge";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface StudentGradingListPageProps {
  searchParams?: Promise<{
    error?: string;
  }>;
}

const gradingListErrorMessages: Record<string, string> = {
  "missing-assignment": "没有找到要批改的任务。",
  "assignment-not-found": "批改任务不存在，或不属于你。",
  "no-class": "老师还没有为你分班，暂时不能批改试卷。"
};

const gradingStatusLabels: Record<string, string> = {
  READY: "待批改",
  GRADED: "已批改"
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

export default async function StudentGradingListPage({ searchParams }: StudentGradingListPageProps) {
  const studentUser = await requireUser("STUDENT");
  const resolvedSearchParams = await searchParams;
  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentUser.id },
    include: {
      class: {
        select: {
          name: true
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

  const assignments = student.classId
    ? await prisma.gradingAssignment.findMany({
        where: {
          graderStudentId: student.id,
          status: {
            in: ["READY", "GRADED"]
          }
        },
        orderBy: {
          assignedAt: "desc"
        },
        include: {
          exam: {
            select: {
              title: true,
              gradingDeadline: true,
              _count: {
                select: {
                  questions: true
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
          results: {
            orderBy: {
              submittedAt: "desc"
            },
            select: {
              totalScore: true,
              maxScore: true,
              submittedAt: true
            },
            take: 1
          }
        }
      })
    : [];
  const readyCount = assignments.filter((assignment) => assignment.status === "READY").length;
  const gradedCount = assignments.filter((assignment) => assignment.status === "GRADED").length;

  return (
    <div className="page-stack">
      <section className="hero-band admin-hero">
        <div>
          <Badge tone="amber">互评</Badge>
          <h1>待我批改</h1>
          <p className="hero-copy">
            同学提交后，系统会按班级学号顺序分配批改任务。批改提交后，成绩会立即进入老师端。
          </p>
        </div>

        <div className="hero-stats">
          <div>
            <strong>{readyCount}</strong>
            <span>待批改</span>
          </div>
          <div>
            <strong>{gradedCount}</strong>
            <span>已批改</span>
          </div>
        </div>
      </section>

      {resolvedSearchParams?.error ? (
        <div className="form-alert page-notice">
          {gradingListErrorMessages[resolvedSearchParams.error] ?? "批改任务加载失败，请稍后重试。"}
        </div>
      ) : null}

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">列表</Badge>
          <h2>{student.class ? `${student.class.name} 的批改任务` : "批改任务"}</h2>
          <p>只显示已经分配给你的任务。已批改任务可以继续查看批改详情。</p>
        </div>

        {!student.classId ? (
          <div className="empty-state">你还没有被分入班级，暂时没有批改任务。</div>
        ) : assignments.length === 0 ? (
          <div className="empty-state">当前没有分配给你的批改任务。</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>考试</th>
                  <th>考生</th>
                  <th>题目数</th>
                  <th>状态</th>
                  <th>成绩</th>
                  <th>批改截止</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const result = assignment.results[0];

                  return (
                    <tr key={assignment.id}>
                      <td>{assignment.exam.title}</td>
                      <td>
                        {assignment.submitter.studentNo} {assignment.submitter.realName}
                      </td>
                      <td>{assignment.exam._count.questions}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            assignment.status === "GRADED" ? "status-pill-success" : "status-pill-warning"
                          }`}
                        >
                          {gradingStatusLabels[assignment.status] ?? assignment.status}
                        </span>
                      </td>
                      <td>{result ? `${result.totalScore}/${result.maxScore}` : "未批改"}</td>
                      <td>{formatDateTime(assignment.exam.gradingDeadline)}</td>
                      <td>
                        <Link className="primary-link inline-action" href={`/student/grading/${assignment.id}`}>
                          {assignment.status === "GRADED" ? "查看详情" : "去批改"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="student-action-row">
          <Link className="secondary-link" href="/student">
            返回学生端
          </Link>
          <Link className="secondary-link" href="/student/exams">
            我的考试
          </Link>
        </div>
      </section>
    </div>
  );
}
