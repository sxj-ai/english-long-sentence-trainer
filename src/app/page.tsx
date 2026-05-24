import { HomeSelector } from "@/components/article/HomeSelector";
import { listArticles } from "@/features/article/jsonArticleRepository";

export default async function HomePage() {
  const articles = await listArticles();

  return <HomeSelector articles={articles} />;
}
