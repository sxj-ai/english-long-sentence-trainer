import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleWorkspace } from "@/components/article/ArticleWorkspace";
import { getArticle, listArticles } from "@/features/article/jsonArticleRepository";

export const dynamicParams = false;

export async function generateStaticParams() {
  const articles = await listArticles();
  return articles.map((article) => ({
    articleId: article.id
  }));
}

export default async function ArticlePage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const article = await getArticle(articleId);

  if (!article) {
    notFound();
  }

  return (
    <div className="page-stack">
      <div className="toolbar-row">
        <Link className="secondary-link" href="/">
          返回文章列表
        </Link>
        <Link className="primary-link" href={`/practice/${article.id}`}>
          进入检测
        </Link>
      </div>
      <ArticleWorkspace article={article} />
    </div>
  );
}
