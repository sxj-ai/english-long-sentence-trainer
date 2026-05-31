import { notFound } from "next/navigation";
import { ArticleWorkspace } from "@/components/article/ArticleWorkspace";
import { getArticle, listArticles } from "@/features/article/jsonArticleRepository";
import { getCurrentUser } from "@/lib/auth";

export const dynamicParams = false;

export async function generateStaticParams() {
  const articles = await listArticles();
  return articles.map((article) => ({
    articleId: article.id
  }));
}

interface ArticlePageProps {
  params: Promise<{ articleId: string }>;
  searchParams?: Promise<{
    ai?: string;
    sentenceId?: string;
  }>;
}

export default async function ArticlePage({ params, searchParams }: ArticlePageProps) {
  const { articleId } = await params;
  const resolvedSearchParams = await searchParams;
  const article = await getArticle(articleId);
  const currentUser = await getCurrentUser();

  if (!article) {
    notFound();
  }

  return (
    <div className="page-stack">
      <ArticleWorkspace
        aiAccess={currentUser?.role === "STUDENT" ? "student" : currentUser ? "other" : "anonymous"}
        article={article}
        initialSentenceId={resolvedSearchParams?.sentenceId}
        initialSideMode={resolvedSearchParams?.ai === "1" ? "ai" : "sentences"}
      />
    </div>
  );
}
