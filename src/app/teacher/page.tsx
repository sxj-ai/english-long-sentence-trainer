import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/common/Badge";
import { StudentAiAnalysisPanel } from "@/components/student/StudentAiAnalysisPanel";
import {
  assignStudentToClassAction,
  createClassAction,
  createExamDraftAction,
  createAutoExamDraftAction,
  publishExamAction
} from "@/features/teacher/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const classErrorMessages: Record<string, string> = {
  "missing-name": "请填写班级名称。",
  "name-exists": "这个班级名称已经存在，请换一个。"
};

const assignErrorMessages: Record<string, string> = {
  missing: "请选择学生和班级。",
  "student-not-found": "学生不存在，或不属于当前老师。",
  "class-not-found": "班级不存在，或不属于当前老师。"
};

const examErrorMessages: Record<string, string> = {
  missing: "请填写考试名称并选择班级。",
  "invalid-date": "考试时间格式不正确。",
  "no-questions": "请至少勾选一个词条作为考试题目。",
  "class-not-found": "班级不存在，或不属于当前老师。",
  "vocabulary-not-found": "部分词库词条不存在，请刷新后重试。"
};

const autoExamErrorMessages: Record<string, string> = {
  missing: "请填写考试名称、班级和抽题数量。",
  "invalid-date": "考试时间格式不正确。",
  "class-not-found": "班级不存在，或不属于当前老师。",
  "not-enough-questions": "当前筛选结果里的词条数量不够，请缩小题量或调整筛选。"
};

const publishErrorMessages: Record<string, string> = {
  missing: "请选择要发布的考试。",
  "exam-not-found": "考试不存在，或不属于当前老师。",
  "not-draft": "只有草稿状态的考试可以发布。",
  "no-questions": "没有题目的考试不能发布。"
};

const examStatusLabels: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  CLOSED: "已关闭",
  FINISHED: "已完成"
};

