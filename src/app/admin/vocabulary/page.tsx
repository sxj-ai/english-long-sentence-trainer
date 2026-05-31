import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/common/Badge";
import {
  createVocabularyItemAction,
  deleteVocabularyItemAction,
  updateVocabularyItemAction
} from "@/features/admin/vocabularyActions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface AdminVocabularyPageProps {
  searchParams?: Promise<{
    q?: string;
    sourceType?: string;
    examYear?: string;
    examType?: string;
    textId?: string;
    unitCode?: string;
    editId?: string;
    createdVocabulary?: string;
    updatedVocabulary?: string;
    deletedVocabulary?: string;
    vocabularyError?: string;
  }>;
}

const vocabularyErrorMessages: Record<string, string> = {
  missing: "请填写单词、释义和词条来源类型。",
  "invalid-exam-year": "考试年份格式不正确。",
  "admin-profile-missing": "当前管理员资料不完整，请先重新初始化管理员账号。",
  "not-found": "词条不存在，或者已经被删除。",
  "in-use": "这条词条已经被考试引用，暂时不能删除。"
};

const sourceTypeLabels: Record<string, string> = {
  ARTICLE: "文章导入",
  UNIT: "单元词库",
  MANUAL: "手动维护"
};

const importanceLabels: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高"
};

function formatMaybeNumber(value: number | null) {
  return value === null ? "" : String(value);
}

