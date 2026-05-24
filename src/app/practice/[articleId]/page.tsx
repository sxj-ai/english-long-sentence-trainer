import Link from "next/link";
import { notFound } from "next/navigation";
import { PracticeWorkspace } from "@/components/practice/PracticeWorkspace";
import { getArticle, listArticles } from "@/features/article/jsonArticleRepository";
import { generatePracticeItems } from "@/features/practice/practiceGenerator";

export const dynamicParams = false;

export async function generateStaticParams() {
  const articles = await listArticles();
  return articles.map((article) => ({
    articleId: article.id
  }));
}

export default async function PracticePage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const article = await getArticle(articleId);

  if (!article) {
    notFound();
  }

  const items = generatePracticeItems(article);

  return (
    <div className="page-stack">
      <div className="toolbar-row">
        <Link className="secondary-link" href={`/articles/${article.id}`}>
          返回学习
        </Link>
      </div>
      <PracticeWorkspace article={article} items={items} />
    </div>
  );
}