interface TeacherPageProps {
  searchParams?: Promise<{
    createdClass?: string;
    classError?: string;
    assignedStudent?: string;
    assignedClass?: string;
    assignError?: string;
    teacherError?: string;
    createdExam?: string;
    examError?: string;
    generatedExam?: string;
    autoExamError?: string;
    publishedExam?: string;
    publishError?: string;
    vocabQ?: string;
    vocabYear?: string;
    vocabExamType?: string;
    vocabTextId?: string;
    aiClassId?: string;
    aiStudentId?: string;
    aiQ?: string;
    aiFrom?: string;
    aiTo?: string;
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

export default async function TeacherPage({ searchParams }: TeacherPageProps) {
  const teacherUser = await requireUser("TEACHER");
  const resolvedSearchParams = await searchParams;
  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: teacherUser.id },
    include: {
      classes: {
        orderBy: { name: "asc" },
        include: {
          students: {
            orderBy: { studentNo: "asc" },
            select: {
              id: true,
              realName: true,
              studentNo: true
            }
          }
        }
      },
      students: {
        orderBy: { studentNo: "asc" },
        include: {
          user: {
            select: {
              username: true,
              status: true
            }
          },
          class: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  if (!teacher) {
    return (
      <div className="section-block narrow">
        <div className="section-heading">
          <Badge tone="red">账号异常</Badge>
          <h1>老师资料缺失</h1>
          <p>当前账号是老师角色，但没有对应的老师资料。请联系管理员重新创建账号。</p>
        </div>
      </div>
    );
  }

  const pendingStudents = teacher.students.filter((student) => student.status === "PENDING_CLASS");
  const activeStudents = teacher.students.filter((student) => student.status === "ACTIVE");
  const activeClasses = teacher.classes.filter((classItem) => classItem.status === "ACTIVE");
  const classError = resolvedSearchParams?.classError;
  const assignError = resolvedSearchParams?.assignError;
  const examError = resolvedSearchParams?.examError;
  const autoExamError = resolvedSearchParams?.autoExamError;
  const publishError = resolvedSearchParams?.publishError;
  const vocabQ = resolvedSearchParams?.vocabQ?.trim() ?? "";
  const vocabYear = resolvedSearchParams?.vocabYear?.trim() ?? "";
  const vocabExamType = resolvedSearchParams?.vocabExamType?.trim() ?? "";
  const vocabTextId = resolvedSearchParams?.vocabTextId?.trim() ?? "";
  const aiClassId = resolvedSearchParams?.aiClassId?.trim() ?? "";
  const aiStudentId = resolvedSearchParams?.aiStudentId?.trim() ?? "";
  const aiQ = resolvedSearchParams?.aiQ?.trim() ?? "";
  const aiFrom = resolvedSearchParams?.aiFrom?.trim() ?? "";
  const aiTo = resolvedSearchParams?.aiTo?.trim() ?? "";
  const vocabularyWhere: Prisma.VocabularyItemWhereInput = {};

  if (vocabQ) {
    vocabularyWhere.OR = [
      { word: { contains: vocabQ, mode: "insensitive" } },
      { meaning: { contains: vocabQ, mode: "insensitive" } }
    ];
  }

  if (vocabYear) {
    const year = Number.parseInt(vocabYear, 10);

    if (Number.isFinite(year)) {
      vocabularyWhere.examYear = year;
    }
  }

  if (vocabExamType) {
    vocabularyWhere.examType = vocabExamType;
  }

  if (vocabTextId) {
    vocabularyWhere.textId = vocabTextId;
  }

  const aiConversationWhere: Prisma.AiConversationWhereInput = {
    teacherId: teacher.id
  };

  if (aiClassId) {
    aiConversationWhere.classId = aiClassId;
  }

  if (aiStudentId) {
    aiConversationWhere.studentId = aiStudentId;
  }

  if (aiQ) {
    aiConversationWhere.OR = [
      { question: { contains: aiQ, mode: "insensitive" } },
      { answer: { contains: aiQ, mode: "insensitive" } },
      { sentenceText: { contains: aiQ, mode: "insensitive" } },
      { articleId: { contains: aiQ, mode: "insensitive" } },
      { sentenceId: { contains: aiQ, mode: "insensitive" } }
    ];
  }

  const aiCreatedAt: Prisma.DateTimeFilter = {};

  if (aiFrom) {
    const fromDate = new Date(`${aiFrom}T00:00:00`);

    if (!Number.isNaN(fromDate.getTime())) {
      aiCreatedAt.gte = fromDate;
    }
  }

  if (aiTo) {
    const toDate = new Date(`${aiTo}T23:59:59.999`);

    if (!Number.isNaN(toDate.getTime())) {
      aiCreatedAt.lte = toDate;
    }
  }

  if (aiCreatedAt.gte || aiCreatedAt.lte) {
    aiConversationWhere.createdAt = aiCreatedAt;
  }

  const [
    vocabularyItems,
    vocabularyOptions,
    exams,
    recentAiConversations,
    aiConversationCount,
    latestAiAnalyses,
    recentPracticeGradings
  ] = await Promise.all([
    prisma.vocabularyItem.findMany({
      where: vocabularyWhere,
      orderBy: [{ examYear: "desc" }, { examType: "asc" }, { textId: "asc" }, { word: "asc" }],
      take: 80
    }),
    prisma.vocabularyItem.findMany({
      select: {
        examYear: true,
        examType: true,
        textId: true
      },
      orderBy: [{ examYear: "desc" }, { examType: "asc" }, { textId: "asc" }]
    }),
    prisma.exam.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      include: {
        class: {
          select: {
            name: true,
            students: {
              select: {
                id: true
              }
            }
          }
        },
        submissions: {
          where: {
            status: "SUBMITTED"
          },
          select: {
            studentId: true
          }
        },
        _count: {
          select: {
            questions: true
          }
        }
      },
      take: 20
    }),
    prisma.aiConversation.findMany({
      where: aiConversationWhere,
      include: {
        class: {
          select: {
            name: true
          }
        },
        student: {
          select: {
            id: true,
            realName: true,
            studentNo: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    }),
    prisma.aiConversation.count({
      where: aiConversationWhere
    }),
    prisma.studentAiAnalysis.findMany({
      where: {
        teacherId: teacher.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 40
    }),
    prisma.practiceAiGrading.findMany({
      where: {
        teacherId: teacher.id
      },
      include: {
        student: {
          select: {
            realName: true,
            studentNo: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    })
  ]);
  const vocabularyYears = Array.from(
    new Set(vocabularyOptions.map((option) => option.examYear).filter((year): year is number => year !== null))
  );
  const vocabularyExamTypes = Array.from(
    new Set(vocabularyOptions.map((option) => option.examType).filter((examType): examType is string => Boolean(examType)))
  );
  const vocabularyTextIds = Array.from(
    new Set(vocabularyOptions.map((option) => option.textId).filter((textId): textId is string => Boolean(textId)))
  );
  const latestAnalysisByStudentId = new Map<string, (typeof latestAiAnalyses)[number]>();

  for (const analysis of latestAiAnalyses) {
    if (!latestAnalysisByStudentId.has(analysis.studentId)) {
      latestAnalysisByStudentId.set(analysis.studentId, analysis);
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-band admin-hero">
        <div>
          <Badge tone="green">老师端</Badge>
          <h1>{teacher.realName}的工作台</h1>
          <p className="hero-copy">
            学生注册时输入你的邀请码，会先进入待分班列表。你可以创建班级，再把学生逐个分入班级。
          </p>
        </div>

        <div className="hero-stats">
          <div>
            <strong>{pendingStudents.length}</strong>
            <span>待分班</span>
          </div>
          <div>
            <strong>{activeStudents.length}</strong>
            <span>已分班</span>
          </div>
        </div>
      </section>

      {resolvedSearchParams?.createdClass ? (
        <div className="form-success page-notice">
          已创建班级：<strong>{resolvedSearchParams.createdClass}</strong>
        </div>
      ) : null}

      {resolvedSearchParams?.assignedStudent && resolvedSearchParams?.assignedClass ? (
        <div className="form-success page-notice">
          已将 {resolvedSearchParams.assignedStudent} 分入 <strong>{resolvedSearchParams.assignedClass}</strong>
        </div>
      ) : null}

      {classError ? (
        <div className="form-alert page-notice">{classErrorMessages[classError] ?? "创建班级失败，请重试。"}</div>
      ) : null}

      {assignError ? (
        <div className="form-alert page-notice">{assignErrorMessages[assignError] ?? "分班失败，请重试。"}</div>
      ) : null}

      {resolvedSearchParams?.createdExam ? (
        <div className="form-success page-notice">
          已创建考试草稿：<strong>{resolvedSearchParams.createdExam}</strong>
        </div>
      ) : null}

      {examError ? (
        <div className="form-alert page-notice">{examErrorMessages[examError] ?? "创建考试失败，请重试。"}</div>
      ) : null}

      {resolvedSearchParams?.generatedExam ? (
        <div className="form-success page-notice">
          已自动生成考试草稿：<strong>{resolvedSearchParams.generatedExam}</strong>
        </div>
      ) : null}

      {autoExamError ? (
        <div className="form-alert page-notice">
          {autoExamErrorMessages[autoExamError] ?? "自动组卷失败，请重试。"}
        </div>
      ) : null}

      {resolvedSearchParams?.publishedExam ? (
        <div className="form-success page-notice">
          已发布考试：<strong>{resolvedSearchParams.publishedExam}</strong>
        </div>
      ) : null}

      {publishError ? (
        <div className="form-alert page-notice">{publishErrorMessages[publishError] ?? "发布考试失败，请重试。"}</div>
      ) : null}

      <section className="teacher-grid">
        <div className="panel-stack">
          <div className="section-block">
            <div className="section-heading">
              <Badge tone="blue">邀请码</Badge>
              <h2>学生注册入口</h2>
              <p>把这个邀请码发给学生。学生注册成功后，会自动绑定到你名下并等待分班。</p>
            </div>

            <div className="invite-code-card">
              <span>老师邀请码</span>
              <strong>{teacher.invitationCode}</strong>
            </div>
          </div>

          <div className="section-block">
            <div className="section-heading">
              <Badge tone="green">创建班级</Badge>
              <h2>新增班级</h2>
              <p>班级名称在你的账号下不能重复。创建后即可在待分班列表中选择。</p>
            </div>

            <form action={createClassAction} className="form-stack">
              <label className="field-stack">
                <span>班级名称</span>
                <input name="name" placeholder="例如：基础班 A" required />
              </label>

              <label className="field-stack">
                <span>备注</span>
                <textarea name="description" placeholder="可选，例如：周末词汇默写班" rows={3} />
              </label>

              <button className="primary-link form-submit" type="submit">
                创建班级
              </button>
            </form>
          </div>
        </div>

        <div className="section-block">
          <div className="section-heading">
            <Badge tone="amber">待处理</Badge>
            <h2>待分班学生</h2>
            <p>这些学生已经输入你的邀请码完成注册，但还没有进入任何班级。</p>
          </div>

          {pendingStudents.length > 0 ? (
            <div className="data-table-wrap">
              <table className="data-table assign-table">
                <thead>
                  <tr>
                    <th>学号</th>
                    <th>姓名</th>
                    <th>用户名</th>
                    <th>状态</th>
                    <th>分入班级</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingStudents.map((student) => (
                    <tr key={student.id}>
                      <td>{student.studentNo}</td>
                      <td>{student.realName}</td>
                      <td>{student.user.username}</td>
                      <td>待分班</td>
                      <td>
                        {activeClasses.length > 0 ? (
                          <form action={assignStudentToClassAction} className="inline-form">
                            <input type="hidden" name="studentId" value={student.id} />
                            <select name="classId" aria-label={`选择 ${student.realName} 的班级`} required>
                              <option value="">选择班级</option>
                              {activeClasses.map((classItem) => (
                                <option key={classItem.id} value={classItem.id}>
                                  {classItem.name}
                                </option>
                              ))}
                            </select>
                            <button className="primary-link inline-action" type="submit">
                              分入
                            </button>
                          </form>
                        ) : (
                          <span className="muted-text">请先创建班级</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">暂无待分班学生。学生用你的邀请码注册后会出现在这里。</div>
          )}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">系统词库</Badge>
          <h2>筛选词条</h2>
          <p>词库现在同时包含文章导入、单元词和手动维护词条。先用筛选找到词条，再创建考试草稿或自动组卷。</p>
        </div>

        <form className="filter-form" action="/teacher" method="get">
          <label className="field-stack">
            <span>关键词</span>
            <input name="vocabQ" defaultValue={vocabQ} placeholder="搜索英文或中文释义" />
          </label>

          <label className="field-stack">
            <span>年份</span>
            <select name="vocabYear" defaultValue={vocabYear}>
              <option value="">全部年份</option>
              {vocabularyYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="field-stack">
            <span>考试类型</span>
            <select name="vocabExamType" defaultValue={vocabExamType}>
              <option value="">全部类型</option>
              {vocabularyExamTypes.map((examType) => (
                <option key={examType} value={examType}>
                  {examType}
                </option>
              ))}
            </select>
          </label>

          <label className="field-stack">
            <span>Text</span>
            <select name="vocabTextId" defaultValue={vocabTextId}>
              <option value="">全部 Text</option>
              {vocabularyTextIds.map((textId) => (
                <option key={textId} value={textId}>
                  {textId}
                </option>
              ))}
            </select>
          </label>

          <button className="primary-link filter-submit" type="submit">
            筛选
          </button>
        </form>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="green">考试草稿</Badge>
          <h2>从词库创建默写考试</h2>
          <p>当前仅创建草稿，不发布给学生。题目会保存单词和标准释义快照，不会因为后续词库变化而变化。</p>
        </div>

        {activeClasses.length === 0 ? (
          <div className="empty-state">请先创建班级，再创建考试。</div>
        ) : vocabularyItems.length === 0 ? (
          <div className="empty-state">当前筛选条件下没有词条。请先导入词库或调整筛选。</div>
        ) : (
          <form action={createExamDraftAction} className="exam-draft-form">
            <div className="form-grid">
              <label className="field-stack">
                <span>考试名称</span>
                <input name="title" placeholder="例如：2015 英语一 Text 1 重点词默写" required />
              </label>

              <label className="field-stack">
                <span>班级</span>
                <select name="classId" required>
                  <option value="">选择班级</option>
                  {activeClasses.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span>开始时间</span>
                <input name="startAt" type="datetime-local" />
              </label>

              <label className="field-stack">
                <span>答题截止</span>
                <input name="submitDeadline" type="datetime-local" />
              </label>

              <label className="field-stack">
                <span>批改截止</span>
                <input name="gradingDeadline" type="datetime-local" />
              </label>

              <label className="field-stack">
                <span>答题限时（分钟）</span>
                <input name="timeLimitMinutes" type="number" min={1} defaultValue={20} />
              </label>

              <label className="field-stack">
                <span>每题分值</span>
                <input name="scorePerQuestion" type="number" min={1} defaultValue={1} />
              </label>

              <label className="field-stack">
                <span>备注</span>
                <textarea name="description" rows={3} placeholder="可选" />
              </label>
            </div>

            <div className="vocab-select-header">
              <h3>选择词条</h3>
              <span>当前显示 {vocabularyItems.length} 个词条，至少选择 1 个。</span>
            </div>

            <div className="vocab-checkbox-grid">
              {vocabularyItems.map((item) => (
                <label className="vocab-checkbox-card" key={item.id}>
                  <input name="vocabularyItemIds" type="checkbox" value={item.id} />
                  <span>
                    <strong>{item.word}</strong>
                    <small>{item.meaning}</small>
                    <em>
                      {item.examYear ?? "-"} {item.examType ?? ""} {item.textId ?? ""}
                    </em>
                  </span>
                </label>
              ))}
            </div>

            <button className="primary-link form-submit" type="submit">
              创建考试草稿
            </button>
          </form>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">自动组卷</Badge>
          <h2>从当前筛选结果随机抽题</h2>
          <p>直接从当前筛选出的词条随机抽题。后面再补更细的专门词库时，这里只换筛选条件，不改整体流程。</p>
        </div>

        {activeClasses.length === 0 ? (
          <div className="empty-state">请先创建班级，再自动组卷。</div>
        ) : vocabularyItems.length === 0 ? (
          <div className="empty-state">当前筛选条件下没有可用词条，暂时无法自动组卷。</div>
        ) : (
          <form action={createAutoExamDraftAction} className="exam-draft-form">
            <input type="hidden" name="vocabQ" value={vocabQ} />
            <input type="hidden" name="vocabYear" value={vocabYear} />
            <input type="hidden" name="vocabExamType" value={vocabExamType} />
            <input type="hidden" name="vocabTextId" value={vocabTextId} />

            <div className="form-grid">
              <label className="field-stack">
                <span>考试名称</span>
                <input name="title" placeholder="例如：2015 英语一 Text 1 自动默写" required />
              </label>

              <label className="field-stack">
                <span>班级</span>
                <select name="classId" required>
                  <option value="">选择班级</option>
                  {activeClasses.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span>抽题数量</span>
                <input name="questionCount" type="number" min={1} max={vocabularyItems.length} defaultValue={10} required />
              </label>

              <label className="field-stack">
                <span>开始时间</span>
                <input name="startAt" type="datetime-local" />
              </label>

              <label className="field-stack">
                <span>答题截止</span>
                <input name="submitDeadline" type="datetime-local" />
              </label>

              <label className="field-stack">
                <span>批改截止</span>
                <input name="gradingDeadline" type="datetime-local" />
              </label>

              <label className="field-stack">
                <span>答题限时（分钟）</span>
                <input name="timeLimitMinutes" type="number" min={1} defaultValue={20} />
              </label>

              <label className="field-stack">
                <span>每题分值</span>
                <input name="scorePerQuestion" type="number" min={1} defaultValue={1} />
              </label>

              <label className="field-stack">
                <span>备注</span>
                <textarea name="description" rows={3} placeholder="可选" />
              </label>
            </div>

            <button className="primary-link form-submit" type="submit">
              自动生成考试草稿
            </button>
          </form>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="amber">考试列表</Badge>
          <h2>我的考试</h2>
          <p>草稿确认无误后可以发布。发布后，同班学生会在学生端看到考试入口并提交答案。</p>
        </div>

        {exams.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>考试</th>
                  <th>班级</th>
                  <th>题目数</th>
                  <th>状态</th>
                  <th>提交</th>
                  <th>开始</th>
                  <th>答题截止</th>
                  <th>批改截止</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => {
                  const submittedStudentCount = new Set(exam.submissions.map((submission) => submission.studentId)).size;
                  const classStudentCount = exam.class.students.length;

                  return (
                    <tr key={exam.id}>
                      <td>{exam.title}</td>
                      <td>{exam.class.name}</td>
                      <td>{exam._count.questions}</td>
                      <td>
                        <span className={`status-pill status-pill-${exam.status.toLowerCase()}`}>
                          {examStatusLabels[exam.status] ?? exam.status}
                        </span>
                      </td>
                      <td>
                        {submittedStudentCount}/{classStudentCount}
                      </td>
                      <td>{formatDateTime(exam.startAt)}</td>
                      <td>{formatDateTime(exam.submitDeadline)}</td>
                      <td>{formatDateTime(exam.gradingDeadline)}</td>
                      <td>
                        {exam.status === "DRAFT" ? (
                          <form action={publishExamAction} className="inline-form">
                            <input type="hidden" name="examId" value={exam.id} />
                            <button className="primary-link inline-action" type="submit">
                              发布
                            </button>
                          </form>
                        ) : (
                          <Link className="secondary-link inline-action" href={`/teacher/exams/${exam.id}`}>
                            查看成绩
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">还没有考试。可以先从词库创建一个草稿。</div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="green">学生概览</Badge>
          <h2>已绑定学生</h2>
          <p>当前列表按学号排序。已分班学生会显示所在班级。</p>
        </div>

        {teacher.students.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>学号</th>
                  <th>姓名</th>
                  <th>用户名</th>
                  <th>班级</th>
                  <th>学生状态</th>
                  <th>账号状态</th>
                </tr>
              </thead>
              <tbody>
                {teacher.students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.studentNo}</td>
                    <td>{student.realName}</td>
                    <td>{student.user.username}</td>
                    <td>{student.class?.name ?? "未分班"}</td>
                    <td>{student.status}</td>
                    <td>{student.user.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">还没有学生绑定到你名下。</div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">AI 学习分析</Badge>
          <h2>学生画像</h2>
          <p>老师可以为任意名下学生调用 AI 生成具体学习分析。分析会引用学生的真实问答、考试和批改状态。</p>
        </div>

        {teacher.students.length > 0 ? (
          <div className="class-card-grid">
            {teacher.students.map((student) => {
              const latestAnalysis = latestAnalysisByStudentId.get(student.id);

              return (
                <div className="class-card" key={student.id}>
                  <div>
                    <h3>
                      {student.studentNo} {student.realName}
                    </h3>
                    <p>{student.class?.name ?? "未分班"} · {student.status}</p>
                  </div>
                  <StudentAiAnalysisPanel
                    description="根据该学生最近的 AI 问答、考试和批改状态生成具体诊断。"
                    initialAnalysis={
                      latestAnalysis
                        ? {
                            id: latestAnalysis.id,
                            createdAt: latestAnalysis.createdAt.toISOString(),
                            summary: latestAnalysis.summary,
                            evidence: latestAnalysis.evidenceJson,
                            ability: latestAnalysis.abilityJson,
                            suggestions: latestAnalysis.suggestionsJson,
                            nextActions: latestAnalysis.nextActionsJson,
                            triggerSource: latestAnalysis.triggerSource
                          }
                        : null
                    }
                    studentId={student.id}
                    title="学习分析"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">还没有学生，暂时无法生成学习画像。</div>
        )}
      </section>

      <section className="section-block" id="ai-records">
        <div className="section-heading">
          <Badge tone="blue">AI 问答记录</Badge>
          <h2>AI 问答记录中心</h2>
          <p>按班级、学生、关键词和时间查看学生在文章详情页“问 AI 老师”的真实记录。</p>
        </div>

        <form className="ai-record-filter" action="/teacher#ai-records" method="get">
          <label className="field-stack">
            <span>班级</span>
            <select name="aiClassId" defaultValue={aiClassId}>
              <option value="">全部班级</option>
              {activeClasses.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-stack">
            <span>学生</span>
            <select name="aiStudentId" defaultValue={aiStudentId}>
              <option value="">全部学生</option>
              {activeStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.studentNo} {student.realName}
                </option>
              ))}
            </select>
          </label>

          <label className="field-stack">
            <span>关键词</span>
            <input name="aiQ" defaultValue={aiQ} placeholder="搜索问题、回答、原句" />
          </label>

          <label className="field-stack">
            <span>开始日期</span>
            <input name="aiFrom" defaultValue={aiFrom} type="date" />
          </label>

          <label className="field-stack">
            <span>结束日期</span>
            <input name="aiTo" defaultValue={aiTo} type="date" />
          </label>

          <div className="ai-record-filter-actions">
            <button className="primary-link filter-submit" type="submit">
              查询记录
            </button>
            <Link className="secondary-link filter-submit" href="/teacher#ai-records">
              重置
            </Link>
          </div>
        </form>

        <div className="ai-record-summary-strip">
          <span>共 {aiConversationCount} 条记录</span>
          <span>当前显示最近 {recentAiConversations.length} 条</span>
          <span>{aiQ || aiClassId || aiStudentId || aiFrom || aiTo ? "已启用筛选" : "未筛选"}</span>
        </div>

        {recentAiConversations.length > 0 ? (
          <div className="teacher-ai-record-list">
            {recentAiConversations.map((item) => (
              <details className="teacher-ai-record" key={item.id}>
                <summary className="teacher-ai-record-summary">
                  <div>
                    <strong>
                      {item.student.studentNo} {item.student.realName}
                    </strong>
                    <span>{item.class?.name ?? "未分班"} · {formatDateTime(item.createdAt)}</span>
                  </div>
                  <p>{item.question}</p>
                  <small>{item.answer.length > 160 ? `${item.answer.slice(0, 160)}...` : item.answer}</small>
                </summary>

                <div className="teacher-ai-record-body">
                  <div>
                    <span>文章 / 句子</span>
                    <p>
                      {item.articleId ? (
                        <Link href={`/articles/${item.articleId}`}>{item.articleId}</Link>
                      ) : (
                        "未记录文章"
                      )}
                      {item.sentenceId ? ` · ${item.sentenceId}` : ""}
                    </p>
                  </div>

                  <div>
                    <span>原句</span>
                    <p>{item.sentenceText || "未记录原句"}</p>
                  </div>

                  <div>
                    <span>学生问题</span>
                    <p>{item.question}</p>
                  </div>

                  <div>
                    <span>AI 完整回答</span>
                    <p className="record-answer">{item.answer}</p>
                  </div>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="empty-state">当前条件下没有学生 AI 问答记录。学生用账号登录后提问，记录会出现在这里。</div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="amber">AI 批改记录</Badge>
          <h2>最近精分析批改</h2>
          <p>学生在精分析主观题中调用 AI 批改后，结果会进入这里，方便老师快速看到真实薄弱点。</p>
        </div>

        {recentPracticeGradings.length > 0 ? (
          <div className="teacher-answer-list">
            {recentPracticeGradings.map((item) => (
              <div className="teacher-answer-row" key={item.id}>
                <div>
                  <strong>
                    {item.student.studentNo} {item.student.realName}
                  </strong>
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
                  <span>问题解释</span>
                  <p>{item.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">还没有学生 AI 批改记录。</div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">班级预览</Badge>
          <h2>我的班级</h2>
          <p>班级里的学生按学号排序。后续考试创建会从这里选择班级。</p>
        </div>

        {activeClasses.length > 0 ? (
          <div className="class-card-grid">
            {activeClasses.map((classItem) => (
              <div className="class-card" key={classItem.id}>
                <div>
                  <h3>{classItem.name}</h3>
                  <p>{classItem.description ?? "暂无备注"}</p>
                </div>
                <strong>{classItem.students.length}</strong>
                <span>名学生</span>
                {classItem.students.length > 0 ? (
                  <ul>
                    {classItem.students.slice(0, 6).map((student) => (
                      <li key={student.id}>
                        {student.studentNo} {student.realName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted-text">还没有学生。</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">还没有班级。下一步会在这里增加创建班级。</div>
        )}
      </section>
    </div>
  );
}
