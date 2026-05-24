import type { Article, ArticleSummary, Sentence } from "./articleTypes";

export interface ArticleRepository {
  listArticles(): Promise<ArticleSummary[]>;
  getArticle(articleId: string): Promise<Article | null>;
  getSentence(articleId: string, sentenceId: string): Promise<Sentence | null>;
}
