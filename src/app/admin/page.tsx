import Link from "next/link";
import { Badge } from "@/components/common/Badge";
import { createTeacherAction } from "@/features/admin/teacherActions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const teacherErrorMessages: Record<string, string> = {
  missing: "请填写老师姓名、用户名和初始密码。",
  "weak-password": "初始密码至少需要 8 位。",
  "username-exists": "这个用户名已经存在，请换一个。",
  "admin-profile-missing": "当前管理员资料不完整，请先重新初始化管理员账号。"
};

interface AdminPageProps {
  searchParams?: Promise<{
    createdTeacher?: string;
    invitationCode?: string;
    teacherError?: string;
  }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const admin = await requireUser("ADMIN");
  const resolvedSearchParams = await searchParams;
  const teachers = await prisma.teacherProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          username: true,
          status: true,
          createdAt: true
        }
      },
      classes: {
        select: {
          id: true
        }
      },
      students: {
        select: {
          id: true
        }
      }
    }
  });
  const [studentCount, classCount, vocabularyCount, examCount] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.class.count(),
    prisma.vocabularyItem.count(),
    prisma.exam.count()
  ]);
  const [articleVocabularyCount, unitVocabularyCount, manualVocabularyCount] = await Promise.all([
    prisma.vocabularyItem.count({ where: { sourceType: "ARTICLE" } }),
    prisma.vocabularyItem.count({ where: { sourceType: "UNIT" } }),
    prisma.vocabularyItem.count({ where: { sourceType: "MANUAL" } })
  ]);

  const createdTeacher = resolvedSearchParams?.createdTeacher;
  const invitationCode = resolvedSearchParams?.invitationCode;
  const teacherError = resolvedSearchParams?.teacherError;

  return (
    <div className="page-stack">
      <section className="hero-band admin-hero">
        <div>
          <Badge tone="green">管理员端</Badge>
          <h1>后台管理</h1>
          <p className="hero-copy">
            当前登录：{admin.displayName}。这里先完成老师账号创建和邀请码发放，后续学生注册、分班和考试都会接到这套账号体系。
          </p>
        </div>

        <div className="hero-stats">
          <div>
            <strong>{teachers.length}</strong>
            <span>老师账号</span>
          </div>
          <div>
            <strong>{studentCount}</strong>
            <span>已绑定学生</span>
          </div>
          <div>
            <strong>{classCount}</strong>
            <span>班级</span>
          </div>
          <div>
            <strong>{vocabularyCount}</strong>
            <span>词库词条</span>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">系统概览</Badge>
          <h2>当前数据</h2>
          <p>这里用于确认账号、班级、词库和考试数据是否已经进入数据库。</p>
        </div>

        <dl className="metric-list admin-metric-list">
          <div>
            <dt>老师账号</dt>
            <dd>{teachers.length}</dd>
          </div>
          <div>
            <dt>学生账号</dt>
            <dd>{studentCount}</dd>
          </div>
          <div>
            <dt>班级</dt>
            <dd>{classCount}</dd>
          </div>
          <div>
            <dt>词库词条</dt>
            <dd>{vocabularyCount}</dd>
          </div>
          <div>
            <dt>考试</dt>
            <dd>{examCount}</dd>
          </div>
        </dl>

        <div className="student-action-row">
          <Link className="primary-link" href="/admin/vocabulary">
            进入词库管理
          </Link>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="amber">词源结构</Badge>
          <h2>系统词库分布</h2>
          <p>文章导入词、单元词和手动维护词会进入同一个题源池，老师组卷时只负责筛选。</p>
        </div>

        <dl className="metric-list admin-metric-list">
          <div>
            <dt>文章导入</dt>
            <dd>{articleVocabularyCount}</dd>
          </div>
          <div>
            <dt>单元词库</dt>
            <dd>{unitVocabularyCount}</dd>
          </div>
          <div>
            <dt>手动维护</dt>
            <dd>{manualVocabularyCount}</dd>
          </div>
        </dl>
      </section>

      <section className="management-grid">
        <div className="section-block">
          <div className="section-heading">
            <Badge tone="blue">创建老师</Badge>
            <h2>新增老师账号</h2>
            <p>老师账号由管理员创建。创建成功后，把邀请码发给学生，学生注册时输入邀请码即可绑定这位老师。</p>
          </div>

          {createdTeacher && invitationCode ? (
            <div className="form-success">
              已创建老师 {createdTeacher}，邀请码：<strong>{invitationCode}</strong>
            </div>
          ) : null}

          {teacherError ? (
            <div className="form-alert">{teacherErrorMessages[teacherError] ?? "创建老师失败，请重试。"}</div>
          ) : null}

          <form action={createTeacherAction} className="form-stack">
            <label className="field-stack">
              <span>老师姓名</span>
              <input name="realName" placeholder="例如：张老师" required />
            </label>

            <label className="field-stack">
              <span>登录用户名</span>
              <input name="username" placeholder="例如：teacher_zhang" autoComplete="off" required />
            </label>

            <label className="field-stack">
              <span>初始密码</span>
              <input name="password" type="password" minLength={8} placeholder="至少 8 位" required />
            </label>

            <button className="primary-link form-submit" type="submit">
              创建老师账号
            </button>
          </form>
        </div>

        <div className="section-block">
          <div className="section-heading">
            <Badge tone="amber">老师列表</Badge>
            <h2>已创建老师</h2>
            <p>每个老师都有独立邀请码，后续老师端会在这里继续扩展班级、学生和考试管理入口。</p>
          </div>

          {teachers.length > 0 ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>老师</th>
                    <th>用户名</th>
                    <th>邀请码</th>
                    <th>班级</th>
                    <th>学生</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher) => (
                    <tr key={teacher.id}>
                      <td>{teacher.realName}</td>
                      <td>{teacher.user.username}</td>
                      <td>
                        <code>{teacher.invitationCode}</code>
                      </td>
                      <td>{teacher.classes.length}</td>
                      <td>{teacher.students.length}</td>
                      <td>{teacher.user.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">还没有老师账号。先在左侧创建一个老师。</div>
          )}
        </div>
      </section>
    </div>
  );
}