export default async function AdminVocabularyPage({ searchParams }: AdminVocabularyPageProps) {
  await requireUser("ADMIN");
  const resolvedSearchParams = await searchParams;
  const q = resolvedSearchParams?.q?.trim() ?? "";
  const sourceType = resolvedSearchParams?.sourceType?.trim() ?? "";
  const examYear = resolvedSearchParams?.examYear?.trim() ?? "";
  const examType = resolvedSearchParams?.examType?.trim() ?? "";
  const textId = resolvedSearchParams?.textId?.trim() ?? "";
  const unitCode = resolvedSearchParams?.unitCode?.trim() ?? "";
  const editId = resolvedSearchParams?.editId?.trim() ?? "";
  const vocabularyWhere: Prisma.VocabularyItemWhereInput = {};

  if (q) {
    vocabularyWhere.OR = [
      { word: { contains: q, mode: "insensitive" } },
      { meaning: { contains: q, mode: "insensitive" } },
      { sourceKey: { contains: q, mode: "insensitive" } }
    ];
  }

  if (sourceType === "ARTICLE" || sourceType === "UNIT" || sourceType === "MANUAL") {
    vocabularyWhere.sourceType = sourceType;
  }

  if (examYear) {
    const parsedYear = Number.parseInt(examYear, 10);

    if (Number.isFinite(parsedYear)) {
      vocabularyWhere.examYear = parsedYear;
    }
  }

  if (examType) {
    vocabularyWhere.examType = examType;
  }

  if (textId) {
    vocabularyWhere.textId = textId;
  }

  if (unitCode) {
    vocabularyWhere.unitCode = unitCode;
  }

  const [vocabularyItems, filterItems, itemCounts, editItem] = await Promise.all([
    prisma.vocabularyItem.findMany({
      where: vocabularyWhere,
      orderBy: [{ sourceType: "asc" }, { examYear: "desc" }, { examType: "asc" }, { textId: "asc" }, { word: "asc" }],
      take: 200,
      include: {
        _count: {
          select: {
            examQuestions: true
          }
        }
      }
    }),
    prisma.vocabularyItem.findMany({
      select: {
        sourceType: true,
        examYear: true,
        examType: true,
        textId: true,
        unitCode: true
      }
    }),
    Promise.all([
      prisma.vocabularyItem.count({ where: { sourceType: "ARTICLE" } }),
      prisma.vocabularyItem.count({ where: { sourceType: "UNIT" } }),
      prisma.vocabularyItem.count({ where: { sourceType: "MANUAL" } })
    ]),
    editId
      ? prisma.vocabularyItem.findUnique({
          where: { id: editId }
        })
      : Promise.resolve(null)
  ]);

  const sourceTypes = Array.from(
    new Set(filterItems.map((item) => item.sourceType))
  );
  const examYears = Array.from(
    new Set(filterItems.map((item) => item.examYear).filter((value): value is number => value !== null))
  ).sort((a, b) => b - a);
  const examTypes = Array.from(
    new Set(filterItems.map((item) => item.examType).filter((value): value is string => Boolean(value)))
  ).sort();
  const textIds = Array.from(
    new Set(filterItems.map((item) => item.textId).filter((value): value is string => Boolean(value)))
  ).sort();
  const unitCodes = Array.from(
    new Set(filterItems.map((item) => item.unitCode).filter((value): value is string => Boolean(value)))
  ).sort();
  const [articleCount, unitCount, manualCount] = itemCounts;

  return (
    <div className="page-stack">
      <section className="hero-band admin-hero">
        <div>
          <Badge tone="blue">词库管理</Badge>
          <h1>系统词源</h1>
          <p className="hero-copy">
            这里维护长期可复用的题源。后续自动组卷不会只依赖文章 JSON，而是统一从这里抽取题目。
          </p>
        </div>

        <div className="hero-stats">
          <div>
            <strong>{vocabularyItems.length}</strong>
            <span>当前结果</span>
          </div>
          <div>
            <strong>{articleCount + unitCount + manualCount}</strong>
            <span>总词条</span>
          </div>
        </div>
      </section>

      {resolvedSearchParams?.createdVocabulary ? (
        <div className="form-success page-notice">
          已创建词条：<strong>{resolvedSearchParams.createdVocabulary}</strong>
        </div>
      ) : null}

      {resolvedSearchParams?.updatedVocabulary ? (
        <div className="form-success page-notice">
          已更新词条：<strong>{resolvedSearchParams.updatedVocabulary}</strong>
        </div>
      ) : null}

      {resolvedSearchParams?.deletedVocabulary ? (
        <div className="form-success page-notice">已删除词条。</div>
      ) : null}

      {resolvedSearchParams?.vocabularyError ? (
        <div className="form-alert page-notice">
          {vocabularyErrorMessages[resolvedSearchParams.vocabularyError] ?? "词库操作失败，请重试。"}
        </div>
      ) : null}

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="green">系统概览</Badge>
          <h2>词源分布</h2>
          <p>文章导入、单元词和手动词条都会进入同一个词源池，后续组卷只负责筛选，不负责判断来源。</p>
        </div>

        <dl className="metric-list admin-metric-list">
          <div>
            <dt>文章导入</dt>
            <dd>{articleCount}</dd>
          </div>
          <div>
            <dt>单元词库</dt>
            <dd>{unitCount}</dd>
          </div>
          <div>
            <dt>手动维护</dt>
            <dd>{manualCount}</dd>
          </div>
        </dl>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="blue">{editItem ? "编辑词条" : "新增词条"}</Badge>
          <h2>{editItem ? "修改系统词条" : "创建新的词源"}</h2>
          <p>可以把文章导入、单元词和手动维护的词条统一管理。已被考试引用的词条不能直接删除。</p>
        </div>

        <form action={editItem ? updateVocabularyItemAction : createVocabularyItemAction} className="form-stack">
          {editItem ? <input type="hidden" name="vocabularyItemId" value={editItem.id} /> : null}

          <div className="form-grid">
            <label className="field-stack">
              <span>单词</span>
              <input name="word" defaultValue={editItem?.word ?? ""} required />
            </label>

            <label className="field-stack">
              <span>释义</span>
              <input name="meaning" defaultValue={editItem?.meaning ?? ""} required />
            </label>

            <label className="field-stack">
              <span>词性</span>
              <input name="pos" defaultValue={editItem?.pos ?? ""} placeholder="可选" />
            </label>

            <label className="field-stack">
              <span>来源类型</span>
              <select name="sourceType" defaultValue={editItem?.sourceType ?? "MANUAL"} required>
                <option value="ARTICLE">文章导入</option>
                <option value="UNIT">单元词库</option>
                <option value="MANUAL">手动维护</option>
              </select>
            </label>

            <label className="field-stack">
              <span>年份</span>
              <input name="examYear" type="number" defaultValue={formatMaybeNumber(editItem?.examYear ?? null)} placeholder="可选" />
            </label>

            <label className="field-stack">
              <span>考试类型</span>
              <input name="examType" defaultValue={editItem?.examType ?? ""} placeholder="例如：英语一" />
            </label>

            <label className="field-stack">
              <span>Text</span>
              <input name="textId" defaultValue={editItem?.textId ?? ""} placeholder="例如：Text 1" />
            </label>

            <label className="field-stack">
              <span>单元</span>
              <input name="unitCode" defaultValue={editItem?.unitCode ?? ""} placeholder="例如：unit-1" />
            </label>

            <label className="field-stack">
              <span>重要等级</span>
              <select name="importanceLevel" defaultValue={editItem?.importanceLevel ?? "MEDIUM"} required>
                <option value="LOW">低</option>
                <option value="MEDIUM">中</option>
                <option value="HIGH">高</option>
              </select>
            </label>

            <label className="field-stack">
              <span>来源文章 ID</span>
              <input name="sourceArticleId" defaultValue={editItem?.sourceArticleId ?? ""} placeholder="可选" />
            </label>

            <label className="field-stack">
              <span>来源句子 ID</span>
              <input name="sourceSentenceId" defaultValue={editItem?.sourceSentenceId ?? ""} placeholder="可选" />
            </label>

            <label className="field-stack">
              <span>来源 chunk ID</span>
              <input name="sourceChunkId" defaultValue={editItem?.sourceChunkId ?? ""} placeholder="可选" />
            </label>

            <label className="field-stack">
              <span>来源文件</span>
              <input name="sourceFile" defaultValue={editItem?.sourceFile ?? ""} placeholder="可选" />
            </label>

            <label className="field-stack">
              <span>来源文本</span>
              <input name="sourceText" defaultValue={editItem?.sourceText ?? ""} placeholder="可选" />
            </label>
          </div>

          {editItem ? (
            <div className="invitation-code-card">
              <span>词条唯一键</span>
              <strong>{editItem.sourceKey}</strong>
            </div>
          ) : null}

          <div className="student-action-row">
            <button className="primary-link form-submit" type="submit">
              {editItem ? "保存修改" : "创建词条"}
            </button>
            {editItem ? (
              <Link className="secondary-link" href="/admin/vocabulary">
                取消编辑
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <Badge tone="amber">筛选</Badge>
          <h2>查找词条</h2>
          <p>可以按来源类型、年份、Text、单元和关键词筛选，方便后面自动组卷和日常维护。</p>
        </div>

        <form className="filter-form" action="/admin/vocabulary" method="get">
          <label className="field-stack">
            <span>关键词</span>
            <input name="q" defaultValue={q} placeholder="搜索单词、释义或词条键" />
          </label>

          <label className="field-stack">
            <span>来源类型</span>
            <select name="sourceType" defaultValue={sourceType}>
              <option value="">全部来源</option>
              {sourceTypes.map((value) => (
                <option key={value} value={value}>
                  {sourceTypeLabels[value] ?? value}
                </option>
              ))}
            </select>
          </label>

          <label className="field-stack">
            <span>年份</span>
            <select name="examYear" defaultValue={examYear}>
              <option value="">全部年份</option>
              {examYears.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field-stack">
            <span>考试类型</span>
            <select name="examType" defaultValue={examType}>
              <option value="">全部类型</option>
              {examTypes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field-stack">
            <span>Text</span>
            <select name="textId" defaultValue={textId}>
              <option value="">全部 Text</option>
              {textIds.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field-stack">
            <span>单元</span>
            <select name="unitCode" defaultValue={unitCode}>
              <option value="">全部单元</option>
              {unitCodes.map((value) => (
                <option key={value} value={value}>
                  {value}
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
          <Badge tone="green">词条列表</Badge>
          <h2>当前词库结果</h2>
          <p>列表按来源类型、年份和单词排序。可以编辑来源信息，也可以删除未被引用的手动词条。</p>
        </div>

        {vocabularyItems.length === 0 ? (
          <div className="empty-state">当前筛选条件下没有词条。</div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>单词</th>
                  <th>释义</th>
                  <th>来源</th>
                  <th>标签</th>
                  <th>引用</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {vocabularyItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.word}</strong>
                    </td>
                    <td>{item.meaning}</td>
                    <td>
                      <div className="vocab-cell-stack">
                        <span>{sourceTypeLabels[item.sourceType] ?? item.sourceType}</span>
                        <code>{item.sourceKey}</code>
                      </div>
                    </td>
                    <td>
                      <div className="vocab-cell-stack">
                        <span>
                          {item.examYear ?? "—"} {item.examType ?? ""} {item.textId ?? ""}
                        </span>
                        <small>
                          {item.unitCode ?? "—"} · {importanceLabels[item.importanceLevel] ?? item.importanceLevel}
                        </small>
                      </div>
                    </td>
                    <td>{item._count.examQuestions}</td>
                    <td>
                      <div className="inline-form">
                        <Link className="secondary-link inline-action" href={`/admin/vocabulary?editId=${item.id}`}>
                          编辑
                        </Link>
                        <form action={deleteVocabularyItemAction}>
                          <input type="hidden" name="vocabularyItemId" value={item.id} />
                          <button className="secondary-link inline-action" type="submit">
                            删除
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
