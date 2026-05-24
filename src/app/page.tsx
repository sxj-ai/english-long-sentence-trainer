import Link from "next/link";
import { Badge } from "@/components/common/Badge";
import { listArticles } from "@/features/article/jsonArticleRepository";
import { formatDifficulty } from "@/lib/text";

export default async function HomePage() {
  const articles = await listArticles();

  return (
    <div className="page-stack">
      <section className="hero-band">
        <div>
          <p className="eyebrow">MVP 已连接本地 JSON 数据</p>
          <h1>考研英语长难句结构训练系统</h1>
          <p className="hero-copy">
            从句子主干、修饰关系、结构直译和重点词短语入手，把长难句拆成学生能看懂、能练习、能复盘的结构。
          </p>
        </div>
        <div className="hero-stats" aria-label="当前数据概览">
          <div>
            <strong>{articles.length}</strong>
            <span>篇文章</span>
          </div>
          <div>
            <strong>{articles.reduce((sum, article) => sum + article.sentenceCount, 0)}</strong>
            <span>个句子</span>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>文章列表</h2>
          <p>第一版从本地 JSON 读取；后续可平滑迁移到数据库。</p>
        </div>

        <div className="article-grid">
          {articles.map((article) => (
            <article className="article-card" key={article.id}>
              <div className="card-meta">
                <Badge tone="blue">{article.year}</Badge>
                <Badge>{article.examType}</Badge>
                <Badge>{article.textId}</Badge>
              </div>
              <h3>{article.title}</h3>
              <dl className="metric-list">
                <div>
                  <dt>句子</dt>
                  <dd>{article.sentenceCount}</dd>
                </div>
                <div>
                  <dt>平均难度</dt>
                  <dd>{formatDifficulty(Math.round(article.averageDifficulty))}</dd>
                </div>
              </dl>
              <div className="card-actions">
                <Link className="primary-link" href={`/articles/${article.id}`}>
                  开始学习
                </Link>
                <Link className="secondary-link" href={`/practice/${article.id}`}>
                  进入检测
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
