import { promises as fs } from "fs";
import path from "path";
import { adaptRawSentencesToArticle, toArticleSummary } from "./articleAdapter";
import { rawSentenceArraySchema, validateSentenceRelations } from "./articleSchema";
import type { Article, ArticleSummary, Sentence } from "./articleTypes";

const ARTICLE_DIRS = [
  path.join(process.cwd(), "英语一json"),
  path.join(process.cwd(), "英语二json"),
  path.join(process.cwd(), "data", "articles")
];

export async function listArticles(): Promise<ArticleSummary[]> {
  const articles = await loadAllArticles();
  return articles.map(toArticleSummary).sort((a, b) => b.year - a.year || a.textId.localeCompare(b.textId));
}

export async function getArticle(articleId: string): Promise<Article | null> {
  const articles = await loadAllArticles();
  return articles.find((article) => article.id === articleId) ?? null;
}

export async function getSentence(articleId: string, sentenceId: string): Promise<Sentence | null> {
  const article = await getArticle(articleId);
  return article?.sentences.find((sentence) => sentence.sentenceId === sentenceId) ?? null;
}

async function loadAllArticles(): Promise<Article[]> {
  const filePaths = (await Promise.all(ARTICLE_DIRS.map(readJsonFilesIfExists))).flat();
  const articles = await Promise.all(filePaths.map(loadArticleFile));
  const byId = new Map<string, Article>();

  for (const article of articles) {
    if (!byId.has(article.id)) {
      byId.set(article.id, article);
    }
  }

  return Array.from(byId.values());
}

async function readJsonFilesIfExists(dir: string) {
  try {
    const files = await fs.readdir(dir);
    return files.filter((file) => file.endsWith(".json")).map((file) => path.join(dir, file));
  } catch {
    return [];
  }
}

async function loadArticleFile(filePath: string): Promise<Article> {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as unknown;
  const rawSentences = rawSentenceArraySchema.parse(parsed);
  const warnings = validateSentenceRelations(rawSentences);
  const fileName = path.basename(filePath);

  if (warnings.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(`Data warnings in ${fileName}:\n${warnings.join("\n")}`);
  }

  return adaptRawSentencesToArticle(fileName, rawSentences);
}
